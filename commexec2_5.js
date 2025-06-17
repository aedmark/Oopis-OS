// commexec.js - OopisOS Command Executor v2.5 (Scripting Engine Upgrade)

const CommandExecutor = (() => {
  "use strict";
  let scriptExecutionInProgress = false;
  let backgroundProcessIdCounter = 0;
  let activeJobs = {};
  let geminiConversationHistory = [];
  const GEMINI_SYSTEM_PROMPT = `You are a helpful and witty digital librarian embedded in the OopisOS terminal environment. Your goal is to assist the user by answering their questions.

	You have access to a set of tools (OopisOS shell commands) that you can use to explore the user's virtual file system to gather information for your answers.

	When the user asks a question, you must first determine if running one or more shell commands would be helpful.
	- If the file system contains relevant information, plan and execute the necessary commands. Then, synthesize an answer based on the command output.
	- If the request is a general knowledge question not related to the user's files, answer it directly without using any tools.
	- Do not make up file paths or content. Only use information returned from the tools.
	- Be friendly and conversational in your final response.`;
  async function _handleUserSwitch(commandName, targetUser, providedPassword, options = {}) {
    return new Promise(async (resolve) => {
      const initialLoginAttempt = await UserManager.login(
          targetUser,
          providedPassword
      );
      if (initialLoginAttempt.requiresPasswordPrompt) {
        ModalInputManager.requestInput(
            Config.MESSAGES.PASSWORD_PROMPT,
            async (password) => {
              const finalLoginResult = await UserManager.login(
                  targetUser,
                  password
              );
              if (finalLoginResult.success && !finalLoginResult.noAction) {
                OutputManager.clearOutput();
                const welcomeMsg =
                    commandName === "login"
                        ? `${Config.MESSAGES.WELCOME_PREFIX} ${targetUser}${Config.MESSAGES.WELCOME_SUFFIX}`
                        : `Switched to user: ${targetUser}`;
                await OutputManager.appendToOutput(welcomeMsg);
              }
              resolve({
                success: finalLoginResult.success,
                output: finalLoginResult.message,
                error: finalLoginResult.success
                    ? undefined
                    : finalLoginResult.error || "Login failed.",
                messageType: finalLoginResult.success
                    ? Config.CSS_CLASSES.SUCCESS_MSG
                    : Config.CSS_CLASSES.ERROR_MSG,
              });
            },
            () => {
              // onCancel callback
              resolve({
                success: true,
                output: Config.MESSAGES.OPERATION_CANCELLED,
                messageType: Config.CSS_CLASSES.CONSOLE_LOG_MSG,
              });
            },
            true, // isObscured
            options // Pass down the context for scripting
        );
      } else {
        if (initialLoginAttempt.success && !initialLoginAttempt.noAction) {
          OutputManager.clearOutput();
          const welcomeMsg =
              commandName === "login"
                  ? `${Config.MESSAGES.WELCOME_PREFIX} ${targetUser}${Config.MESSAGES.WELCOME_SUFFIX}`
                  : `Switched to user: ${targetUser}`;
          await OutputManager.appendToOutput(welcomeMsg);
        }
        resolve({
          success: initialLoginAttempt.success,
          output: initialLoginAttempt.message,
          error: initialLoginAttempt.success
              ? undefined
              : initialLoginAttempt.error || "Login failed.",
          messageType: initialLoginAttempt.success
              ? Config.CSS_CLASSES.SUCCESS_MSG
              : Config.CSS_CLASSES.ERROR_MSG,
        });
      }
    });
  }
  function createCommandHandler(definition) {
    const handler = async (args, options) => {
      const { flags, remainingArgs } = Utils.parseFlags(
          args,
          definition.flagDefinitions || []
      );
      const currentUser = UserManager.getCurrentUser().name;
      if (definition.argValidation) {
        const validationResult = Utils.validateArguments(
            remainingArgs,
            definition.argValidation
        );
        if (!validationResult.isValid) {
          const customError = definition.argValidation.error;
          const finalError = customError
              ? `${definition.commandName || ""}: ${customError}`.trim()
              : `${definition.commandName || ""}: ${
                  validationResult.errorDetail
              }`.trim();
          return {
            success: false,
            error: finalError,
          };
        }
      }
      const validatedPaths = {};
      if (definition.pathValidation) {
        for (const pv of definition.pathValidation) {
          const pathArg = remainingArgs[pv.argIndex];
          if (pathArg === undefined) {
            if (pv.optional) {
              continue;
            }
            return {
              success: false,
              error: `${definition.commandName}: Missing expected path argument at index ${pv.argIndex}.`,
            };
          }
          const pathValidationResult = FileSystemManager.validatePath(
              definition.commandName || "command",
              pathArg,
              pv.options
          );
          if (pathValidationResult.error) {
            if (!(pv.options.allowMissing && !pathValidationResult.node)) {
              return {
                success: false,
                error: pathValidationResult.error,
              };
            }
          }
          validatedPaths[pv.argIndex] = pathValidationResult;
        }
      }
      if (definition.permissionChecks) {
        for (const pc of definition.permissionChecks) {
          const validatedPath = validatedPaths[pc.pathArgIndex];
          if (!validatedPath) {
            continue;
          }
          if (!validatedPath.node) {
            return {
              success: false,
              error: `${definition.commandName || ""}: '${
                  remainingArgs[pc.pathArgIndex]
              }': No such file or directory to check permissions.`,
            };
          }
          for (const perm of pc.permissions) {
            if (
                !FileSystemManager.hasPermission(
                    validatedPath.node,
                    currentUser,
                    perm
                )
            ) {
              return {
                success: false,
                error: `${definition.commandName || ""}: '${
                    remainingArgs[pc.pathArgIndex]
                }'${Config.MESSAGES.PERMISSION_DENIED_SUFFIX}`,
              };
            }
          }
        }
      }
      const context = {
        args: remainingArgs,
        options,
        flags,
        currentUser,
        validatedPaths,
        signal: options.signal,
      };
      return definition.coreLogic(context);
    };
    // Attach the definition to the handler for introspection by other systems
    handler.definition = definition;
    return handler;
  }
  const geminiCommandDefinition = {
    commandName: "gemini",
    flagDefinitions: [
      {
        name: "new",
        short: "-n",
        long: "--new",
      },
    ],
    argValidation: {
      min: 1,
      error: 'Insufficient arguments. Usage: gemini [-n|--new] "<prompt>"',
    },
    coreLogic: async (context) => {
      const { args, options, flags } = context;

      const _getApiKey = () => {
        return new Promise((resolve) => {
          let apiKey = StorageManager.loadItem(
              Config.STORAGE_KEYS.GEMINI_API_KEY,
              "Gemini API Key"
          );
          if (apiKey) {
            resolve({ success: true, key: apiKey });
            return;
          }
          if (options.isInteractive) {
            ModalInputManager.requestInput(
                "Please enter your Gemini API key. It will be saved locally for future use.",
                (providedKey) => {
                  if (!providedKey) {
                    resolve({
                      success: false,
                      error: "API key cannot be empty.",
                    });
                    return;
                  }
                  StorageManager.saveItem(
                      Config.STORAGE_KEYS.GEMINI_API_KEY,
                      providedKey,
                      "Gemini API Key"
                  );
                  OutputManager.appendToOutput(
                      "API Key saved to local storage.",
                      {
                        typeClass: Config.CSS_CLASSES.SUCCESS_MSG,
                      }
                  );
                  resolve({ success: true, key: providedKey });
                },
                () => {
                  resolve({ success: false, error: "API key entry cancelled." });
                },
                false,
                options // Pass context for scripting
            );
          } else {
            resolve({
              success: false,
              error: "API key not set. Please run interactively to set it.",
            });
          }
        });
      };

      const _callGeminiApi = async (apiKey, conversationHistory) => {
        const GEMINI_API_URL = Config.API.GEMINI_URL
        const OopisOS_TOOLS = [
          {
            function_declarations: [
              {
                name: "ls",
                description: "Lists directory contents or file information.",
                parameters: {
                  type: "OBJECT",
                  properties: {
                    path: {
                      type: "STRING",
                      description:
                          "The path of the directory or file to list. Defaults to the current directory.",
                    },
                  },
                },
              },
              {
                name: "cat",
                description: "Concatenates and displays file content.",
                parameters: {
                  type: "OBJECT",
                  properties: {
                    path: {
                      type: "STRING",
                      description:
                          "The path to the file whose content should be displayed.",
                    },
                  },
                },
              },
              {
                name: "pwd",
                description: "Prints the current working directory path.",
                parameters: { type: "OBJECT", properties: {} },
              },
              {
                name: "find",
                description: "Searches for files in a directory hierarchy.",
                parameters: {
                  type: "OBJECT",
                  properties: {
                    path: {
                      type: "STRING",
                      description: "The starting path for the search.",
                    },
                    expression: {
                      type: "STRING",
                      description:
                          "The search expression (e.g., '-name \"*.txt\"').",
                    },
                  },
                },
              },
              {
                name: "grep",
                description: "Searches for patterns within files.",
                parameters: {
                  type: "OBJECT",
                  properties: {
                    pattern: {
                      type: "STRING",
                      description: "The pattern to search for.",
                    },
                    path: {
                      type: "STRING",
                      description:
                          "The path of the file or directory to search in.",
                    },
                  },
                },
              },
              {
                name: "tree",
                description: "Lists directory contents in a tree-like format.",
                parameters: {
                  type: "OBJECT",
                  properties: {
                    path: {
                      type: "STRING",
                      description:
                          "The path of the directory to display as a tree. Defaults to the current directory.",
                    },
                  },
                },
              },
            ],
          },
        ];

        try {
          const response = await fetch(GEMINI_API_URL, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-goog-api-key": apiKey,
            },
            body: JSON.stringify({
              contents: conversationHistory,
              tools: OopisOS_TOOLS,
              system_instruction: { parts: [{ text: GEMINI_SYSTEM_PROMPT }] },
            }),
          });

          if (!response.ok) {
            let errorBody = null;
            try {
              errorBody = await response.json();
            } catch (e) {
              return {
                success: false,
                error: `API request failed with status ${response.status}. ${response.statusText}`,
              };
            }
            if (
                response.status === 400 &&
                errorBody?.error?.message.includes("API key not valid")
            ) {
              return { success: false, error: "INVALID_API_KEY" };
            }
            return {
              success: false,
              error: `API request failed with status ${response.status}. ${
                  errorBody?.error?.message || response.statusText
              }`,
            };
          }

          const jsonData = await response.json();
          return { success: true, data: jsonData };
        } catch (e) {
          console.error("Gemini API fetch error:", e);
          return {
            success: false,
            error: `Network or fetch error: ${e.message}`,
          };
        }
      };

      const apiKeyResult = await _getApiKey();
      if (!apiKeyResult.success) {
        return { success: false, error: `gemini: ${apiKeyResult.error}` };
      }
      const apiKey = apiKeyResult.key;

      const userPrompt = args.join(" ");
      if (userPrompt.trim() === "") {
        return { success: false, error: "gemini: Prompt cannot be empty." };
      }

      if (flags["new"]) {
        geminiConversationHistory = [];
        if (options.isInteractive) {
          await OutputManager.appendToOutput(
              "Starting a new conversation with Gemini.",
              { typeClass: Config.CSS_CLASSES.CONSOLE_LOG_MSG }
          );
        }
      }

      geminiConversationHistory.push({
        role: "user",
        parts: [{ text: userPrompt }],
      });

      if (options.isInteractive && geminiConversationHistory.length <= 1) {
        await OutputManager.appendToOutput("Gemini is thinking...", {
          typeClass: Config.CSS_CLASSES.CONSOLE_LOG_MSG,
        });
      }

      while (true) {
        const apiResult = await _callGeminiApi(
            apiKey,
            geminiConversationHistory
        );

        if (!apiResult.success) {
          geminiConversationHistory.pop(); // Remove the failed user prompt
          if (apiResult.error === "INVALID_API_KEY") {
            StorageManager.removeItem(Config.STORAGE_KEYS.GEMINI_API_KEY);
            return {
              success: false,
              error:
                  "gemini: Your API key is invalid. It has been removed. Please run the command again to enter a new key.",
            };
          }
          return {
            success: false,
            error: `gemini: An error occurred. ${apiResult.error}`,
          };
        }

        const result = apiResult.data;
        const candidate =
            result.candidates && result.candidates.length > 0
                ? result.candidates[0]
                : undefined;

        if (!candidate || !candidate.content || !candidate.content.parts) {
          geminiConversationHistory.pop(); // The user's prompt failed, so remove it.

          // Explicitly check for promptFeedback and its blockReason property
          const blockReason =
              result.promptFeedback && result.promptFeedback.blockReason
                  ? result.promptFeedback.blockReason
                  : null;

          if (blockReason) {
            return {
              success: false,
              error: `gemini: Prompt was blocked. Reason: ${blockReason}.`,
            };
          }

          // Explicitly check for an error message on the result object
          const errorMessage =
              result.error && result.error.message
                  ? result.error.message
                  : "Received an invalid or empty response from the API.";
          return { success: false, error: `gemini: ${errorMessage}` };
        }

        let textResponse = "";
        let functionCall = null;
        for (const part of candidate.content.parts) {
          if (part.text) {
            textResponse += part.text;
          } else if (part.functionCall) {
            functionCall = part.functionCall;
            break;
          }
        }

        const modelResponseTurn = {
          role: "model",
          parts: candidate.content.parts,
        };

        if (functionCall) {
          geminiConversationHistory.push(modelResponseTurn);
          if (textResponse && options.isInteractive) {
            await OutputManager.appendToOutput(textResponse);
          }

          if (options.isInteractive) {
            const funcName = functionCall.name;
            const funcArgs = JSON.stringify(functionCall.args || {});
            await OutputManager.appendToOutput(
                `Gemini is exploring with: ${funcName}(${funcArgs})`,
                { typeClass: Config.CSS_CLASSES.CONSOLE_LOG_MSG }
            );
          }

          const commandName = functionCall.name;
          const commandArgs = Object.values(functionCall.args || {})
              .map((arg) => (typeof arg === "string" ? `"${arg}"` : arg))
              .join(" ");
          const fullCommandStr = `${commandName} ${commandArgs}`.trim();
          const execResult = await CommandExecutor.processSingleCommand(
              fullCommandStr,
              false
          );

          geminiConversationHistory.push({
            role: "function",
            parts: [
              {
                functionResponse: {
                  name: commandName,
                  response: {
                    content: execResult.success
                        ? execResult.output || "(No output from command)"
                        : `Error: ${execResult.error || "Command failed"}`,
                  },
                },
              },
            ],
          });
        } else if (textResponse) {
          geminiConversationHistory.push(modelResponseTurn);
          return { success: true, output: textResponse };
        } else {
          geminiConversationHistory.pop();
          return {
            success: false,
            error: "gemini: Received an empty or unsupported response.",
          };
        }
      }
    },
  };
  function getActiveJobs() {
    return activeJobs;
  }
  function killJob(jobId) {
    const job = activeJobs[jobId];
    if (job && job.abortController) {
      job.abortController.abort("Killed by user command.");

      // Immediately remove the job from the list for a responsive feel.
      // The job's own 'finally' block will also try this later, which is safe.
      delete activeJobs[jobId];

      return {
        success: true,
        message: `Signal sent to terminate job ${jobId}.`,
      };
    }
    return {
      success: false,
      error: `Job ${jobId} not found or cannot be killed.`,
    };
  }
  const helpCommandDefinition = {
    commandName: "help",
    argValidation: {
      max: 1,
    },
    coreLogic: async (context) => {
      const { args } = context;
      let output = "OopisOS Help:\n\n";
      if (args.length === 0) {
        output += "Available commands:\n";
        Object.keys(commands)
            .sort()
            .forEach((cmd) => {
              output += `  ${cmd.padEnd(15)} ${
                  commands[cmd].description || ""
              }\n`;
            });
        output += "\nType 'help [command]' for more information.";
      } else {
        const cmdName = args[0].toLowerCase();
        if (commands[cmdName]?.helpText) {
          output = commands[cmdName].helpText;
        } else if (commands[cmdName]) {
          output = `No detailed help for '${cmdName}'.\nDesc: ${
              commands[cmdName].description || "N/A"
          }`;
        } else {
          return {
            success: false,
            error: `help: '${args[0]}' not found.`,
          };
        }
      }
      return {
        success: true,
        output: output,
      };
    },
  };
  const echoCommandDefinition = {
    commandName: "echo",
    coreLogic: async (context) => {
      return {
        success: true,
        output: context.args.join(" "),
      };
    },
  };
  const rebootCommandDefinition = {
    commandName: "reboot",
    argValidation: { exact: 0 },
    coreLogic: async () => {
      // <-- 'context' has been removed
      await OutputManager.appendToOutput(
          "Rebooting OopisOS (reloading browser page and clearing cache)...",
          {
            typeClass: Config.CSS_CLASSES.SUCCESS_MSG,
          }
      );
      setTimeout(() => {
        window.location.reload();
      }, 500);
      return { success: true, output: null };
    },
  };
  const groupdelCommandDefinition = {
    commandName: "groupdel",
    argValidation: { exact: 1, error: "Usage: groupdel <groupname>" },
    coreLogic: async (context) => {
      const { args, currentUser } = context;
      const groupName = args[0];

      if (currentUser !== "root") {
        return { success: false, error: "groupdel: only root can delete groups." };
      }

      const result = GroupManager.deleteGroup(groupName);

      if (!result.success) {
        return { success: false, error: `groupdel: ${result.error}` };
      }

      return { success: true, output: `Group '${groupName}' deleted.`, messageType: Config.CSS_CLASSES.SUCCESS_MSG };
    },
  };
  const dateCommandDefinition = {
    commandName: "date",
    argValidation: {
      exact: 0,
    },
    coreLogic: async () => {
      return {
        success: true,
        output: new Date().toString(),
      };
    },
  };
  const pwdCommandDefinition = {
    commandName: "pwd",
    argValidation: {
      exact: 0,
    },
    coreLogic: async () => {
      return {
        success: true,
        output: FileSystemManager.getCurrentPath(),
      };
    },
  };
  const cdCommandDefinition = {
    commandName: "cd",
    argValidation: {
      exact: 1,
      error: "incorrect number of arguments",
    },
    pathValidation: [
      {
        argIndex: 0,
        options: {
          expectedType: Config.FILESYSTEM.DEFAULT_DIRECTORY_TYPE,
        },
      },
    ],
    permissionChecks: [
      {
        pathArgIndex: 0,
        permissions: ["execute"],
      },
    ],
    coreLogic: async (context) => {
      const { options } = context;
      const pathInfo = context.validatedPaths[0];
      if (FileSystemManager.getCurrentPath() === pathInfo.resolvedPath) {
        return {
          success: true,
          output: `${Config.MESSAGES.ALREADY_IN_DIRECTORY_PREFIX}${pathInfo.resolvedPath}${Config.MESSAGES.ALREADY_IN_DIRECTORY_SUFFIX} ${Config.MESSAGES.NO_ACTION_TAKEN}`,
          messageType: Config.CSS_CLASSES.CONSOLE_LOG_MSG,
        };
      }
      FileSystemManager.setCurrentPath(pathInfo.resolvedPath);
      if (options.isInteractive) {
        TerminalUI.updatePrompt();
      }
      return {
        success: true,
        output: "",
      };
    },
  };
  const mvCommandDefinition = {
    commandName: "mv",
    flagDefinitions: [
      {
        name: "force",
        short: "-f",
        long: "--force",
      },
      {
        name: "interactive",
        short: "-i",
        long: "--interactive",
      },
    ],
    argValidation: {
      exact: 2,
    },
    coreLogic: async (context) => {
      const { args, currentUser, flags, options } = context;
      const sourcePathArg = args[0];
      const destPathArg = args[1];
      const nowISO = new Date().toISOString();
      const isInteractiveEffective = flags.interactive && !flags.force;
      const sourceValidation = FileSystemManager.validatePath(
          "mv (source)",
          sourcePathArg,
          {
            disallowRoot: true,
          }
      );
      if (sourceValidation.error)
        return {
          success: false,
          error: sourceValidation.error,
        };
      const sourceNode = sourceValidation.node;
      const absSourcePath = sourceValidation.resolvedPath;
      const sourceParentPath =
          absSourcePath.substring(
              0,
              absSourcePath.lastIndexOf(Config.FILESYSTEM.PATH_SEPARATOR)
          ) || Config.FILESYSTEM.ROOT_PATH;
      const sourceParentNode =
          FileSystemManager.getNodeByPath(sourceParentPath);
      if (
          !sourceParentNode ||
          !FileSystemManager.hasPermission(sourceParentNode, currentUser, "write")
      ) {
        return {
          success: false,
          error: `mv: cannot move '${sourcePathArg}' from '${sourceParentPath}'${Config.MESSAGES.PERMISSION_DENIED_SUFFIX}`,
        };
      }
      const destValidation = FileSystemManager.validatePath(
          "mv (destination)",
          destPathArg,
          {
            allowMissing: true,
          }
      );
      if (
          destValidation.error &&
          !(destValidation.optionsUsed.allowMissing && !destValidation.node)
      ) {
        return {
          success: false,
          error: destValidation.error,
        };
      }
      let absDestPath = destValidation.resolvedPath;
      let destNode = destValidation.node;
      const sourceName = absSourcePath.substring(
          absSourcePath.lastIndexOf(Config.FILESYSTEM.PATH_SEPARATOR) + 1
      );
      let finalDestName = sourceName;
      let targetContainerNode;
      let targetContainerAbsPath;
      if (
          destNode &&
          destNode.type === Config.FILESYSTEM.DEFAULT_DIRECTORY_TYPE
      ) {
        targetContainerNode = destNode;
        targetContainerAbsPath = absDestPath;
        absDestPath = FileSystemManager.getAbsolutePath(
            sourceName,
            absDestPath
        );
        destNode = targetContainerNode.children[sourceName];
      } else {
        targetContainerAbsPath =
            absDestPath.substring(
                0,
                absDestPath.lastIndexOf(Config.FILESYSTEM.PATH_SEPARATOR)
            ) || Config.FILESYSTEM.ROOT_PATH;
        targetContainerNode = FileSystemManager.getNodeByPath(
            targetContainerAbsPath
        );
        finalDestName = absDestPath.substring(
            absDestPath.lastIndexOf(Config.FILESYSTEM.PATH_SEPARATOR) + 1
        );
      }
      if (
          !targetContainerNode ||
          targetContainerNode.type !== Config.FILESYSTEM.DEFAULT_DIRECTORY_TYPE
      ) {
        return {
          success: false,
          error: `mv: target '${targetContainerAbsPath}' is not a directory or does not exist.`,
        };
      }
      if (
          !FileSystemManager.hasPermission(
              targetContainerNode,
              currentUser,
              "write"
          )
      ) {
        return {
          success: false,
          error: `mv: cannot create item in '${targetContainerAbsPath}'${Config.MESSAGES.PERMISSION_DENIED_SUFFIX}`,
        };
      }
      if (absSourcePath === absDestPath) {
        return {
          success: true,
          output: `mv: '${sourcePathArg}' and '${destPathArg}' are the same file. ${Config.MESSAGES.NO_ACTION_TAKEN}`,
          messageType: Config.CSS_CLASSES.CONSOLE_LOG_MSG,
        };
      }
      if (destNode) {
        if (
            sourceNode.type === Config.FILESYSTEM.DEFAULT_DIRECTORY_TYPE &&
            destNode.type !== Config.FILESYSTEM.DEFAULT_DIRECTORY_TYPE
        ) {
          return {
            success: false,
            error: `mv: cannot overwrite non-directory '${absDestPath}' with directory '${sourcePathArg}'`,
          };
        }
        if (
            sourceNode.type !== Config.FILESYSTEM.DEFAULT_DIRECTORY_TYPE &&
            destNode.type === Config.FILESYSTEM.DEFAULT_DIRECTORY_TYPE
        ) {
          return {
            success: false,
            error: `mv: cannot overwrite directory '${absDestPath}' with non-directory '${sourcePathArg}'`,
          };
        }
        if (isInteractiveEffective) {
          const confirmed = await new Promise((resolve) => {
            ModalManager.request({
              context: "terminal",
              messageLines: [`Overwrite '${absDestPath}'?`],
              onConfirm: () => resolve(true),
              onCancel: () => resolve(false),
              options,
            });
          });
          if (!confirmed)
            return {
              success: true,
              output: `${Config.MESSAGES.OPERATION_CANCELLED} No changes made.`,
              messageType: Config.CSS_CLASSES.CONSOLE_LOG_MSG,
            };
        } else if (!flags.force) {
          return {
            success: false,
            error: `mv: '${absDestPath}' already exists. Use -f to overwrite or -i to prompt.`,
          };
        }
      }
      if (
          sourceNode.type === Config.FILESYSTEM.DEFAULT_DIRECTORY_TYPE &&
          absDestPath.startsWith(absSourcePath + Config.FILESYSTEM.PATH_SEPARATOR)
      ) {
        return {
          success: false,
          error: `mv: cannot move '${sourcePathArg}' to a subdirectory of itself, '${absDestPath}'`,
        };
      }
      const movedNode = Utils.deepCopyNode(sourceNode);
      movedNode.mtime = nowISO;
      targetContainerNode.children[finalDestName] = movedNode;
      targetContainerNode.mtime = nowISO;
      if (
          sourceParentNode &&
          sourceParentNode.children &&
          sourceParentNode.children[sourceName]
      ) {
        delete sourceParentNode.children[sourceName];
        sourceParentNode.mtime = nowISO;
      } else {
        delete targetContainerNode.children[finalDestName];
        console.error(
            Config.INTERNAL_ERRORS.SOURCE_NOT_FOUND_IN_PARENT_PREFIX +
            sourceName +
            Config.INTERNAL_ERRORS.SOURCE_NOT_FOUND_IN_PARENT_MIDDLE +
            sourceParentPath +
            Config.INTERNAL_ERRORS.SOURCE_NOT_FOUND_IN_PARENT_SUFFIX
        );
        return {
          success: false,
          error: `mv: Internal error - source item not found for removal after copy part of move.`,
        };
      }
      if (!(await FileSystemManager.save(currentUser))) {
        return {
          success: false,
          error: "mv: Failed to save file system changes.",
        };
      }
      return {
        success: true,
        output: `${Config.MESSAGES.MOVED_PREFIX}${sourcePathArg}${Config.MESSAGES.MOVED_TO}'${absDestPath}'${Config.MESSAGES.MOVED_SUFFIX}`,
        messageType: Config.CSS_CLASSES.SUCCESS_MSG,
      };
    },
  };
  const editCommandDefinition = {
    commandName: "edit",
    argValidation: {
      exact: 1,
      error: "expects exactly one filename.",
    },
    pathValidation: [
      {
        argIndex: 0,
        options: {
          allowMissing: true,
          disallowRoot: true,
          expectedType: "file",
        },
      },
    ],
    permissionChecks: [
      {
        pathArgIndex: 0,
        permissions: ["read"],
      },
    ],
    coreLogic: async (context) => {
      const { options, validatedPaths } = context;
      if (!options.isInteractive) {
        return {
          success: false,
          error: "edit: Can only be run in interactive mode.",
        };
      }
      const pathInfo = validatedPaths[0];
      const resolvedPath = pathInfo.resolvedPath;
      const content = pathInfo.node ? pathInfo.node.content || "" : "";
      EditorManager.enter(resolvedPath, content);
      return {
        success: true,
        output: `Opening editor for '${resolvedPath}'...`,
        messageType: Config.CSS_CLASSES.EDITOR_MSG,
      };
    },
  };
  const useraddCommandDefinition = {
    commandName: "useradd",
    argValidation: {
      exact: 1,
      error: "expects exactly one argument (username)",
    },
    coreLogic: async (context) => {
      const { args, options } = context;
      const username = args[0];
      const userCheck = StorageManager.loadItem(
          Config.STORAGE_KEYS.USER_CREDENTIALS,
          "User list",
          {}
      );
      if (userCheck[username]) {
        return {
          success: false,
          error: `User '${username}' already exists.`,
        };
      }
      try {
        const firstPassword = await new Promise((resolve, reject) => {
          ModalInputManager.requestInput(
              Config.MESSAGES.PASSWORD_PROMPT,
              (pwd) => resolve(pwd),
              () => reject(new Error(Config.MESSAGES.OPERATION_CANCELLED)),
              true, // isObscured
              options // Pass context for scripting
          );
        });
        if (firstPassword.trim() === "") {
          await OutputManager.appendToOutput(
              "Registering user with no password.",
              {
                typeClass: Config.CSS_CLASSES.CONSOLE_LOG_MSG,
              }
          );
        } else {
          const confirmedPassword = await new Promise((resolve, reject) => {
            ModalInputManager.requestInput(
                Config.MESSAGES.PASSWORD_CONFIRM_PROMPT,
                (pwd) => resolve(pwd),
                () => reject(new Error(Config.MESSAGES.OPERATION_CANCELLED)),
                true, // isObscured
                options // Pass context for scripting
            );
          });
          if (firstPassword !== confirmedPassword) {
            return {
              success: false,
              error: Config.MESSAGES.PASSWORD_MISMATCH,
            };
          }
        }
        const registerResult = await UserManager.register(
            username,
            firstPassword || null
        );
        // Add the missing confirmation message on success
        if (registerResult.success) {
          await OutputManager.appendToOutput(registerResult.message, {
            typeClass: Config.CSS_CLASSES.SUCCESS_MSG,
          });
          return {
            success: true,
            output: "",
          };
          // Return empty output as message is already printed
        } else {
          return {
            success: false,
            error: registerResult.error,
          };
        }
      } catch (e) {
        if (e.message === Config.MESSAGES.OPERATION_CANCELLED) {
          return {
            success: true,
            output: Config.MESSAGES.OPERATION_CANCELLED,
            messageType: Config.CSS_CLASSES.CONSOLE_LOG_MSG,
          };
        }
        return {
          success: false,
          error: `useradd: ${e.message}`,
        };
      }
    },
  };
  const loginCommandDefinition = {
    commandName: "login",
    completionType: "users",
    argValidation: {
      min: 1,
      max: 2,
      error: "Usage: login <username> [password]",
    },
    coreLogic: async (context) => {
      const { args, options } = context;
      const username = args[0];
      const providedPassword = args.length === 2 ? args[1] : null;
      return _handleUserSwitch("login", username, providedPassword, options);
    },
  };
  const logoutCommandDefinition = {
    commandName: "logout",
    argValidation: {
      exact: 0,
    },
    coreLogic: async () => {
      const result = await UserManager.logout();
      if (result.success && !result.noAction) {
        OutputManager.clearOutput();
        await OutputManager.appendToOutput(
            `${Config.MESSAGES.WELCOME_PREFIX} ${
                UserManager.getCurrentUser().name
            }${Config.MESSAGES.WELCOME_SUFFIX}`
        );
      }
      return {
        ...result,
        output: result.message,
        messageType: result.success
            ? Config.CSS_CLASSES.SUCCESS_MSG
            : Config.CSS_CLASSES.CONSOLE_LOG_MSG,
      };
    },
  };
  const whoamiCommandDefinition = {
    commandName: "whoami",
    argValidation: {
      exact: 0,
    },
    coreLogic: async () => {
      return {
        success: true,
        output: UserManager.getCurrentUser().name,
      };
    },
  };
  const exportCommandDefinition = {
    commandName: "export",
    argValidation: {
      exact: 1,
      error: "expects exactly one file path.",
    },
    pathValidation: [
      {
        argIndex: 0,
        options: {
          expectedType: Config.FILESYSTEM.DEFAULT_FILE_TYPE,
        },
      },
    ],
    permissionChecks: [
      {
        pathArgIndex: 0,
        permissions: ["read"],
      },
    ],
    coreLogic: async (context) => {
      const pathInfo = context.validatedPaths[0];
      const fileNode = pathInfo.node;
      const fileName = pathInfo.resolvedPath.substring(
          pathInfo.resolvedPath.lastIndexOf(Config.FILESYSTEM.PATH_SEPARATOR) + 1
      );
      try {
        const blob = new Blob([fileNode.content || ""], {
          type: "text/plain;charset=utf-8",
        });
        const url = URL.createObjectURL(blob);
        const a = Utils.createElement("a", {
          href: url,
          download: fileName,
        });
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        return {
          success: true,
          output: `${Config.MESSAGES.EXPORTING_PREFIX}${fileName}${Config.MESSAGES.EXPORTING_SUFFIX}`,
          messageType: Config.CSS_CLASSES.SUCCESS_MSG,
        };
      } catch (e) {
        return {
          success: false,
          error: `export: Failed to download '${fileName}': ${e.message}`,
        };
      }
    },
  };
  const backupCommandDefinition = {
    commandName: "backup",
    argValidation: {
      exact: 0,
    },
    coreLogic: async () => {
      const currentUser = UserManager.getCurrentUser();
      const allKeys = StorageManager.getAllLocalStorageKeys();
      const automaticSessionStates = {};
      const manualSaveStates = {};
      // Gather all session state keys from localStorage
      allKeys.forEach((key) => {
        if (key.startsWith(Config.STORAGE_KEYS.USER_TERMINAL_STATE_PREFIX)) {
          automaticSessionStates[key] = StorageManager.loadItem(key);
        } else if (
            key.startsWith(Config.STORAGE_KEYS.MANUAL_TERMINAL_STATE_PREFIX)
        ) {
          manualSaveStates[key] = StorageManager.loadItem(key);
        }
      });
      // Construct the comprehensive backup object
      const backupData = {
        dataType: "OopisOS_System_State_Backup_v2.3",
        // Added a data type for validation
        osVersion: Config.OS.VERSION,
        timestamp: new Date().toISOString(),
        fsDataSnapshot: Utils.deepCopyNode(FileSystemManager.getFsData()),
        userCredentials: StorageManager.loadItem(
            Config.STORAGE_KEYS.USER_CREDENTIALS,
            "User Credentials",
            {}
        ),
        editorWordWrapEnabled: StorageManager.loadItem(
            Config.STORAGE_KEYS.EDITOR_WORD_WRAP_ENABLED,
            "Editor Word Wrap",
            false
        ),
        automaticSessionStates: automaticSessionStates,
        manualSaveStates: manualSaveStates,
      };
      const fileName = `OopisOS_System_Backup_${currentUser.name}_${new Date()
          .toISOString()
          .replace(/[:.]/g, "-")}.json`;
      try {
        const blob = new Blob([JSON.stringify(backupData, null, 2)], {
          type: "application/json",
        });
        const url = URL.createObjectURL(blob);
        const a = Utils.createElement("a", {
          href: url,
          download: fileName,
        });
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        return {
          success: true,
          output: `${Config.MESSAGES.BACKUP_CREATING_PREFIX}${fileName}${Config.MESSAGES.BACKUP_CREATING_SUFFIX}`,
          messageType: Config.CSS_CLASSES.SUCCESS_MSG,
        };
      } catch (e) {
        return {
          success: false,
          error: `backup: Failed to create or download backup file: ${e.message}`,
        };
      }
    },
  };
  const savefsCommandDefinition = {
    commandName: "savefs",
    argValidation: {
      exact: 0,
    },
    coreLogic: async (context) => {
      const { currentUser } = context;
      if (await FileSystemManager.save()) {
        return {
          success: true,
          output: `File system for '${currentUser}' saved.`,
          messageType: Config.CSS_CLASSES.SUCCESS_MSG,
        };
      } else {
        return {
          success: false,
          error: "savefs: Failed to save file system.",
        };
      }
    },
  };
  const suCommandDefinition = {
    commandName: "su",
    completionType: "users",
    argValidation: {
      max: 1,
    },
    coreLogic: async (context) => {
      const { args, currentUser, options } = context;
      const targetUser = args.length > 0 ? args[0] : "root";
      if (currentUser === targetUser) {
        return {
          success: true,
          output: `Already user '${currentUser}'.`,
          messageType: Config.CSS_CLASSES.CONSOLE_LOG_MSG,
        };
      }
      return _handleUserSwitch("su", targetUser, null, options);
    },
  };
  const clearfsCommandDefinition = {
    commandName: "clearfs",
    argValidation: {
      exact: 0,
    },
    coreLogic: async (context) => {
      const { options, currentUser } = context;
      if (!options.isInteractive) {
        return {
          success: false,
          error: "clearfs: Can only be run in interactive mode.",
        };
      }
      const username = currentUser;
      const userHomePath = `/home/${username}`;
      const confirmed = await new Promise((resolve) =>
          ModalManager.request({
            context: "terminal",
            messageLines: [
              `WARNING: This will permanently erase ALL files and directories in your home directory (${userHomePath}).`,
              "This action cannot be undone.",
              "Are you sure you want to clear your home directory?",
            ],
            onConfirm: () => resolve(true),
            onCancel: () => resolve(false),
            options,
          })
      );
      if (!confirmed) {
        return {
          success: true,
          output: `Home directory clear for '${username}' cancelled. No action taken.`,
          messageType: Config.CSS_CLASSES.CONSOLE_LOG_MSG,
        };
      }
      const homeDirNode = FileSystemManager.getNodeByPath(userHomePath);
      if (
          !homeDirNode ||
          homeDirNode.type !== Config.FILESYSTEM.DEFAULT_DIRECTORY_TYPE
      ) {
        return {
          success: false,
          error: `clearfs: Critical error - Could not find home directory for '${username}' at '${userHomePath}'.`,
        };
      }
      homeDirNode.children = {};
      homeDirNode.mtime = new Date().toISOString();
      if (!(await FileSystemManager.save())) {
        return {
          success: false,
          error:
              "clearfs: CRITICAL - Failed to save file system changes after clearing home directory.",
        };
      }
      const currentPath = FileSystemManager.getCurrentPath();
      if (currentPath.startsWith(userHomePath)) {
        FileSystemManager.setCurrentPath(userHomePath);
      }
      TerminalUI.updatePrompt();
      OutputManager.clearOutput();
      const successMessage = `Home directory for user '${username}' has been cleared.`;
      await OutputManager.appendToOutput(successMessage, {
        typeClass: Config.CSS_CLASSES.SUCCESS_MSG,
      });
      return {
        success: true,
        output: "",
      };
    },
  };
  const savestateCommandDefinition = {
    commandName: "savestate",
    argValidation: {
      exact: 0,
    },
    coreLogic: async () => {
      const result = await SessionManager.saveManualState();
      if (result.success) {
        return {
          success: true,
          output: result.message,
          messageType: Config.CSS_CLASSES.SUCCESS_MSG,
        };
      } else {
        return {
          success: false,
          error: result.error,
          messageType: Config.CSS_CLASSES.ERROR_MSG,
        };
      }
    },
  };
  const loadstateCommandDefinition = {
    commandName: "loadstate",
    argValidation: {
      exact: 0,
    },
    coreLogic: async () => {
      const result = await SessionManager.loadManualState();
      return {
        success: result.success,
        output: result.message,
        error: result.success
            ? undefined
            : result.message || "Failed to load state.",
        messageType: result.success
            ? Config.CSS_CLASSES.CONSOLE_LOG_MSG
            : Config.CSS_CLASSES.ERROR_MSG,
      };
    },
  };
  const resetCommandDefinition = {
    commandName: "reset",
    argValidation: {
      exact: 0,
    },
    coreLogic: async (context) => {
      const { options } = context;
      if (!options.isInteractive) {
        return {
          success: false,
          error: "reset: Can only be run in interactive mode.",
        };
      }
      const confirmed = await new Promise((resolve) =>
          ModalManager.request({
            context: "terminal",
            messageLines: [
              "WARNING: This will erase ALL OopisOS data, including all users, file systems, and saved states. This action cannot be undone. Are you sure?",
            ],
            onConfirm: () => resolve(true),
            onCancel: () => resolve(false),
            options,
          })
      );
      if (confirmed) {
        await SessionManager.performFullReset();
        return {
          success: true,
          output:
              "OopisOS reset to initial state. Please refresh the page if UI issues persist.",
          messageType: Config.CSS_CLASSES.SUCCESS_MSG,
        };
      } else {
        return {
          success: true,
          output: `Reset cancelled. ${Config.MESSAGES.NO_ACTION_TAKEN}`,
          messageType: Config.CSS_CLASSES.CONSOLE_LOG_MSG,
        };
      }
    },
  };
  const runCommandDefinition = {
    commandName: "run",
    argValidation: {
      min: 1,
    },
    pathValidation: [
      {
        argIndex: 0,
        options: {
          expectedType: Config.FILESYSTEM.DEFAULT_FILE_TYPE,
        },
      },
    ],
    permissionChecks: [
      {
        pathArgIndex: 0,
        permissions: ["read", "execute"],
      },
    ],
    coreLogic: async (context) => {
      const { args, options, signal } = context;
      const scriptPathArg = args[0];
      const scriptArgs = args.slice(1);
      const scriptNode = context.validatedPaths[0].node;
      const fileExtension = Utils.getFileExtension(scriptPathArg);

      if (fileExtension !== "sh") {
        return { success: false, error: `run: '${scriptPathArg}' is not a shell script (.sh) file.` };
      }
      if (!scriptNode.content) {
        return { success: true, output: `run: Script '${scriptPathArg}' is empty.` };
      }
      if (CommandExecutor.isScriptRunning() && options.isInteractive) {
        return { success: false, error: "run: Cannot execute a script while another is already running in interactive mode." };
      }

      const rawScriptLines = scriptNode.content.split('\n');

      const scriptingContext = {
        isScripting: true,
        waitingForInput: false,
        inputCallback: null,
        cancelCallback: null,
        lines: rawScriptLines,
        currentLineIndex: 0,
      };

      const previousScriptExecutionState = CommandExecutor.isScriptRunning();
      CommandExecutor.setScriptExecutionInProgress(true);
      if (options.isInteractive) TerminalUI.setInputState(false);

      let overallScriptSuccess = true;

      while (scriptingContext.currentLineIndex < scriptingContext.lines.length) {
        if (signal?.aborted) {
          overallScriptSuccess = false;
          await OutputManager.appendToOutput(`Script '${scriptPathArg}' cancelled.`, { typeClass: Config.CSS_CLASSES.WARNING_MSG });
          if (scriptingContext.cancelCallback) scriptingContext.cancelCallback();
          break;
        }

        let line = scriptingContext.lines[scriptingContext.currentLineIndex].trim();
        const originalLineForError = scriptingContext.lines[scriptingContext.currentLineIndex];

        if (line.startsWith('#') || line.startsWith('#!') || line === '') {
          scriptingContext.currentLineIndex++;
          continue;
        }

        if (scriptingContext.waitingForInput) {
          if (scriptingContext.inputCallback) {
            await scriptingContext.inputCallback(line);
          }
          scriptingContext.currentLineIndex++;
          continue;
        }

        let processedLine = originalLineForError;
        for (let i = 0; i < scriptArgs.length; i++) {
          processedLine = processedLine.replace(new RegExp(`\\$${i + 1}`, 'g'), scriptArgs[i]);
        }
        processedLine = processedLine.replace(/\$@/g, scriptArgs.map(arg => arg.includes(" ") ? `"${arg}"` : arg).join(" "));
        processedLine = processedLine.replace(/\$#/g, scriptArgs.length.toString());

        const result = await CommandExecutor.processSingleCommand(processedLine.trim(), false, scriptingContext);
        scriptingContext.currentLineIndex++;

        if (scriptingContext.waitingForInput) {
          continue;
        }

        if (!result || !result.success) {
          const errorMsg = `Script '${scriptPathArg}' error on line: ${originalLineForError}\nError: ${result.error || 'Unknown error.'}`;
          await OutputManager.appendToOutput(errorMsg, { typeClass: Config.CSS_CLASSES.ERROR_MSG });
          overallScriptSuccess = false;
          break;
        }
      }

      CommandExecutor.setScriptExecutionInProgress(previousScriptExecutionState);
      if (options.isInteractive && !CommandExecutor.isScriptRunning()) {
        TerminalUI.setInputState(true);
      }

      return {
        success: overallScriptSuccess,
        error: overallScriptSuccess ? null : `Script '${scriptPathArg}' failed.`
      };
    }
  };
  const delayCommandDefinition = {
    commandName: "delay",
    argValidation: {
      exact: 1,
    },
    coreLogic: async (context) => {
      const { args, options, signal } = context;
      const parsedArg = Utils.parseNumericArg(args[0], {
        allowFloat: false,
        allowNegative: false,
        min: 1,
      });

      if (parsedArg.error) {
        return {
          success: false,
          error: `delay: Invalid delay time '${args[0]}': ${parsedArg.error}. Must be a positive integer.`,
        };
      }

      const ms = parsedArg.value;

      if (options.isInteractive && !CommandExecutor.isScriptRunning()) {
        await OutputManager.appendToOutput(`Delaying for ${ms}ms...`);
      }

      if (signal?.aborted) {
        return { success: false, error: `delay: Operation already cancelled.` };
      }

      const delayPromise = new Promise((resolve) => setTimeout(resolve, ms));

      const abortPromise = new Promise((_, reject) => {
        if (!signal) return;
        signal.addEventListener(
            "abort",
            () => {
              reject(
                  new Error(`Operation cancelled. (Reason: ${signal.reason})`)
              );
            },
            { once: true }
        );
      });

      try {
        await Promise.race([delayPromise, abortPromise]);

        if (options.isInteractive && !CommandExecutor.isScriptRunning()) {
          await OutputManager.appendToOutput(`Delay complete.`);
        }
        return { success: true, output: "" };
      } catch (e) {
        return { success: false, error: `delay: ${e.message}` };
      }
    },
  };
  const psCommandDefinition = {
    commandName: "ps",
    argValidation: {
      exact: 0,
    },
    coreLogic: async () => {
      const jobs = CommandExecutor.getActiveJobs();
      const jobIds = Object.keys(jobs);
      if (jobIds.length === 0) {
        return {
          success: true,
          output: "No active background jobs.",
        };
      }
      let outputLines = ["  PID   COMMAND"];
      jobIds.forEach((id) => {
        const job = jobs[id];
        outputLines.push(`  ${String(id).padEnd(5)} ${job.command}`);
      });
      return {
        success: true,
        output: outputLines.join("\n"),
      };
    },
  };
  const killCommandDefinition = {
    commandName: "kill",
    argValidation: {
      exact: 1,
      error: "Usage: kill <job_id>",
    },
    coreLogic: async (context) => {
      const { args } = context;
      const jobId = parseInt(args[0], 10);
      if (isNaN(jobId)) {
        return {
          success: false,
          error: `kill: invalid job ID: ${args[0]}`,
        };
      }
      const result = CommandExecutor.killJob(jobId);
      return {
        success: result.success,
        output: result.message || "",
        error: result.error || null,
        messageType: result.success
            ? Config.CSS_CLASSES.SUCCESS_MSG
            : Config.CSS_CLASSES.ERROR_MSG,
      };
    },
  };
  const check_failCommandDefinition = {
    commandName: "check_fail",
    argValidation: {
      exact: 1,
      error: "expects exactly one argument (a command string)",
    },
    coreLogic: async (context) => {
      const { args } = context;
      const commandToTest = args[0];
      if (typeof commandToTest !== "string" || commandToTest.trim() === "") {
        return {
          success: false,
          error: "check_fail: command string argument cannot be empty",
        };
      }
      const testResult = await CommandExecutor.processSingleCommand(
          commandToTest,
          false
      );
      if (testResult.success) {
        const failureMessage = `CHECK_FAIL: FAILURE - Command <${commandToTest}> unexpectedly SUCCEEDED.`;
        return {
          success: false,
          error: failureMessage,
        };
      } else {
        const successMessage = `CHECK_FAIL: SUCCESS - Command <${commandToTest}> failed as expected. (Error: ${
            testResult.error || "N/A"
        })`;
        return {
          success: true,
          output: successMessage,
        };
      }
    },
  };
  const removeuserCommandDefinition = {
    commandName: "removeuser",
    completionType: "users",
    flagDefinitions: [
      {
        name: "force",
        short: "-f",
        long: "--force",
      },
    ],
    argValidation: {
      exact: 1,
      error: "Usage: removeuser [-f] <username>",
    },
    coreLogic: async (context) => {
      const { args, currentUser, flags, options } = context;
      const usernameToRemove = args[0];

      if (usernameToRemove === currentUser) {
        return {
          success: false,
          error: "removeuser: You cannot remove yourself.",
        };
      }
      if (usernameToRemove === Config.USER.DEFAULT_NAME) {
        return {
          success: false,
          error: `removeuser: Cannot remove the default '${Config.USER.DEFAULT_NAME}' user.`,
        };
      }

      const users = StorageManager.loadItem(
          Config.STORAGE_KEYS.USER_CREDENTIALS,
          "User list",
          {}
      );
      if (!users.hasOwnProperty(usernameToRemove)) {
        return {
          success: true,
          output: `removeuser: User '${usernameToRemove}' does not exist. No action taken.`,
          messageType: Config.CSS_CLASSES.CONSOLE_LOG_MSG,
        };
      }

      let confirmed = false;
      if (flags.force) {
        confirmed = true;
      } else if (options.isInteractive) {
        confirmed = await new Promise((resolve) => {
          ModalManager.request({
            context: "terminal",
            messageLines: [
              `WARNING: This will permanently remove user '${usernameToRemove}' and all their data (home directory, saved sessions). This cannot be undone. Are you sure?`,
            ],
            onConfirm: () => resolve(true),
            onCancel: () => resolve(false),
            options,
          });
        });
      } else {
        return {
          success: false,
          error: `removeuser: '${usernameToRemove}' requires confirmation. Use the -f flag in non-interactive scripts.`,
        };
      }

      if (!confirmed) {
        return {
          success: true,
          output: `Removal of user '${usernameToRemove}' cancelled.`,
          messageType: Config.CSS_CLASSES.CONSOLE_LOG_MSG,
        };
      }

      let allDeletionsSuccessful = true;
      let errorMessages = [];
      let changesMade = false;

      const userHomePath = `/home/${usernameToRemove}`;
      if (FileSystemManager.getNodeByPath(userHomePath)) {
        const rmResult = await FileSystemManager.deleteNodeRecursive(
            userHomePath,
            {
              force: true,
              currentUser: currentUser,
            }
        );
        if (!rmResult.success) {
          allDeletionsSuccessful = false;
          errorMessages.push(...rmResult.messages);
        }
        if (rmResult.anyChangeMade) {
          changesMade = true;
        }
      }
      GroupManager.removeUserFromAllGroups(usernameToRemove);

      if (!SessionManager.clearUserSessionStates(usernameToRemove)) {
        allDeletionsSuccessful = false;
        errorMessages.push(
            "Failed to clear user session states and credentials."
        );
      }

      if (changesMade) {
        await FileSystemManager.save();
      }

      if (allDeletionsSuccessful) {
        return {
          success: true,
          output: `User '${usernameToRemove}' and all associated data have been removed.`,
          messageType: Config.CSS_CLASSES.SUCCESS_MSG,
        };
      } else {
        return {
          success: false,
          error: `removeuser: Failed to completely remove user '${usernameToRemove}'. Details: ${errorMessages.join(
              "; "
          )}`,
        };
      }
    },
  };
  const chmodCommandDefinition = {
    commandName: "chmod",
    argValidation: {
      exact: 2,
      error: "Usage: chmod <mode> <path>",
    },
    pathValidation: [
      {
        argIndex: 1,
      },
    ],
    coreLogic: async (context) => {
      const { args, currentUser, validatedPaths } = context;
      const modeArg = args[0];
      const pathArg = args[1];
      const pathInfo = validatedPaths[1];
      const node = pathInfo.node;
      const nowISO = new Date().toISOString();

      if (!/^[0-7]{3,4}$/.test(modeArg)) {
        return {
          success: false,
          error: `chmod: invalid mode: ‘${modeArg}’ (must be 3 or 4 octal digits)`,
        };
      }
      const newMode = parseInt(modeArg, 8);

      if (currentUser !== "root") {
        if (node.owner !== currentUser) {
          return {
            success: false,
            error: `chmod: changing permissions of '${pathArg}': Operation not permitted`,
          };
        }
        if (!FileSystemManager.hasPermission(node, currentUser, "write")) {
          return {
            success: false,
            error: `chmod: cannot change permissions of '${pathArg}': Permission denied`,
          };
        }
      }

      node.mode = newMode;
      node.mtime = nowISO;
      FileSystemManager._updateNodeAndParentMtime(
          pathInfo.resolvedPath,
          nowISO
      );

      if (!(await FileSystemManager.save())) {
        return {
          success: false,
          error: "chmod: Failed to save file system changes.",
        };
      }
      return {
        success: true,
        output: `Permissions of '${pathArg}' changed to ${modeArg}`,
        messageType: Config.CSS_CLASSES.SUCCESS_MSG,
      };
    },
  };
  const chownCommandDefinition = {
    commandName: "chown",
    completionType: "users",
    argValidation: {
      exact: 2,
      error: "Usage: chown <new_owner> <path>",
    },
    pathValidation: [
      {
        argIndex: 1,
      },
    ],
    permissionChecks: [],
    coreLogic: async (context) => {
      const { args, currentUser, validatedPaths } = context;
      const newOwnerArg = args[0];
      const pathArg = args[1];
      const pathInfo = validatedPaths[1];
      const node = pathInfo.node;
      const nowISO = new Date().toISOString();
      const users = StorageManager.loadItem(
          Config.STORAGE_KEYS.USER_CREDENTIALS,
          "User list",
          {}
      );
      if (!users[newOwnerArg] && newOwnerArg !== Config.USER.DEFAULT_NAME) {
        return {
          success: false,
          error: `chown: user '${newOwnerArg}' does not exist.`,
        };
      }
      if (currentUser !== "root") {
        return {
          success: false,
          error: `chown: changing ownership of '${pathArg}'${Config.MESSAGES.PERMISSION_DENIED_SUFFIX} (only root can change ownership)`,
        };
      }
      node.owner = newOwnerArg;
      node.mtime = nowISO;
      FileSystemManager._updateNodeAndParentMtime(
          pathInfo.resolvedPath,
          nowISO
      );
      if (!(await FileSystemManager.save(currentUser))) {
        return {
          success: false,
          error: "chown: Failed to save file system changes.",
        };
      }
      return {
        success: true,
        output: `Owner of '${pathArg}' changed to ${newOwnerArg}`,
        messageType: Config.CSS_CLASSES.SUCCESS_MSG,
      };
    },
  };
  const listusersCommandDefinition = {
    commandName: "listusers",
    argValidation: {
      exact: 0,
    },
    coreLogic: async () => {
      const users = StorageManager.loadItem(
          Config.STORAGE_KEYS.USER_CREDENTIALS,
          "User list",
          {}
      );
      const userNames = Object.keys(users);
      if (!userNames.includes(Config.USER.DEFAULT_NAME)) {
        userNames.push(Config.USER.DEFAULT_NAME);
      }
      userNames.sort();
      if (userNames.length === 0)
        return {
          success: true,
          output: "No users registered.",
          messageType: Config.CSS_CLASSES.CONSOLE_LOG_MSG,
        };
      return {
        success: true,
        output:
            "Registered users:\n" + userNames.map((u) => `  ${u}`).join("\n"),
      };
    },
  };
  const clearCommandDefinition = {
    commandName: "clear",
    argValidation: {
      exact: 0,
    },
    coreLogic: async (context) => {
      if (context.options.isInteractive) {
        OutputManager.clearOutput();
      }
      return {
        success: true,
        output: "",
      };
    },
  };
  const printscreenCommandDefinition = {
    commandName: "printscreen",
    argValidation: {
      exact: 1,
      error: "Usage: printscreen <filepath>",
    },
    pathValidation: [
      {
        argIndex: 0,
        options: {
          allowMissing: true,
          disallowRoot: true,
        },
      },
    ],
    coreLogic: async (context) => {
      const { args, currentUser, validatedPaths } = context;
      const filePathArg = args[0];
      const pathInfo = validatedPaths[0];
      const resolvedPath = pathInfo.resolvedPath;
      const nowISO = new Date().toISOString();
      if (resolvedPath === Config.FILESYSTEM.ROOT_PATH) {
        return {
          success: false,
          error: `printscreen: Cannot save directly to root ('${Config.FILESYSTEM.ROOT_PATH}'). Please specify a filename.`,
        };
      }
      if (resolvedPath.endsWith(Config.FILESYSTEM.PATH_SEPARATOR)) {
        return {
          success: false,
          error: `printscreen: Target path '${filePathArg}' must be a file, not a directory path (ending with '${Config.FILESYSTEM.PATH_SEPARATOR}').`,
        };
      }
      const outputContent = DOM.outputDiv ? DOM.outputDiv.innerText : "";
      const existingNode = pathInfo.node;
      if (existingNode) {
        if (existingNode.type === Config.FILESYSTEM.DEFAULT_DIRECTORY_TYPE) {
          return {
            success: false,
            error: `printscreen: Cannot overwrite directory '${filePathArg}'.`,
          };
        }
        if (
            !FileSystemManager.hasPermission(existingNode, currentUser, "write")
        ) {
          return {
            success: false,
            error: `printscreen: '${filePathArg}'${Config.MESSAGES.PERMISSION_DENIED_SUFFIX}`,
          };
        }
        existingNode.content = outputContent;
      } else {
        const parentDirResult =
            FileSystemManager.createParentDirectoriesIfNeeded(resolvedPath);
        if (parentDirResult.error) {
          return {
            success: false,
            error: `printscreen: ${parentDirResult.error}`,
          };
        }
        const parentNodeForCreation = parentDirResult.parentNode;
        const fileName = resolvedPath.substring(
            resolvedPath.lastIndexOf(Config.FILESYSTEM.PATH_SEPARATOR) + 1
        );
        if (!parentNodeForCreation) {
          console.error(
              "printscreen: parentNodeForCreation is null despite createParentDirectoriesIfNeeded success."
          );
          return {
            success: false,
            error: `printscreen: Critical internal error obtaining parent directory for '${filePathArg}'.`,
          };
        }
        if (
            !FileSystemManager.hasPermission(
                parentNodeForCreation,
                currentUser,
                "write"
            )
        ) {
          return {
            success: false,
            error: `printscreen: Cannot create file in '${FileSystemManager.getAbsolutePath(
                fileName,
                parentNodeForCreation.path
            )}', permission denied in parent.`,
          };
        }
        const primaryGroup = UserManager.getPrimaryGroupForUser(currentUser);
        if (!primaryGroup) {
          return {
            success: false,
            error:
                "printscreen: critical - could not determine primary group for user.",
          };
        }
        parentNodeForCreation.children[fileName] = {
          type: Config.FILESYSTEM.DEFAULT_FILE_TYPE,
          content: outputContent,
          owner: currentUser,
          group: primaryGroup,
          mode: Config.FILESYSTEM.DEFAULT_FILE_MODE,
          mtime: nowISO,
        };
      }
      FileSystemManager._updateNodeAndParentMtime(resolvedPath, nowISO);
      if (!(await FileSystemManager.save(currentUser))) {
        return {
          success: false,
          error: "printscreen: Failed to save file system changes.",
        };
      }
      return {
        success: true,
        output: `Terminal output saved to '${resolvedPath}'`,
        messageType: Config.CSS_CLASSES.SUCCESS_MSG,
      };
    },
  };
  const adventureCommandDefinition = {
    commandName: "adventure",
    argValidation: {
      max: 1,
      error: "Usage: adventure [path_to_adventure_file.json]",
    },
    pathValidation: [
      {
        argIndex: 0,
        optional: true,
        options: {
          allowMissing: true,
          expectedType: Config.FILESYSTEM.DEFAULT_FILE_TYPE,
        },
      },
    ],
    coreLogic: async (context) => {
      const { args, currentUser, validatedPaths, options } = context;

      if (
          typeof TextAdventureModal === "undefined" ||
          typeof TextAdventureModal.isActive !== "function"
      ) {
        return {
          success: false,
          error:
              "Adventure UI (TextAdventureModal) is not available. Check console for JS errors.",
        };
      }
      if (
          typeof TextAdventureEngine === "undefined" ||
          typeof TextAdventureEngine.startAdventure !== "function"
      ) {
        return {
          success: false,
          error:
              "Adventure Engine (TextAdventureEngine) is not available. Check console for JS errors.",
        };
      }
      if (TextAdventureModal.isActive()) {
        return {
          success: false,
          error:
              "An adventure is already in progress. Type 'quit' or 'exit' in the adventure window to leave the current game.",
        };
      }

      let adventureToLoad;

      if (args.length > 0) {
        const filePath = args[0];
        const pathInfo = validatedPaths[0];

        if (pathInfo.error) {
          return { success: false, error: pathInfo.error };
        }

        const fileNode = pathInfo.node;
        if (fileNode) {
          if (!FileSystemManager.hasPermission(fileNode, currentUser, "read")) {
            return {
              success: false,
              error: `adventure: Cannot read file '${filePath}'${Config.MESSAGES.PERMISSION_DENIED_SUFFIX}`,
            };
          }
          try {
            const parsedAdventure = JSON.parse(fileNode.content);
            if (!parsedAdventure.rooms || !parsedAdventure.startingRoomId || !parsedAdventure.items) {
              return {
                success: false,
                error: `adventure: Invalid adventure file format in '${filePath}'. Missing essential parts like rooms, items, or startingRoomId.`,
              };
            }
            if (!parsedAdventure.title) parsedAdventure.title = filePath;
            adventureToLoad = parsedAdventure;
          } catch (e) {
            return {
              success: false,
              error: `adventure: Error parsing adventure file '${filePath}': ${e.message}`,
            };
          }
        } else {
          return {
            success: false,
            error: `adventure: File not found at '${filePath}'.`,
          };
        }
      } else {
        if (typeof window.sampleAdventure !== "undefined") {
          adventureToLoad = window.sampleAdventure;
        } else {
          console.warn(
              "adventure command: No adventure file specified and window.sampleAdventure not found, using minimal fallback."
          );
          adventureToLoad = {
            title: "Fallback Sample Adventure",
            startingRoomId: "room1",
            rooms: {
              room1: {
                id: "room1",
                name: "A Plain Room",
                description: "You are in a plain room. There are no exits.",
                exits: {},
              },
            },
            items: {},
          };
        }
      }

      // We need to pass the scripting context to the adventure engine
      // This is a conceptual change; the adventure engine would need to be adapted
      // to accept this context and use it for its own input prompts (save/load).
      TextAdventureEngine.startAdventure(adventureToLoad, options);

      return {
        success: true,
        output: `Launching adventure: "${
            adventureToLoad.title || "Untitled Adventure"
        }"...\n(Game interaction now happens in the adventure modal.)`,
        messageType: Config.CSS_CLASSES.CONSOLE_LOG_MSG,
      };
    },
  };
  const aliasCommandDefinition = {
    commandName: "alias",
    coreLogic: async (context) => {
      const { args } = context;
      if (args.length === 0) {
        const allAliases = AliasManager.getAllAliases();
        if (Object.keys(allAliases).length === 0) {
          return {
            success: true,
            output: "",
          };
        }
        const outputLines = [];
        for (const name in allAliases) {
          const value = allAliases[name];
          outputLines.push(`alias ${name}='${value}'`);
        }
        return {
          success: true,
          output: outputLines.sort().join("\n"),
        };
      }
      const combinedArg = args.join(" ");
      const eqIndex = combinedArg.indexOf("=");
      if (eqIndex !== -1) {
        const name = combinedArg.substring(0, eqIndex).trim();
        let value = combinedArg.substring(eqIndex + 1).trim();
        if (!name) {
          return {
            success: false,
            error: "alias: invalid format. Missing name.",
          };
        }
        if (
            (value.startsWith("'") && value.endsWith("'")) ||
            (value.startsWith('"') && value.endsWith('"'))
        ) {
          value = value.substring(1, value.length - 1);
        }
        if (AliasManager.setAlias(name, value)) {
          return {
            success: true,
            output: "",
          };
        }
        return {
          success: false,
          error: "alias: failed to set alias.",
        };
      }
      else {
        const outputLines = [];
        const errorLines = [];
        let allFound = true;
        for (const name of args) {
          const value = AliasManager.getAlias(name);
          if (value) {
            outputLines.push(`alias ${name}='${value}'`);
          } else {
            errorLines.push(`alias: ${name}: not found`);
            allFound = false;
          }
        }
        return {
          success: allFound,
          output: outputLines.join("\n"),
          error: allFound ? null : errorLines.join("\n"),
        };
      }
    },
  };
  const unaliasCommandDefinition = {
    commandName: "unalias",
    argValidation: {
      min: 1,
      error: "Usage: unalias <alias_name>...",
    },
    coreLogic: async (context) => {
      const { args } = context;
      let allSuccess = true;
      const errorMessages = [];
      for (const aliasName of args) {
        if (!AliasManager.removeAlias(aliasName)) {
          allSuccess = false;
          errorMessages.push(`unalias: no such alias: ${aliasName}`);
        }
      }
      if (allSuccess) {
        return {
          success: true,
          output: "",
        };
      } else {
        return {
          success: false,
          error: errorMessages.join("\n"),
        };
      }
    },
  };
  const lsCommandDefinition = {
    commandName: "ls",
    flagDefinitions: [
      {
        name: "long",
        short: "-l",
        long: "--long",
      },
      {
        name: "all",
        short: "-a",
        long: "--all",
      },
      {
        name: "recursive",
        short: "-R",
        long: "--recursive",
      },
      {
        name: "reverseSort",
        short: "-r",
        long: "--reverse",
      },
      {
        name: "sortByTime",
        short: "-t",
      },
      {
        name: "sortBySize",
        short: "-S",
      },
      {
        name: "sortByExtension",
        short: "-X",
      },
      {
        name: "noSort",
        short: "-U",
      },
      {
        name: "dirsOnly",
        short: "-d",
      },
    ],
    coreLogic: async (context) => {
      const { args, flags, currentUser } = context;

      function getItemDetails(itemName, itemNode, itemPath) {
        if (!itemNode) return null;
        return {
          name: itemName,
          path: itemPath,
          node: itemNode,
          type: itemNode.type,
          owner: itemNode.owner || "unknown",
          group: itemNode.group || "unknown",
          mode: itemNode.mode,
          mtime: itemNode.mtime ? new Date(itemNode.mtime) : new Date(0),
          size: FileSystemManager.calculateNodeSize(itemNode),
          extension: Utils.getFileExtension(itemName),
          linkCount: 1,
        };
      }

      function formatLongListItem(itemDetails) {
        const perms = FileSystemManager.formatModeToString(itemDetails.node);
        const owner = (itemDetails.node.owner || "unknown").padEnd(10);
        const group = (itemDetails.node.group || "unknown").padEnd(10);
        const size = Utils.formatBytes(itemDetails.size).padStart(8);
        let dateStr = "            ";
        if (itemDetails.mtime && itemDetails.mtime.getTime() !== 0) {
          const d = itemDetails.mtime;
          const months = [
            "Jan",
            "Feb",
            "Mar",
            "Apr",
            "May",
            "Jun",
            "Jul",
            "Aug",
            "Sep",
            "Oct",
            "Nov",
            "Dec",
          ];
          dateStr = `${months[d.getMonth()].padEnd(3)} ${d
              .getDate()
              .toString()
              .padStart(2, " ")} ${d.getHours().toString().padStart(2, "0")}:${d
              .getMinutes()
              .toString()
              .padStart(2, "0")}`;
        }
        const nameSuffix =
            itemDetails.type === Config.FILESYSTEM.DEFAULT_DIRECTORY_TYPE &&
            !flags.dirsOnly
                ? Config.FILESYSTEM.PATH_SEPARATOR
                : "";

        return `${perms}  ${String(itemDetails.linkCount).padStart(
            2
        )} ${owner}${group}${size} ${dateStr} ${itemDetails.name}${nameSuffix}`;
      }

      function sortItems(items, currentFlags) {
        let sortedItems = [...items];
        if (currentFlags.noSort) {
        } else if (currentFlags.sortByTime) {
          sortedItems.sort(
              (a, b) => b.mtime - a.mtime || a.name.localeCompare(b.name)
          );
        } else if (currentFlags.sortBySize) {
          sortedItems.sort(
              (a, b) => b.size - a.size || a.name.localeCompare(b.name)
          );
        } else if (currentFlags.sortByExtension) {
          sortedItems.sort((a, b) => {
            const extComp = a.extension.localeCompare(b.extension);
            if (extComp !== 0) return extComp;
            return a.name.localeCompare(b.name);
          });
        } else {
          sortedItems.sort((a, b) => a.name.localeCompare(b.name));
        }
        if (currentFlags.reverseSort) {
          sortedItems.reverse();
        }
        return sortedItems;
      }
      const pathsToList =
          args.length > 0 ? args : [FileSystemManager.getCurrentPath()];
      let outputBlocks = [];
      let overallSuccess = true;
      async function listSinglePathContents(targetPathArg, effectiveFlags) {
        const pathValidation = FileSystemManager.validatePath(
            "ls",
            targetPathArg
        );
        if (pathValidation.error)
          return {
            success: false,
            output: pathValidation.error,
          };
        const targetNode = pathValidation.node;
        if (!FileSystemManager.hasPermission(targetNode, currentUser, "read")) {
          return {
            success: false,
            output: `ls: cannot access '${targetPathArg}': Permission denied`,
          };
        }
        let itemDetailsList = [];
        let singleItemResultOutput = null;
        if (
            effectiveFlags.dirsOnly &&
            targetNode.type === Config.FILESYSTEM.DEFAULT_DIRECTORY_TYPE
        ) {
          const details = getItemDetails(
              targetPathArg,
              targetNode,
              pathValidation.resolvedPath
          );
          if (details)
            singleItemResultOutput = effectiveFlags.long
                ? formatLongListItem(details)
                : details.name;
          else
            return {
              success: false,
              output: `ls: cannot stat '${targetPathArg}': Error retrieving details`,
            };
        } else if (
            targetNode.type === Config.FILESYSTEM.DEFAULT_DIRECTORY_TYPE
        ) {
          const childrenNames = Object.keys(targetNode.children);
          for (const name of childrenNames) {
            if (!effectiveFlags.all && name.startsWith(".")) continue;
            const details = getItemDetails(
                name,
                targetNode.children[name],
                FileSystemManager.getAbsolutePath(
                    name,
                    pathValidation.resolvedPath
                )
            );
            if (details) itemDetailsList.push(details);
          }
          itemDetailsList = sortItems(itemDetailsList, effectiveFlags);
        } else {
          const fileName = pathValidation.resolvedPath.substring(
              pathValidation.resolvedPath.lastIndexOf(
                  Config.FILESYSTEM.PATH_SEPARATOR
              ) + 1
          );
          const details = getItemDetails(
              fileName,
              targetNode,
              pathValidation.resolvedPath
          );
          if (details)
            singleItemResultOutput = effectiveFlags.long
                ? formatLongListItem(details)
                : details.name;
          else
            return {
              success: false,
              output: `ls: cannot stat '${targetPathArg}': Error retrieving details`,
            };
        }
        let currentPathOutputLines = [];
        if (singleItemResultOutput !== null) {
          currentPathOutputLines.push(singleItemResultOutput);
        } else if (
            targetNode.type === Config.FILESYSTEM.DEFAULT_DIRECTORY_TYPE &&
            !effectiveFlags.dirsOnly
        ) {
          if (effectiveFlags.long && itemDetailsList.length > 0)
            currentPathOutputLines.push(`total ${itemDetailsList.length}`);
          itemDetailsList.forEach((item) => {
            const nameSuffix =
                item.type === Config.FILESYSTEM.DEFAULT_DIRECTORY_TYPE
                    ? Config.FILESYSTEM.PATH_SEPARATOR
                    : "";
            currentPathOutputLines.push(
                effectiveFlags.long
                    ? formatLongListItem(item)
                    : `${item.name}${nameSuffix}`
            );
          });
        }
        return {
          success: true,
          output: currentPathOutputLines.join("\n"),
          items: itemDetailsList,
        };
      }
      async function displayRecursive(currentPath, displayFlags, depth = 0) {
        let blockOutputs = [];
        let encounteredErrorInThisBranch = false;
        if (depth > 0 || pathsToList.length > 1)
          blockOutputs.push(`${currentPath}:`);
        const listResult = await listSinglePathContents(
            currentPath,
            displayFlags
        );
        if (!listResult.success) {
          blockOutputs.push(listResult.output);
          encounteredErrorInThisBranch = true;
          return {
            outputs: blockOutputs,
            encounteredError: encounteredErrorInThisBranch,
          };
        }
        if (listResult.output) blockOutputs.push(listResult.output);
        if (
            listResult.items &&
            FileSystemManager.getNodeByPath(currentPath)?.type ===
            Config.FILESYSTEM.DEFAULT_DIRECTORY_TYPE
        ) {
          const subdirectories = listResult.items.filter(
              (item) =>
                  item.type === Config.FILESYSTEM.DEFAULT_DIRECTORY_TYPE &&
                  item.name !== "." &&
                  item.name !== ".."
          );
          for (const dirItem of subdirectories) {
            if (blockOutputs.length > 0) blockOutputs.push("");
            const subDirResult = await displayRecursive(
                dirItem.path,
                displayFlags,
                depth + 1
            );
            blockOutputs = blockOutputs.concat(subDirResult.outputs);
            if (subDirResult.encounteredError)
              encounteredErrorInThisBranch = true;
          }
        }
        return {
          outputs: blockOutputs,
          encounteredError: encounteredErrorInThisBranch,
        };
      }
      if (flags.recursive) {
        for (let i = 0; i < pathsToList.length; i++) {
          const path = pathsToList[i];
          const recursiveResult = await displayRecursive(path, flags);
          outputBlocks = outputBlocks.concat(recursiveResult.outputs);
          if (recursiveResult.encounteredError) overallSuccess = false;
          if (i < pathsToList.length - 1) outputBlocks.push("");
        }
      } else {
        for (let i = 0; i < pathsToList.length; i++) {
          const path = pathsToList[i];
          if (pathsToList.length > 1) {
            if (i > 0) outputBlocks.push("");
            outputBlocks.push(`${path}:`);
          }
          const listResult = await listSinglePathContents(path, flags);
          if (!listResult.success) overallSuccess = false;
          if (listResult.output) outputBlocks.push(listResult.output);
        }
      }
      return {
        success: overallSuccess,
        output: outputBlocks.join("\n"),
      };
    },
  };
  const mkdirCommandDefinition = {
    commandName: "mkdir",
    flagDefinitions: [
      {
        name: "parents",
        short: "-p",
        long: "--parents",
      },
    ],
    argValidation: {
      min: 1,
    },
    coreLogic: async (context) => {
      const { args, flags, currentUser } = context;
      let allSuccess = true;
      const messages = [];
      let changesMade = false;
      const nowISO = new Date().toISOString();

      const primaryGroup = UserManager.getPrimaryGroupForUser(currentUser);
      if (!primaryGroup) {
        return {
          success: false,
          error: `mkdir: critical - could not determine primary group for user '${currentUser}'`,
        };
      }

      for (const pathArg of args) {
        const resolvedPath = FileSystemManager.getAbsolutePath(
            pathArg,
            FileSystemManager.getCurrentPath()
        );
        const dirName = resolvedPath.substring(
            resolvedPath.lastIndexOf(Config.FILESYSTEM.PATH_SEPARATOR) + 1
        );
        if (
            resolvedPath === Config.FILESYSTEM.ROOT_PATH ||
            dirName === "" ||
            dirName === "." ||
            dirName === ".."
        ) {
          messages.push(
              `mkdir: cannot create directory '${pathArg}': Invalid path or name`
          );
          allSuccess = false;
          continue;
        }
        let parentNodeToCreateIn;
        if (flags.parents) {
          const parentDirResult =
              FileSystemManager.createParentDirectoriesIfNeeded(resolvedPath);
          if (parentDirResult.error) {
            messages.push(`mkdir: ${parentDirResult.error}`);
            allSuccess = false;
            continue;
          }
          parentNodeToCreateIn = parentDirResult.parentNode;
        } else {
          const parentPathForTarget =
              resolvedPath.substring(
                  0,
                  resolvedPath.lastIndexOf(Config.FILESYSTEM.PATH_SEPARATOR)
              ) || Config.FILESYSTEM.ROOT_PATH;
          parentNodeToCreateIn =
              FileSystemManager.getNodeByPath(parentPathForTarget);
          if (!parentNodeToCreateIn) {
            messages.push(
                `mkdir: cannot create directory '${pathArg}': Parent directory '${parentPathForTarget}' does not exist`
            );
            allSuccess = false;
            continue;
          }
          if (
              parentNodeToCreateIn.type !==
              Config.FILESYSTEM.DEFAULT_DIRECTORY_TYPE
          ) {
            messages.push(
                `mkdir: cannot create directory '${pathArg}': Path component '${parentPathForTarget}' is not a directory`
            );
            allSuccess = false;
            continue;
          }
          if (
              !FileSystemManager.hasPermission(
                  parentNodeToCreateIn,
                  currentUser,
                  "write"
              )
          ) {
            messages.push(
                `mkdir: cannot create directory '${pathArg}' in '${parentPathForTarget}'${Config.MESSAGES.PERMISSION_DENIED_SUFFIX}`
            );
            allSuccess = false;
            continue;
          }
        }
        if (
            parentNodeToCreateIn.children &&
            parentNodeToCreateIn.children[dirName]
        ) {
          const existingItem = parentNodeToCreateIn.children[dirName];
          if (existingItem.type === Config.FILESYSTEM.DEFAULT_FILE_TYPE) {
            messages.push(
                `mkdir: cannot create directory '${pathArg}': File exists`
            );
            allSuccess = false;
          } else if (
              existingItem.type === Config.FILESYSTEM.DEFAULT_DIRECTORY_TYPE &&
              !flags.parents
          ) {
            messages.push(
                `mkdir: cannot create directory '${pathArg}': Directory already exists.`
            );
            allSuccess = false;
          }
        } else {
          parentNodeToCreateIn.children[dirName] = FileSystemManager._createNewDirectoryNode(
              currentUser,
              primaryGroup
          );
          parentNodeToCreateIn.mtime = nowISO;
          messages.push(`created directory '${pathArg}'`);
          changesMade = true;
        }
      }
      if (changesMade && !(await FileSystemManager.save())) {
        allSuccess = false;
        messages.unshift("mkdir: Failed to save file system changes.");
      }
      if (!allSuccess) {
        return {
          success: false,
          error: messages.join("\n"),
        };
      }
      return {
        success: true,
        output: messages.join("\n"),
        messageType: Config.CSS_CLASSES.SUCCESS_MSG,
      };
    },
  };
  const treeCommandDefinition = {
    commandName: "tree",
    flagDefinitions: [
      {
        name: "level",
        short: "-L",
        long: "--level",
        takesValue: true,
      },
      {
        name: "dirsOnly",
        short: "-d",
        long: "--dirs-only",
      },
    ],
    argValidation: {
      max: 1,
    },
    coreLogic: async (context) => {
      const { args, flags, currentUser } = context;
      const pathArg = args.length > 0 ? args[0] : ".";
      const maxDepth = flags.level
          ? Utils.parseNumericArg(flags.level, {
            min: 0,
          })
          : {
            value: Infinity,
          };
      if (flags.level && (maxDepth.error || maxDepth.value === null))
        return {
          success: false,
          error: `tree: invalid level value for -L: '${flags.level}' ${
              maxDepth.error || ""
          }`,
        };
      const pathValidation = FileSystemManager.validatePath("tree", pathArg, {
        expectedType: Config.FILESYSTEM.DEFAULT_DIRECTORY_TYPE,
      });
      if (pathValidation.error)
        return {
          success: false,
          error: pathValidation.error,
        };
      if (
          !FileSystemManager.hasPermission(
              pathValidation.node,
              currentUser,
              "read"
          )
      )
        return {
          success: false,
          error: `tree: '${pathArg}'${Config.MESSAGES.PERMISSION_DENIED_SUFFIX}`,
        };
      const outputLines = [pathValidation.resolvedPath];
      let dirCount = 0;
      let fileCount = 0;

      function buildTreeRecursive(currentDirPath, currentDepth, indentPrefix) {
        if (currentDepth > maxDepth.value) return;
        const node = FileSystemManager.getNodeByPath(currentDirPath);
        if (!node || node.type !== Config.FILESYSTEM.DEFAULT_DIRECTORY_TYPE)
          return;
        if (
            currentDepth > 1 &&
            !FileSystemManager.hasPermission(node, currentUser, "read")
        ) {
          outputLines.push(indentPrefix + "└── [Permission Denied]");
          return;
        }
        const childrenNames = Object.keys(node.children).sort();
        childrenNames.forEach((childName, index) => {
          const childNode = node.children[childName];
          if (childNode.type === Config.FILESYSTEM.DEFAULT_DIRECTORY_TYPE) {
            dirCount++;
            outputLines.push(
                indentPrefix +
                (index === childrenNames.length - 1 ? "└── " : "├── ") +
                childName +
                Config.FILESYSTEM.PATH_SEPARATOR
            );
            if (currentDepth < maxDepth.value)
              buildTreeRecursive(
                  FileSystemManager.getAbsolutePath(childName, currentDirPath),
                  currentDepth + 1,
                  indentPrefix +
                  (index === childrenNames.length - 1 ? "    " : "│   ")
              );
          } else if (!flags.dirsOnly) {
            fileCount++;
            outputLines.push(
                indentPrefix +
                (index === childrenNames.length - 1 ? "└── " : "├── ") +
                childName
            );
          }
        });
      }
      buildTreeRecursive(pathValidation.resolvedPath, 1, "");
      outputLines.push("");
      let report = `${dirCount} director${dirCount === 1 ? "y" : "ies"}`;
      if (!flags.dirsOnly)
        report += `, ${fileCount} file${fileCount === 1 ? "" : "s"}`;
      outputLines.push(report);
      return {
        success: true,
        output: outputLines.join("\n"),
      };
    },
  };
  const touchCommandDefinition = {
    commandName: "touch",
    flagDefinitions: [
      { name: "noCreate", short: "-c", long: "--no-create" },
      { name: "dateString", short: "-d", long: "--date", takesValue: true },
      { name: "stamp", short: "-t", takesValue: true },
    ],
    argValidation: { min: 1 },
    coreLogic: async (context) => {
      const { args, flags, currentUser } = context;

      const timestampResult = TimestampParser.resolveTimestampFromCommandFlags(
          flags,
          "touch"
      );
      if (timestampResult.error)
        return { success: false, error: timestampResult.error };

      const timestampToUse = timestampResult.timestampISO;
      const nowActualISO = new Date().toISOString();
      let allSuccess = true;
      const messages = [];
      let changesMade = false;

      const primaryGroup = UserManager.getPrimaryGroupForUser(currentUser);

      for (const pathArg of args) {
        const pathValidation = FileSystemManager.validatePath(
            "touch",
            pathArg,
            { allowMissing: true, disallowRoot: true }
        );

        if (pathValidation.node) {
          if (
              !FileSystemManager.hasPermission(
                  pathValidation.node,
                  currentUser,
                  "write"
              )
          ) {
            messages.push(
                `touch: cannot update timestamp of '${pathArg}'${Config.MESSAGES.PERMISSION_DENIED_SUFFIX}`
            );
            allSuccess = false;
            continue;
          }
          pathValidation.node.mtime = timestampToUse;
          changesMade = true;
        } else if (pathValidation.error) {
          messages.push(pathValidation.error);
          allSuccess = false;
        } else {
          if (flags.noCreate) continue;

          if (pathArg.trim().endsWith(Config.FILESYSTEM.PATH_SEPARATOR)) {
            messages.push(
                `touch: cannot touch '${pathArg}': No such file or directory`
            );
            allSuccess = false;
            continue;
          }

          const parentPath =
              pathValidation.resolvedPath.substring(
                  0,
                  pathValidation.resolvedPath.lastIndexOf(
                      Config.FILESYSTEM.PATH_SEPARATOR
                  )
              ) || Config.FILESYSTEM.ROOT_PATH;
          const parentNode = FileSystemManager.getNodeByPath(parentPath);

          if (
              !parentNode ||
              parentNode.type !== Config.FILESYSTEM.DEFAULT_DIRECTORY_TYPE
          ) {
            messages.push(
                `touch: cannot create '${pathArg}': Parent directory not found or is not a directory.`
            );
            allSuccess = false;
            continue;
          }

          if (
              !FileSystemManager.hasPermission(parentNode, currentUser, "write")
          ) {
            messages.push(
                `touch: cannot create '${pathArg}': Permission denied in parent directory.`
            );
            allSuccess = false;
            continue;
          }

          if (!primaryGroup) {
            messages.push(
                `touch: could not determine primary group for user '${currentUser}'`
            );
            allSuccess = false;
            continue;
          }

          const fileName = pathValidation.resolvedPath.substring(
              pathValidation.resolvedPath.lastIndexOf(
                  Config.FILESYSTEM.PATH_SEPARATOR
              ) + 1
          );

          parentNode.children[fileName] = FileSystemManager._createNewFileNode(
              fileName,
              "",
              currentUser,
              primaryGroup
          );

          parentNode.mtime = nowActualISO;
          changesMade = true;
        }
      }

      if (changesMade && !(await FileSystemManager.save())) {
        messages.push("touch: CRITICAL - Failed to save file system changes.");
        allSuccess = false;
      }

      const outputMessage = messages.join("\n");
      if (!allSuccess)
        return {
          success: false,
          error: outputMessage || "touch: Not all operations were successful.",
        };

      return { success: true, output: "" };
    },
  };
  const catCommandDefinition = {
    commandName: "cat",
    coreLogic: async (context) => {
      const { args, options, currentUser } = context;
      if (
          args.length === 0 &&
          (options.stdinContent === null || options.stdinContent === undefined)
      ) {
        return {
          success: true,
          output: "",
        };
      }
      let outputContent = "";
      let firstFile = true;
      if (options.stdinContent !== null && options.stdinContent !== undefined) {
        outputContent += options.stdinContent;
        firstFile = false;
      }
      for (const pathArg of args) {
        const pathValidation = FileSystemManager.validatePath("cat", pathArg, {
          expectedType: Config.FILESYSTEM.DEFAULT_FILE_TYPE,
        });
        if (pathValidation.error)
          return {
            success: false,
            error: pathValidation.error,
          };
        if (
            !FileSystemManager.hasPermission(
                pathValidation.node,
                currentUser,
                "read"
            )
        )
          return {
            success: false,
            error: `cat: '${pathArg}'${Config.MESSAGES.PERMISSION_DENIED_SUFFIX}`,
          };
        if (!firstFile && outputContent && !outputContent.endsWith("\n"))
          outputContent += "\n";
        outputContent += pathValidation.node.content || "";
        firstFile = false;
      }
      return {
        success: true,
        output: outputContent,
      };
    },
  };
  const rmCommandDefinition = {
    commandName: "rm",
    flagDefinitions: [
      {
        name: "recursive",
        short: "-r",
        long: "--recursive",
        aliases: ["-R"],
      },
      {
        name: "force",
        short: "-f",
        long: "--force",
      },
    ],
    argValidation: {
      min: 1,
      error: "missing operand",
    },
    coreLogic: async (context) => {
      const { args, flags, currentUser, options } = context;
      let allSuccess = true;
      let anyChangeMade = false;
      const messages = [];
      for (const pathArg of args) {
        const pathValidation = FileSystemManager.validatePath("rm", pathArg, {
          disallowRoot: true,
        });
        if (flags.force && !pathValidation.node) continue;
        if (pathValidation.error) {
          messages.push(pathValidation.error);
          allSuccess = false;
          continue;
        }
        const node = pathValidation.node;
        if (
            node.type === Config.FILESYSTEM.DEFAULT_DIRECTORY_TYPE &&
            !flags.recursive
        ) {
          messages.push(
              `rm: cannot remove '${pathArg}': Is a directory (use -r or -R)`
          );
          allSuccess = false;
          continue;
        }
        let confirmed = flags.force;
        if (!confirmed && options.isInteractive) {
          const promptMsg =
              node.type === Config.FILESYSTEM.DEFAULT_DIRECTORY_TYPE
                  ? `Recursively remove directory '${pathArg}'?`
                  : `Remove file '${pathArg}'?`;
          confirmed = await new Promise((resolve) => {
            ModalManager.request({
              context: "terminal",
              messageLines: [promptMsg],
              onConfirm: () => resolve(true),
              onCancel: () => resolve(false),
              options,
            });
          });
        } else if (!confirmed && !options.isInteractive) {
          messages.push(
              `rm: removal of '${pathArg}' requires confirmation in non-interactive mode (use -f)`
          );
          allSuccess = false;
          continue;
        }
        if (confirmed) {
          const deleteResult = await FileSystemManager.deleteNodeRecursive(
              pathArg,
              {
                force: true,
                currentUser,
              }
          );
          if (deleteResult.success) {
            if (deleteResult.anyChangeMade) anyChangeMade = true;
          } else {
            allSuccess = false;
            messages.push(...deleteResult.messages);
          }
        } else {
          messages.push(
              `${Config.MESSAGES.REMOVAL_CANCELLED_PREFIX}'${pathArg}'${Config.MESSAGES.REMOVAL_CANCELLED_SUFFIX}`
          );
        }
      }
      if (anyChangeMade) await FileSystemManager.save();
      const finalOutput = messages.filter((m) => m).join("\n");
      return {
        success: allSuccess,
        output: finalOutput,
        error: allSuccess
            ? null
            : finalOutput || "Unknown error during rm operation.",
      };
    },
  };
  const cpCommandDefinition = {
    commandName: "cp",
    flagDefinitions: [
      { name: "recursive", short: "-r", long: "--recursive", aliases: ["-R"] },
      { name: "force", short: "-f", long: "--force" },
      { name: "preserve", short: "-p", long: "--preserve" },
      { name: "interactive", short: "-i", long: "--interactive" },
    ],
    argValidation: { min: 2 },
    coreLogic: async (context) => {
      const { args, flags, currentUser, options } = context;
      const nowISO = new Date().toISOString();
      flags.isInteractiveEffective = flags.interactive && !flags.force;

      const rawDestPathArg = args.pop();
      const sourcePathArgs = args;
      let operationMessages = [];
      let overallSuccess = true;
      let anyChangesMadeGlobal = false;

      const primaryGroup = UserManager.getPrimaryGroupForUser(currentUser);
      if (!primaryGroup) {
        return {
          success: false,
          error:
              "cp: critical - could not determine primary group for current user.",
        };
      }

      async function _executeCopyInternal(
          sourceNode,
          sourcePathForMsg,
          targetContainerAbsPath,
          targetEntryName,
          currentCommandFlags,
          userPrimaryGroup
      ) {
        let currentOpMessages = [];
        let currentOpSuccess = true;
        let madeChangeInThisCall = false;

        const targetContainerNode = FileSystemManager.getNodeByPath(
            targetContainerAbsPath
        );
        if (
            !targetContainerNode ||
            targetContainerNode.type !== Config.FILESYSTEM.DEFAULT_DIRECTORY_TYPE
        ) {
          return {
            success: false,
            messages: [
              `cp: target '${targetContainerAbsPath}' is not a directory.`,
            ],
            changesMade: false,
          };
        }

        if (
            !FileSystemManager.hasPermission(
                targetContainerNode,
                currentUser,
                "write"
            )
        ) {
          return {
            success: false,
            messages: [
              `cp: cannot create item in '${targetContainerAbsPath}'${Config.MESSAGES.PERMISSION_DENIED_SUFFIX}`,
            ],
            changesMade: false,
          };
        }

        const fullFinalDestPath = FileSystemManager.getAbsolutePath(
            targetEntryName,
            targetContainerAbsPath
        );
        let existingNodeAtDest = targetContainerNode.children[targetEntryName];

        if (existingNodeAtDest) {
          if (sourceNode.type !== existingNodeAtDest.type) {
            return {
              success: false,
              messages: [
                `cp: cannot overwrite ${existingNodeAtDest.type} '${fullFinalDestPath}' with ${sourceNode.type} '${sourcePathForMsg}'`,
              ],
              changesMade: false,
            };
          }
          if (currentCommandFlags.isInteractiveEffective) {
            const confirmed = await new Promise((r) =>
                ModalManager.request({
                  context: "terminal",
                  messageLines: [`Overwrite '${fullFinalDestPath}'?`],
                  onConfirm: () => r(true),
                  onCancel: () => r(false),
                  options,
                })
            );
            if (!confirmed)
              return {
                success: true,
                messages: [
                  `cp: not overwriting '${fullFinalDestPath}' (skipped)`,
                ],
                changesMade: false,
              };
          } else if (!currentCommandFlags.force) {
            return {
              success: false,
              messages: [
                `cp: '${fullFinalDestPath}' already exists. Use -f to overwrite or -i to prompt.`,
              ],
              changesMade: false,
            };
          }
        }

        if (sourceNode.type === Config.FILESYSTEM.DEFAULT_FILE_TYPE) {
          targetContainerNode.children[targetEntryName] = {
            type: Config.FILESYSTEM.DEFAULT_FILE_TYPE,
            content: sourceNode.content,
            owner: currentCommandFlags.preserve
                ? sourceNode.owner
                : currentUser,
            group: currentCommandFlags.preserve
                ? sourceNode.group
                : userPrimaryGroup,
            mode: currentCommandFlags.preserve
                ? sourceNode.mode
                : Config.FILESYSTEM.DEFAULT_FILE_MODE,
            mtime: currentCommandFlags.preserve ? sourceNode.mtime : nowISO,
          };
          madeChangeInThisCall = true;
        } else if (
            sourceNode.type === Config.FILESYSTEM.DEFAULT_DIRECTORY_TYPE
        ) {
          if (!currentCommandFlags.recursive) {
            return {
              success: true,
              messages: [
                `cp: omitting directory '${sourcePathForMsg}' (use -r or -R)`,
              ],
              changesMade: false,
            };
          }

          if (!existingNodeAtDest) {
            const owner = currentCommandFlags.preserve ? sourceNode.owner : currentUser;
            const group = currentCommandFlags.preserve ? sourceNode.group : userPrimaryGroup;
            const mode = currentCommandFlags.preserve ? sourceNode.mode : Config.FILESYSTEM.DEFAULT_DIR_MODE;

            const newDirNode = FileSystemManager._createNewDirectoryNode(owner, group, mode);

            if (currentCommandFlags.preserve) {
              newDirNode.mtime = sourceNode.mtime;
            }

            targetContainerNode.children[targetEntryName] = newDirNode;
            madeChangeInThisCall = true;
          }
          for (const childName in sourceNode.children) {
            const childCopyResult = await _executeCopyInternal(
                sourceNode.children[childName],
                FileSystemManager.getAbsolutePath(childName, sourcePathForMsg),
                fullFinalDestPath,
                childName,
                currentCommandFlags,
                userPrimaryGroup
            );
            currentOpMessages.push(...childCopyResult.messages);
            if (!childCopyResult.success) currentOpSuccess = false;
            if (childCopyResult.changesMade) madeChangeInThisCall = true;
          }
        }

        if (madeChangeInThisCall) {
          targetContainerNode.mtime = nowISO;
        }

        return {
          success: currentOpSuccess,
          messages: currentOpMessages,
          changesMade: madeChangeInThisCall,
        };
      }

      const destValidation = FileSystemManager.validatePath(
          "cp (dest)",
          rawDestPathArg,
          { allowMissing: true }
      );
      if (
          destValidation.error &&
          !(destValidation.optionsUsed.allowMissing && !destValidation.node)
      ) {
        return { success: false, error: destValidation.error };
      }

      const isDestADirectory =
          destValidation.node &&
          destValidation.node.type === Config.FILESYSTEM.DEFAULT_DIRECTORY_TYPE;
      if (sourcePathArgs.length > 1 && !isDestADirectory) {
        return {
          success: false,
          error: `cp: target '${rawDestPathArg}' is not a directory`,
        };
      }

      for (const sourcePathArg of sourcePathArgs) {
        const sourceValidation = FileSystemManager.validatePath(
            "cp (source)",
            sourcePathArg
        );
        if (sourceValidation.error) {
          operationMessages.push(sourceValidation.error);
          overallSuccess = false;
          continue;
        }
        if (
            !FileSystemManager.hasPermission(
                sourceValidation.node,
                currentUser,
                "read"
            )
        ) {
          operationMessages.push(
              `cp: cannot read '${sourcePathArg}'${Config.MESSAGES.PERMISSION_DENIED_SUFFIX}`
          );
          overallSuccess = false;
          continue;
        }
        let targetContainerAbsPath, targetEntryName;
        if (isDestADirectory) {
          targetContainerAbsPath = destValidation.resolvedPath;
          targetEntryName = sourceValidation.resolvedPath.substring(
              sourceValidation.resolvedPath.lastIndexOf(
                  Config.FILESYSTEM.PATH_SEPARATOR
              ) + 1
          );
        } else {
          targetContainerAbsPath =
              destValidation.resolvedPath.substring(
                  0,
                  destValidation.resolvedPath.lastIndexOf(
                      Config.FILESYSTEM.PATH_SEPARATOR
                  )
              ) || Config.FILESYSTEM.ROOT_PATH;
          targetEntryName = destValidation.resolvedPath.substring(
              destValidation.resolvedPath.lastIndexOf(
                  Config.FILESYSTEM.PATH_SEPARATOR
              ) + 1
          );
        }

        const copyResult = await _executeCopyInternal(
            sourceValidation.node,
            sourcePathArg,
            targetContainerAbsPath,
            targetEntryName,
            flags,
            primaryGroup
        );

        operationMessages.push(...copyResult.messages);
        if (!copyResult.success) overallSuccess = false;
        if (copyResult.changesMade) anyChangesMadeGlobal = true;
      }

      if (anyChangesMadeGlobal && !(await FileSystemManager.save())) {
        operationMessages.push(
            "cp: CRITICAL - Failed to save file system changes."
        );
        overallSuccess = false;
      }

      const finalMessages = operationMessages.filter((m) => m).join("\n");
      return {
        success: overallSuccess,
        output: finalMessages,
        error: overallSuccess
            ? null
            : finalMessages || "An unknown error occurred.",
      };
    },
  };
  const historyCommandDefinition = {
    commandName: "history",
    flagDefinitions: [
      {
        name: "clear",
        short: "-c",
        long: "--clear",
      },
    ],
    coreLogic: async (context) => {
      if (context.flags.clear) {
        HistoryManager.clearHistory();
        return {
          success: true,
          output: "Command history cleared.",
          messageType: Config.CSS_CLASSES.SUCCESS_MSG,
        };
      }
      const history = HistoryManager.getFullHistory();
      if (history.length === 0)
        return {
          success: true,
          output: Config.MESSAGES.NO_COMMANDS_IN_HISTORY,
        };
      return {
        success: true,
        output: history
            .map((cmd, i) => `  ${String(i + 1).padStart(3)}  ${cmd}`)
            .join("\n"),
      };
    },
  };
  const grepCommandDefinition = {
    commandName: "grep",
    flagDefinitions: [
      {
        name: "ignoreCase",
        short: "-i",
        long: "--ignore-case",
      },
      {
        name: "invertMatch",
        short: "-v",
        long: "--invert-match",
      },
      {
        name: "lineNumber",
        short: "-n",
        long: "--line-number",
      },
      {
        name: "count",
        short: "-c",
        long: "--count",
      },
      {
        name: "recursive",
        short: "-R",
      },
    ],
    coreLogic: async (context) => {
      const { args, flags, options, currentUser } = context;
      if (args.length === 0 && options.stdinContent === null)
        return {
          success: false,
          error: "grep: missing pattern",
        };
      const patternStr = args[0];
      const filePathsArgs = args.slice(1);
      let regex;
      try {
        regex = new RegExp(patternStr, flags.ignoreCase ? "i" : "");
      } catch (e) {
        return {
          success: false,
          error: `grep: invalid regular expression '${patternStr}': ${e.message}`,
        };
      }
      let outputLines = [];
      let overallSuccess = true;
      const processContent = (content, filePathForDisplay) => {
        const lines = content.split("\n");
        let fileMatchCount = 0;
        let currentFileLines = [];
        lines.forEach((line, index) => {
          if (
              index === lines.length - 1 &&
              line === "" &&
              content.endsWith("\n")
          )
            return;
          const isMatch = regex.test(line);
          const effectiveMatch = flags.invertMatch ? !isMatch : isMatch;
          if (effectiveMatch) {
            fileMatchCount++;
            if (!flags.count) {
              let outputLine = "";
              if (filePathForDisplay) outputLine += `${filePathForDisplay}:`;
              if (flags.lineNumber) outputLine += `${index + 1}:`;
              outputLine += line;
              currentFileLines.push(outputLine);
            }
          }
        });
        if (flags.count) {
          let countOutput = "";
          if (filePathForDisplay) countOutput += `${filePathForDisplay}:`;
          countOutput += fileMatchCount;
          outputLines.push(countOutput);
        } else {
          outputLines.push(...currentFileLines);
        }
      };
      async function searchRecursively(currentPath, displayPathArg) {
        const pathValidation = FileSystemManager.validatePath(
            "grep",
            currentPath
        );
        if (pathValidation.error) {
          await OutputManager.appendToOutput(pathValidation.error, {
            typeClass: Config.CSS_CLASSES.ERROR_MSG,
          });
          overallSuccess = false;
          return;
        }
        const node = pathValidation.node;
        if (!FileSystemManager.hasPermission(node, currentUser, "read")) {
          await OutputManager.appendToOutput(
              `grep: ${displayPathArg}${Config.MESSAGES.PERMISSION_DENIED_SUFFIX}`,
              {
                typeClass: Config.CSS_CLASSES.ERROR_MSG,
              }
          );
          overallSuccess = false;
          return;
        }
        if (node.type === Config.FILESYSTEM.DEFAULT_FILE_TYPE) {
          processContent(node.content || "", currentPath);
        } else if (node.type === Config.FILESYSTEM.DEFAULT_DIRECTORY_TYPE) {
          if (!flags.recursive) {
            await OutputManager.appendToOutput(
                `grep: ${displayPathArg}: Is a directory`,
                {
                  typeClass: Config.CSS_CLASSES.ERROR_MSG,
                }
            );
            overallSuccess = false;
            return;
          }
          for (const childName of Object.keys(node.children || {})) {
            await searchRecursively(
                FileSystemManager.getAbsolutePath(childName, currentPath),
                FileSystemManager.getAbsolutePath(childName, currentPath)
            );
          }
        }
      }
      if (filePathsArgs.length > 0) {
        for (const pathArg of filePathsArgs) {
          if (flags.recursive) {
            await searchRecursively(
                FileSystemManager.getAbsolutePath(
                    pathArg,
                    FileSystemManager.getCurrentPath()
                ),
                pathArg
            );
          } else {
            const pathValidation = FileSystemManager.validatePath(
                "grep",
                pathArg,
                {
                  expectedType: Config.FILESYSTEM.DEFAULT_FILE_TYPE,
                }
            );
            if (pathValidation.error) {
              await OutputManager.appendToOutput(pathValidation.error, {
                typeClass: Config.CSS_CLASSES.ERROR_MSG,
              });
              overallSuccess = false;
              continue;
            }
            if (
                !FileSystemManager.hasPermission(
                    pathValidation.node,
                    currentUser,
                    "read"
                )
            ) {
              await OutputManager.appendToOutput(
                  `grep: ${pathArg}${Config.MESSAGES.PERMISSION_DENIED_SUFFIX}`,
                  {
                    typeClass: Config.CSS_CLASSES.ERROR_MSG,
                  }
              );
              overallSuccess = false;
              continue;
            }
            processContent(pathValidation.node.content || "", pathArg);
          }
        }
      } else if (options.stdinContent !== null) {
        processContent(options.stdinContent, null);
      } else {
        return {
          success: false,
          error: "grep: No input files or stdin provided after pattern.",
        };
      }
      return {
        success: overallSuccess,
        output: outputLines.join("\n"),
      };
    },
  };
  const uploadCommandDefinition = {
    commandName: "upload",
    flagDefinitions: [
      {
        name: "force",
        short: "-f",
        long: "--force",
      },
    ],
    argValidation: {
      max: 1,
    },
    coreLogic: async (context) => {
      const { args, flags, currentUser, options } = context;
      if (!options.isInteractive)
        return {
          success: false,
          error: "upload: Can only be run in interactive mode.",
        };
      let targetDirPath = FileSystemManager.getCurrentPath();
      const nowISO = new Date().toISOString();
      const operationMessages = [];
      let allFilesSuccess = true;
      let anyFileProcessed = false;
      if (args.length === 1) {
        const destPathValidation = FileSystemManager.validatePath(
            "upload (destination)",
            args[0],
            {
              expectedType: Config.FILESYSTEM.DEFAULT_DIRECTORY_TYPE,
            }
        );
        if (destPathValidation.error)
          return {
            success: false,
            error: destPathValidation.error,
          };
        targetDirPath = destPathValidation.resolvedPath;
      }
      const targetDirNode = FileSystemManager.getNodeByPath(targetDirPath);
      if (
          !targetDirNode ||
          !FileSystemManager.hasPermission(targetDirNode, currentUser, "write")
      )
        return {
          success: false,
          error: `upload: cannot write to directory '${targetDirPath}'${Config.MESSAGES.PERMISSION_DENIED_SUFFIX}`,
        };
      const input = Utils.createElement("input", {
        type: "file",
        multiple: true,
      });
      input.style.display = "none";
      document.body.appendChild(input);
      try {
        const fileResult = await new Promise((resolve) => {
          let dialogClosed = false;
          const onFocus = () => {
            setTimeout(() => {
              window.removeEventListener("focus", onFocus);
              if (!dialogClosed) {
                dialogClosed = true;
                resolve({
                  success: false,
                  error: Config.MESSAGES.UPLOAD_NO_FILE,
                });
              }
            }, 300);
          };
          input.onchange = (e) => {
            dialogClosed = true;
            window.removeEventListener("focus", onFocus);
            if (e.target.files?.length > 0) {
              resolve({
                success: true,
                files: e.target.files,
              });
            } else {
              resolve({
                success: false,
                error: Config.MESSAGES.UPLOAD_NO_FILE,
              });
            }
          };
          window.addEventListener("focus", onFocus);
          input.click();
        });
        if (!fileResult.success) {
          return {
            success: false,
            error: `upload: ${fileResult.error}`,
          };
        }
        const filesToUpload = fileResult.files;
        anyFileProcessed = true;
        for (const file of Array.from(filesToUpload)) {
          try {
            const explicitMode = file.name.endsWith(".sh")
                ? Config.FILESYSTEM.DEFAULT_SH_MODE
                : null;
            const content = await file.text();
            const existingFileNode = targetDirNode.children[file.name];
            if (existingFileNode) {
              if (
                  !FileSystemManager.hasPermission(
                      existingFileNode,
                      currentUser,
                      "write"
                  )
              ) {
                operationMessages.push(
                    `Error uploading '${file.name}': cannot overwrite '${file.name}'${Config.MESSAGES.PERMISSION_DENIED_SUFFIX}`
                );
                allFilesSuccess = false;
                continue;
              }
              if (!flags.force) {
                const confirmed = await new Promise((r) =>
                    ModalManager.request({
                      context: "terminal",
                      messageLines: [`'${file.name}' already exists. Overwrite?`],
                      onConfirm: () => r(true),
                      onCancel: () => r(false),
                      options,
                    })
                );
                if (!confirmed) {
                  operationMessages.push(`Skipped '${file.name}'.`);
                  continue;
                }
              }
            }
            const primaryGroup =
                UserManager.getPrimaryGroupForUser(currentUser);
            if (!primaryGroup) {
              operationMessages.push(
                  `Error uploading '${file.name}': Could not determine primary group.`
              );
              allFilesSuccess = false;
              continue;
            }
            targetDirNode.children[file.name] =
                FileSystemManager._createNewFileNode(
                    file.name,
                    content,
                    currentUser,
                    primaryGroup,
                    explicitMode
                );
            targetDirNode.mtime = nowISO;
            operationMessages.push(
                `'${file.name}' uploaded to '${targetDirPath}'.`
            );
          } catch (fileError) {
            operationMessages.push(
                `Error uploading '${file.name}': ${fileError.message}`
            );
            allFilesSuccess = false;
          }
        }
        if (anyFileProcessed && !(await FileSystemManager.save())) {
          operationMessages.push(
              "Critical: Failed to save file system changes after uploads."
          );
          allFilesSuccess = false;
        }

        if (allFilesSuccess) {
          return {
            success: true,
            output: operationMessages.join("\n") || "Upload complete.",
            messageType: Config.CSS_CLASSES.SUCCESS_MSG,
          };
        } else {
          return {
            success: false,
            error: operationMessages.join("\n"),
          };
        }
      } catch (e) {
        return {
          success: false,
          error: `upload: ${e.message}`,
        };
      } finally {
        if (input.parentNode) document.body.removeChild(input);
      }
    },
  };
  const restoreCommandDefinition = {
    commandName: "restore",
    argValidation: {
      exact: 0,
    },
    coreLogic: async (context) => {
      const { options } = context;
      if (!options.isInteractive)
        return {
          success: false,
          error: "restore: Can only be run in interactive mode.",
        };
      const input = Utils.createElement("input", {
        type: "file",
        accept: ".json",
      });
      input.style.display = "none";
      document.body.appendChild(input);
      try {
        const fileResult = await new Promise((resolve) => {
          let dialogClosed = false;
          const onFocus = () => {
            setTimeout(() => {
              window.removeEventListener("focus", onFocus);
              if (!dialogClosed) {
                dialogClosed = true;
                resolve({
                  success: false,
                  error: Config.MESSAGES.RESTORE_CANCELLED_NO_FILE,
                });
              }
            }, 300);
          };

          input.onchange = (e) => {
            dialogClosed = true;
            window.removeEventListener("focus", onFocus);
            const f = e.target.files[0];
            if (f) resolve({ success: true, file: f });
            else
              resolve({
                success: false,
                error: Config.MESSAGES.RESTORE_CANCELLED_NO_FILE,
              });
          };

          window.addEventListener("focus", onFocus);
          input.click();
        });

        if (!fileResult.success) {
          return { success: false, error: `restore: ${fileResult.error}` };
        }
        const file = fileResult.file;
        const backupData = JSON.parse(await file.text());
        if (
            !backupData ||
            !backupData.dataType ||
            !backupData.dataType.startsWith("OopisOS_System_State_Backup")
        ) {
          return {
            success: false,
            error: `restore: '${file.name}' is not a valid OopisOS System State backup file.`,
          };
        }
        const messageLines = [
          `WARNING: This will completely overwrite the current OopisOS state.`,
          `All users, files, and sessions will be replaced with data from '${file.name}'.`,
          "This action cannot be undone. Are you sure you want to restore?",
        ];
        const confirmed = await new Promise((conf) =>
            ModalManager.request({
              context: "terminal",
              messageLines,
              onConfirm: () => conf(true),
              onCancel: () => conf(false),
              options,
            })
        );
        if (!confirmed) {
          return {
            success: true,
            output: Config.MESSAGES.OPERATION_CANCELLED,
            messageType: Config.CSS_CLASSES.CONSOLE_LOG_MSG,
          };
        }
        const allKeys = StorageManager.getAllLocalStorageKeys();
        allKeys.forEach((key) => {
          if (key !== Config.STORAGE_KEYS.GEMINI_API_KEY) {
            StorageManager.removeItem(key);
          }
        });
        if (backupData.userCredentials)
          StorageManager.saveItem(
              Config.STORAGE_KEYS.USER_CREDENTIALS,
              backupData.userCredentials
          );
        if (backupData.editorWordWrapEnabled !== undefined)
          StorageManager.saveItem(
              Config.STORAGE_KEYS.EDITOR_WORD_WRAP_ENABLED,
              backupData.editorWordWrapEnabled
          );
        if (backupData.automaticSessionStates) {
          for (const key in backupData.automaticSessionStates)
            StorageManager.saveItem(
                key,
                backupData.automaticSessionStates[key]
            );
        }
        if (backupData.manualSaveStates) {
          for (const key in backupData.manualSaveStates)
            StorageManager.saveItem(key, backupData.manualSaveStates[key]);
        }
        FileSystemManager.setFsData(
            Utils.deepCopyNode(backupData.fsDataSnapshot)
        );

        if (!(await FileSystemManager.save())) {
          return {
            success: false,
            error:
                "restore: Critical failure: Could not save the restored file system to the database.",
          };
        }

        await OutputManager.appendToOutput(
            "System state restored successfully. Rebooting OopisOS to apply changes...",
            {
              typeClass: Config.CSS_CLASSES.SUCCESS_MSG,
            }
        );
        setTimeout(() => {
          window.location.reload(true);
        }, 1500);
        return {
          success: true,
          output: "",
        };
      } catch (e) {
        return {
          success: false,
          error: `restore: ${e.message}`,
        };
      } finally {
        if (input.parentNode) document.body.removeChild(input);
      }
    },
  };
  const findCommandDefinition = {
    commandName: "find",
    argValidation: {
      min: 1,
      error: "missing path specification",
    },
    coreLogic: async (context) => {
      const { args, currentUser } = context;
      const startPathArg = args[0];
      const expressionArgs = args.slice(1);
      let outputLines = [];
      let overallSuccess = true,
          filesProcessedSuccessfully = true,
          anyChangeMadeDuringFind = false;
      const predicates = {
        "-name": (node, path, pattern) => {
          const regex = Utils.globToRegex(pattern);
          if (!regex) {
            OutputManager.appendToOutput(
                `find: invalid pattern for -name: ${pattern}`,
                {
                  typeClass: Config.CSS_CLASSES.ERROR_MSG,
                }
            );
            overallSuccess = false;
            return false;
          }
          return regex.test(
              path.substring(
                  path.lastIndexOf(Config.FILESYSTEM.PATH_SEPARATOR) + 1
              )
          );
        },
        "-type": (node, path, typeChar) => {
          if (typeChar === "f")
            return node.type === Config.FILESYSTEM.DEFAULT_FILE_TYPE;
          if (typeChar === "d")
            return node.type === Config.FILESYSTEM.DEFAULT_DIRECTORY_TYPE;
          OutputManager.appendToOutput(
              `find: unknown type '${typeChar}' for -type`,
              {
                typeClass: Config.CSS_CLASSES.ERROR_MSG,
              }
          );
          overallSuccess = false;
          return false;
        },
        "-user": (node, path, username) => node.owner === username,
        "-perm": (node, path, modeStr) => {
          if (!/^[0-7]{3,4}$/.test(modeStr)) {
            OutputManager.appendToOutput(
                `find: invalid mode '${modeStr}' for -perm`,
                {
                  typeClass: Config.CSS_CLASSES.ERROR_MSG,
                }
            );
            overallSuccess = false;
            return false;
          }
          return node.mode === parseInt(modeStr, 8);
        },
        "-mtime": (node, path, mtimeSpec) => {
          if (!node.mtime) return false;
          const ageInMs = new Date().getTime() - new Date(node.mtime).getTime();
          const days = ageInMs / (24 * 60 * 60 * 1000);
          let n;
          if (mtimeSpec.startsWith("+")) {
            n = parseInt(mtimeSpec.substring(1), 10);
            return !isNaN(n) && days > n;
          } else if (mtimeSpec.startsWith("-")) {
            n = parseInt(mtimeSpec.substring(1), 10);
            return !isNaN(n) && days < n;
          } else {
            n = parseInt(mtimeSpec, 10);
            return !isNaN(n) && Math.floor(days) === n;
          }
        },
        "-newermt": (node, path, dateStr) => {
          if (!node.mtime) return false;
          const targetDate = TimestampParser.parseDateString(dateStr);
          if (!targetDate) {
            OutputManager.appendToOutput(
                `find: invalid date string for -newermt: ${dateStr}`,
                { typeClass: Config.CSS_CLASSES.ERROR_MSG }
            );
            overallSuccess = false;
            return false;
          }
          return new Date(node.mtime) > targetDate;
        },
        "-oldermt": (node, path, dateStr) => {
          if (!node.mtime) return false;
          const targetDate = TimestampParser.parseDateString(dateStr);
          if (!targetDate) {
            OutputManager.appendToOutput(
                `find: invalid date string for -oldermt: ${dateStr}`,
                { typeClass: Config.CSS_CLASSES.ERROR_MSG }
            );
            overallSuccess = false;
            return false;
          }
          return new Date(node.mtime) < targetDate;
        },
      };
      const actions = {
        "-print": async (node, path) => {
          outputLines.push(path);
          return true;
        },
        "-exec": async (node, path, commandParts) => {
          const cmdStr = commandParts
              .map((part) => (part === "{}" ? path : part))
              .join(" ");
          const result = await CommandExecutor.processSingleCommand(
              cmdStr,
              false
          );
          if (!result.success) {
            await OutputManager.appendToOutput(
                `find: -exec: command '${cmdStr}' failed: ${result.error}`,
                {
                  typeClass: Config.CSS_CLASSES.WARNING_MSG,
                }
            );
            filesProcessedSuccessfully = false;
            return false;
          }
          return true;
        },
        "-delete": async (node, path) => {
          const result = await FileSystemManager.deleteNodeRecursive(path, {
            force: true,
            currentUser,
          });
          if (!result.success) {
            await OutputManager.appendToOutput(
                `find: -delete: ${
                    result.messages.join(";") ||
                    `
								failed to delete '${path}'
								`
                }`,
                {
                  typeClass: Config.CSS_CLASSES.WARNING_MSG,
                }
            );
            filesProcessedSuccessfully = false;
            return false;
          }
          if (result.anyChangeMade) anyChangeMadeDuringFind = true;
          return true;
        },
      };
      let parsedExpression = [],
          currentTermGroup = [],
          nextTermNegated = false,
          hasExplicitAction = false,
          i = 0;
      while (i < expressionArgs.length) {
        const token = expressionArgs[i];
        if (token === "-not" || token === "!") {
          nextTermNegated = true;
          i++;
          continue;
        }
        if (token === "-or" || token === "-o") {
          if (currentTermGroup.length > 0)
            parsedExpression.push({
              type: "AND_GROUP",
              terms: currentTermGroup,
            });
          currentTermGroup = [];
          parsedExpression.push({
            type: "OR",
          });
          i++;
          continue;
        }
        let term = {
          name: token,
          negated: nextTermNegated,
        };
        nextTermNegated = false;
        if (predicates[token]) {
          term.type = "TEST";
          term.eval = predicates[token];
          if (i + 1 < expressionArgs.length) {
            term.arg = expressionArgs[++i];
          } else {
            return {
              success: false,
              error: `find: missing argument to \`${token}\``,
            };
          }
        } else if (actions[token]) {
          term.type = "ACTION";
          term.perform = actions[token];
          hasExplicitAction = true;
          if (token === "-exec") {
            term.commandParts = [];
            i++;
            while (i < expressionArgs.length && expressionArgs[i] !== ";")
              term.commandParts.push(expressionArgs[i++]);
            if (i >= expressionArgs.length || expressionArgs[i] !== ";")
              return {
                success: false,
                error: "find: missing terminating ';' for -exec",
              };
          }
        } else {
          return {
            success: false,
            error: `find: unknown predicate '${token}'`,
          };
        }
        currentTermGroup.push(term);
        i++;
      }
      if (currentTermGroup.length > 0)
        parsedExpression.push({
          type: "AND_GROUP",
          terms: currentTermGroup,
        });
      if (!hasExplicitAction) {
        if (
            parsedExpression.length === 0 ||
            parsedExpression[parsedExpression.length - 1].type === "OR"
        )
          parsedExpression.push({
            type: "AND_GROUP",
            terms: [],
          });
        parsedExpression[parsedExpression.length - 1].terms.push({
          type: "ACTION",
          name: "-print",
          perform: actions["-print"],
          negated: false,
        });
      }
      async function evaluateExpressionForNode(node, path) {
        let overallResult = false;
        let currentAndGroupResult = true;

        for (const groupOrOperator of parsedExpression) {
          if (groupOrOperator.type === "AND_GROUP") {
            currentAndGroupResult = true;
            for (const term of groupOrOperator.terms.filter(
                (t) => t.type === "TEST"
            )) {
              const result = await term.eval(node, path, term.arg);
              const effectiveResult = term.negated ? !result : result;
              if (!effectiveResult) {
                currentAndGroupResult = false;
                break;
              }
            }
          } else if (groupOrOperator.type === "OR") {
            overallResult = overallResult || currentAndGroupResult;
            currentAndGroupResult = true;
          }
        }

        overallResult = overallResult || currentAndGroupResult;
        return overallResult;
      }
      async function recurseFind(currentResolvedPath, isDepthFirst) {
        const node = FileSystemManager.getNodeByPath(currentResolvedPath);
        if (!node) {
          await OutputManager.appendToOutput(
              `find: ‘${currentResolvedPath}’: No such file or directory`,
              {
                typeClass: Config.CSS_CLASSES.ERROR_MSG,
              }
          );
          filesProcessedSuccessfully = false;
          return;
        }
        if (!FileSystemManager.hasPermission(node, currentUser, "read")) {
          await OutputManager.appendToOutput(
              `find: ‘${currentResolvedPath}’: Permission denied`,
              {
                typeClass: Config.CSS_CLASSES.ERROR_MSG,
              }
          );
          filesProcessedSuccessfully = false;
          return;
        }
        const processNode = async () => {
          if (await evaluateExpressionForNode(node, currentResolvedPath)) {
            for (const groupOrOperator of parsedExpression) {
              if (groupOrOperator.type === "AND_GROUP") {
                for (const term of groupOrOperator.terms.filter(
                    (t) => t.type === "ACTION"
                ))
                  await term.perform(
                      node,
                      currentResolvedPath,
                      term.commandParts
                  );
              }
            }
          }
        };
        if (!isDepthFirst) await processNode();
        if (node.type === Config.FILESYSTEM.DEFAULT_DIRECTORY_TYPE) {
          for (const childName of Object.keys(node.children || {})) {
            await recurseFind(
                FileSystemManager.getAbsolutePath(childName, currentResolvedPath),
                isDepthFirst
            );
          }
        }
        if (isDepthFirst) await processNode();
      }
      const startPathValidation = FileSystemManager.validatePath(
          "find",
          startPathArg
      );
      if (startPathValidation.error)
        return {
          success: false,
          error: startPathValidation.error,
        };
      const impliesDepth = parsedExpression.some(
          (g) =>
              g.type === "AND_GROUP" && g.terms.some((t) => t.name === "-delete")
      );
      await recurseFind(startPathValidation.resolvedPath, impliesDepth);
      if (anyChangeMadeDuringFind) await FileSystemManager.save();
      return {
        success: overallSuccess && filesProcessedSuccessfully,
        output: outputLines.join("\n"),
      };
    },
  };
  const groupsCommandDefinition = {
    commandName: "groups",
    argValidation: { max: 1 },
    coreLogic: async (context) => {
      const { args, currentUser } = context;
      const targetUser = args.length > 0 ? args[0] : currentUser;

      const users = StorageManager.loadItem(
          Config.STORAGE_KEYS.USER_CREDENTIALS,
          "User list",
          {}
      );
      if (!users[targetUser] && targetUser !== Config.USER.DEFAULT_NAME) {
        return {
          success: false,
          error: `groups: user '${targetUser}' does not exist`,
        };
      }

      const userGroups = GroupManager.getGroupsForUser(targetUser);
      if (userGroups.length === 0) {
        return { success: true, output: `${targetUser} :` };
      }

      return {
        success: true,
        output: `${targetUser} : ${userGroups.join(" ")}`,
      };
    },
  };
  const groupaddCommandDefinition = {
    commandName: "groupadd",
    argValidation: { exact: 1, error: "Usage: groupadd <groupname>" },
    coreLogic: async (context) => {
      const { args, currentUser } = context;
      const groupName = args[0];

      if (currentUser !== "root") {
        return { success: false, error: "groupadd: only root can add groups." };
      }
      if (GroupManager.groupExists(groupName)) {
        return {
          success: false,
          error: `groupadd: group '${groupName}' already exists.`,
        };
      }

      GroupManager.createGroup(groupName);
      return { success: true, output: `Group '${groupName}' created.` };
    },
  };
  const usermodCommandDefinition = {
    commandName: "usermod",
    argValidation: {
      exact: 3,
      error: "Usage: usermod -aG <groupname> <username>",
    },
    coreLogic: async (context) => {
      const { args, currentUser } = context;
      const flag = args[0];
      const groupName = args[1];
      const username = args[2];

      if (currentUser !== "root") {
        return {
          success: false,
          error: "usermod: only root can modify user groups.",
        };
      }
      if (flag !== "-aG") {
        return {
          success: false,
          error: "usermod: invalid flag. Only '-aG' is supported.",
        };
      }
      if (!GroupManager.groupExists(groupName)) {
        return {
          success: false,
          error: `usermod: group '${groupName}' does not exist.`,
        };
      }
      const users = StorageManager.loadItem(
          Config.STORAGE_KEYS.USER_CREDENTIALS,
          "User list",
          {}
      );
      if (!users[username] && username !== Config.USER.DEFAULT_NAME) {
        return {
          success: false,
          error: `usermod: user '${username}' does not exist.`,
        };
      }

      if (GroupManager.addUserToGroup(username, groupName)) {
        return {
          success: true,
          output: `Added user '${username}' to group '${groupName}'.`,
        };
      } else {
        return {
          success: true,
          output: `User '${username}' is already in group '${groupName}'.`,
          messageType: Config.CSS_CLASSES.CONSOLE_LOG_MSG,
        };
      }
    },
  };
  const chgrpCommandDefinition = {
    commandName: "chgrp",
    argValidation: { exact: 2, error: "Usage: chgrp <groupname> <path>" },
    pathValidation: [{ argIndex: 1 }],
    coreLogic: async (context) => {
      const { args, currentUser, validatedPaths } = context;
      const groupName = args[0];
      const pathInfo = validatedPaths[1];
      const node = pathInfo.node;

      if (currentUser !== "root" && node.owner !== currentUser) {
        return {
          success: false,
          error: `chgrp: changing group of '${pathInfo.resolvedPath}': Operation not permitted`,
        };
      }
      if (!GroupManager.groupExists(groupName)) {
        return {
          success: false,
          error: `chgrp: invalid group: '${groupName}'`,
        };
      }

      node.group = groupName;
      node.mtime = new Date().toISOString();
      if (!(await FileSystemManager.save())) {
        return {
          success: false,
          error: "chgrp: Failed to save file system changes.",
        };
      }

      return { success: true, output: "" };
    },
  };
  const diffCommandDefinition = {
    commandName: "diff",
    argValidation: {
      exact: 2,
      error: "Usage: diff <file1> <file2>",
    },
    pathValidation: [{
      argIndex: 0,
      options: {
        expectedType: Config.FILESYSTEM.DEFAULT_FILE_TYPE
      }
    }, {
      argIndex: 1,
      options: {
        expectedType: Config.FILESYSTEM.DEFAULT_FILE_TYPE
      }
    }, ],
    permissionChecks: [{
      pathArgIndex: 0,
      permissions: ["read"]
    }, {
      pathArgIndex: 1,
      permissions: ["read"]
    }, ],
    coreLogic: async (context) => {
      const {
        validatedPaths
      } = context;
      const file1Node = validatedPaths[0].node;
      const file2Node = validatedPaths[1].node;

      const diffResult = DiffUtils.compare(
          file1Node.content || "",
          file2Node.content || ""
      );

      return {
        success: true,
        output: diffResult,
      };
    },
  };
  const wgetCommandDefinition = {
    flagDefinitions: [{
      name: "outputFile",
      short: "-O",
      takesValue: true,
    }, ],
    argValidation: {
      min: 1,
      error: "Usage: wget [-O <file>] <URL>"
    },
    coreLogic: async (context) => {
      const {
        args,
        flags,
        currentUser
      } = context;
      const url = args[0];
      let outputFileName = flags.outputFile;

      if (!outputFileName) {
        try {
          const urlPath = new URL(url).pathname;
          const segments = urlPath.split('/');
          outputFileName = segments.pop() || "index.html";
        } catch (e) {
          return {
            success: false,
            error: `wget: Invalid URL '${url}'`
          };
        }
      }

      const pathValidation = FileSystemManager.validatePath("wget", outputFileName, {
        allowMissing: true,
        disallowRoot: true
      });
      if (pathValidation.error) return {
        success: false,
        error: pathValidation.error
      };

      await OutputManager.appendToOutput(`--OopisOS WGET--\nResolving ${url}...`);

      try {
        const response = await fetch(url);
        await OutputManager.appendToOutput(`Connecting to ${new URL(url).hostname}... connected.`);
        await OutputManager.appendToOutput(`HTTP request sent, awaiting response... ${response.status} ${response.statusText}`);

        if (!response.ok) {
          return {
            success: false,
            error: `wget: Server responded with status ${response.status} ${response.statusText}`
          };
        }

        const contentLength = response.headers.get('content-length');
        const sizeStr = contentLength ? Utils.formatBytes(parseInt(contentLength, 10)) : 'unknown size';
        await OutputManager.appendToOutput(`Length: ${sizeStr}`);

        const content = await response.text();
        const primaryGroup = UserManager.getPrimaryGroupForUser(currentUser);
        if (!primaryGroup) {
          return {
            success: false,
            error: "wget: critical - could not determine primary group for user."
          };
        }

        const saveResult = await FileSystemManager.createOrUpdateFile(
            pathValidation.resolvedPath,
            content, {
              currentUser,
              primaryGroup
            }
        );

        if (!saveResult.success) {
          return {
            success: false,
            error: `wget: ${saveResult.error}`
          };
        }

        await OutputManager.appendToOutput(`Saving to: ‘${outputFileName}’`);
        await FileSystemManager.save();
        return {
          success: true,
          output: `‘${outputFileName}’ saved [${content.length} bytes]`,
          messageType: Config.CSS_CLASSES.SUCCESS_MSG
        };

      } catch (e) {
        let errorMsg = `wget: An error occurred. This is often due to a network issue or a CORS policy preventing access.`;
        if (e instanceof TypeError && e.message.includes('Failed to fetch')) {
          errorMsg = `wget: Network request failed. The server may be down, or a CORS policy is blocking the request from the browser.`;
        }
        return {
          success: false,
          error: errorMsg
        };
      }
    },
  };
  const curlCommandDefinition = {
    flagDefinitions: [{
      name: "output",
      short: "-o",
      long: "--output",
      takesValue: true
    }, {
      name: "include",
      short: "-i",
      long: "--include",
    }, {
      name: "location",
      short: "-L",
      long: "--location",
    }, ],
    argValidation: {
      min: 1,
      error: "Usage: curl [options] <URL>"
    },
    coreLogic: async (context) => {
      const {
        args,
        flags,
        currentUser
      } = context;
      const url = args[0];

      try {
        const response = await fetch(url);
        const content = await response.text();
        let outputString = "";

        if (flags.include) {
          outputString += `HTTP/1.1 ${response.status} ${response.statusText}\n`;
          response.headers.forEach((value, name) => {
            outputString += `${name}: ${value}\n`;
          });
          outputString += '\n';
        }

        outputString += content;

        if (flags.output) {
          const primaryGroup = UserManager.getPrimaryGroupForUser(currentUser);
          if (!primaryGroup) {
            return {
              success: false,
              error: "curl: critical - could not determine primary group for user."
            };
          }
          const absPath = FileSystemManager.getAbsolutePath(flags.output, FileSystemManager.getCurrentPath());
          const saveResult = await FileSystemManager.createOrUpdateFile(
              absPath,
              outputString, {
                currentUser,
                primaryGroup
              }
          );

          if (!saveResult.success) {
            return {
              success: false,
              error: `curl: ${saveResult.error}`
            };
          }
          await FileSystemManager.save();
          return {
            success: true,
            output: ""
          };
        } else {
          return {
            success: true,
            output: outputString
          };
        }
      } catch (e) {
        let errorMsg = `curl: (7) Failed to connect to host. This is often a network issue or a CORS policy preventing access.`;
        if (e instanceof TypeError && e.message.includes('Failed to fetch')) {
          errorMsg = `curl: (7) Couldn't connect to server. The server may be down, or a CORS policy is blocking the request from the browser.`
        } else if (e instanceof URIError) {
          errorMsg = `curl: (3) URL using bad/illegal format or missing URL`;
        }
        return {
          success: false,
          error: errorMsg
        };
      }
    },
  };
  const commands = {
    alias: {
      handler: createCommandHandler(aliasCommandDefinition),
      description: "Creates, or lists, command aliases.",
      helpText: `Usage: alias [name='value']\n\nDefines or displays command aliases.\n\n  alias              List all aliases in the form name='value'.\n  alias name='value'  Define an alias 'name' for the command 'value'.\n                      The value can be quoted.`,
    },
    diff: {
      handler: createCommandHandler(diffCommandDefinition),
      description: "Compares two files line by line.",
      helpText:
          "Usage: diff <file1> <file2>\n\nCompares two files and displays the differences.",
    },
    unalias: {
      handler: createCommandHandler(unaliasCommandDefinition),
      description: "Removes command aliases.",
      helpText: `Usage: unalias <alias_name>...\n\nRemoves each specified alias from the list of defined aliases.`,
    },
    gemini: {
      handler: createCommandHandler(geminiCommandDefinition),
      description: "Sends a context-aware prompt to Gemini AI.",
      helpText: `Usage: gemini [-n|--new] "<prompt>"

			Engages in a context-aware conversation with the Gemini AI.

			FEATURES:
			- FILE SYSTEM AWARENESS: Can run OopisOS commands (ls, cat, find, etc.)
			to gather information from your file system to answer questions.

			- CONVERSATIONAL MEMORY: Remembers the previous turns of your
			conversation. You can ask follow-up questions, and Gemini will
			understand the context.

			- SESSION CONTROL:
			-n, --new    Starts a new, fresh conversation, clearing any
			previous conversational memory for this session.

			EXAMPLES:
			# Ask a question that requires finding and reading files
			gemini "Summarize my README.md and list the functions in diag_2.3.sh"

			# Ask a follow-up question (Gemini remembers the context)
			gemini "Now, what was the first function you listed?"

			# Start a completely new conversation, ignoring the previous one
			gemini -n "What is OopisOS?"`,
    },
    help: {
      handler: createCommandHandler(helpCommandDefinition),
      description: "Displays help information.",
      helpText:
          "Usage: help [command]\n\nDisplays a list of commands or help for a specific [command].",
    },
    echo: {
      handler: createCommandHandler(echoCommandDefinition),
      description: "Displays a line of text.",
      helpText:
          "Usage: echo [text...]\n\nPrints the specified [text] to the terminal.",
    },
    reboot: {
      handler: createCommandHandler(rebootCommandDefinition),
      description:
          "Reboots OopisOS by reloading the browser page and clearing its cache, preserving user data.",
      helpText: "Usage: reboot",
    },
    clear: {
      handler: createCommandHandler(clearCommandDefinition),
      description: "Clears the terminal screen.",
      helpText:
          "Usage: clear\n\nClears all previous output from the terminal screen.",
    },
    date: {
      handler: createCommandHandler(dateCommandDefinition),
      description: "Displays the current date and time.",
      helpText: "Usage: date\n\nShows the current system date and time.",
    },
    pwd: {
      handler: createCommandHandler(pwdCommandDefinition),
      description: "Prints the current working directory.",
      helpText:
          "Usage: pwd\n\nDisplays the full path of the current directory.",
    },
    ls: {
      handler: createCommandHandler(lsCommandDefinition),
      description: "Lists directory contents or file information.",
      helpText: `Usage: ls [OPTIONS] [PATH...]\n\nLists information about the FILEs (the current directory by default).\nSort entries alphabetically if none of -tSUXU is specified.\n\nOptions:\n  -a, --all          Do not ignore entries starting with .\n  -d, --dirs-only    List directories themselves, rather than their contents.\n  -l, --long         Use a long listing format.\n  -R, --recursive    List subdirectories recursively.\n  -r, --reverse      Reverse order while sorting.\n  -S                 Sort by file size, largest first.\n  -t                 Sort by modification time, newest first.\n  -X                 Sort alphabetically by entry extension.\n  -U                 Do not sort; list entries in directory order.`,
    },
    cd: {
      handler: createCommandHandler(cdCommandDefinition),
      description: "Changes the current directory.",
      helpText:
          "Usage: cd <directory_path>\n\nChanges the current working directory to the specified <directory_path>.",
    },
    mkdir: {
      handler: createCommandHandler(mkdirCommandDefinition),
      description: "Creates new directories.",
      helpText:
          "Usage: mkdir [-p] <directory_name>...\n\nCreates one or more new directories with the specified names.\n  -p, --parents   No error if existing, make parent directories as needed.",
    },
    tree: {
      handler: createCommandHandler(treeCommandDefinition),
      description: "Lists contents of directories in a tree-like format.",
      helpText:
          "Usage: tree [-L level] [-d] [path]\n\nLists the contents of directories in a tree-like format.\n  -L level  Descend only level directories deep.\n  -d        List directories only.",
    },
    touch: {
      handler: createCommandHandler(touchCommandDefinition),
      description: "Changes file/directory timestamps or creates empty files.",
      helpText: `Usage: touch [-c] [-d DATETIME_STRING | -t STAMP] <item_path>...\n\nUpdates the modification time of each specified <item_path>.\nIf <item_path> does not exist, it is created empty (as a file), unless -c is given.\n\nOptions:\n  -c, --no-create    Do not create any files.\n  -d, --date=STRING  Parse STRING and use it instead of current time.\n  -t STAMP           Use [[CC]YY]MMDDhhmm[.ss] instead of current time.`,
    },
    cat: {
      handler: createCommandHandler(catCommandDefinition),
      description: "Concatenates and displays files.",
      helpText:
          "Usage: cat [file...]\n\nConcatenates and displays the content of one or more specified files. If no files are given, it reads from standard input (e.g., from a pipe).",
    },
    rm: {
      handler: createCommandHandler(rmCommandDefinition),
      description: "Removes files or directories.",
      helpText: `Usage: rm [-rRf] <item_path>...\n\nRemoves specified files or directories.\n  -r, -R, --recursive   Remove directories and their contents recursively.\n  -f, --force           Ignore nonexistent files and arguments, never prompt.`,
    },
    mv: {
      handler: createCommandHandler(mvCommandDefinition),
      description: "Moves or renames files and directories.",
      helpText: `Usage: mv [-f] [-i] <source> <dest>\n       mv [-f] [-i] <source>... <directory>\n\nMoves (renames) files or moves them to a different directory.\n  -f, --force       Do not prompt before overwriting.\n  -i, --interactive Prompt before overwriting.`,
    },
    cp: {
      handler: createCommandHandler(cpCommandDefinition),
      description: "Copies files and directories.",
      helpText: `Usage: cp [-rR] [-fip] <source> <dest>\n       cp [-rR] [-fip] <source>... <directory>\n\nCopies files and directories.\n  -r, -R, --recursive Copy directories recursively.\n  -f, --force         Do not prompt before overwriting.\n  -i, --interactive   Prompt before overwriting.\n  -p, --preserve      Preserve mode, ownership, and timestamps.`,
    },
    history: {
      handler: createCommandHandler(historyCommandDefinition),
      description: "Displays command history.",
      helpText:
          "Usage: history [-c]\n\nDisplays the command history. Use '-c' or '--clear' to clear the history.",
    },
    edit: {
      handler: createCommandHandler(editCommandDefinition),
      description: "Opens a file in the text editor.",
      helpText:
          "Usage: edit <file_path>\n\nOpens the specified <file_path> in the built-in text editor. If the file does not exist, it will be created upon saving.",
    },
    grep: {
      handler: createCommandHandler(grepCommandDefinition),
      description: "Searches for patterns in files or input.",
      helpText:
          "Usage: grep [OPTIONS] PATTERN [FILE...]\n\nSearch for PATTERN in each FILE or standard input.\n\nOptions:\n  -i, --ignore-case   Ignore case distinctions.\n  -v, --invert-match  Select non-matching lines.\n  -n, --line-number   Print line number with output lines.\n  -c, --count         Print only a count of matching lines per FILE.\n  -R, --recursive     Read all files under each directory, recursively.",
    },
    useradd: {
      handler: createCommandHandler(useraddCommandDefinition),
      description: "Creates a new user account.",
      helpText:
          "Usage: useradd <username>\n\nCreates a new user account with the specified username. Will prompt for a password.",
    },
    login: {
      handler: createCommandHandler(loginCommandDefinition),
      description: "Logs in as a specified user.",
      helpText:
          "Usage: login <username> [password]\n\nLogs in as the specified user. If a password is not provided and one is required, you will be prompted.",
    },
    logout: {
      handler: createCommandHandler(logoutCommandDefinition),
      description: "Logs out the current user.",
      helpText:
          "Usage: logout\n\nLogs out the current user and returns to the Guest session.",
    },
    whoami: {
      handler: createCommandHandler(whoamiCommandDefinition),
      description: "Displays the current username.",
      helpText:
          "Usage: whoami\n\nPrints the username of the currently logged-in user.",
    },
    export: {
      handler: createCommandHandler(exportCommandDefinition),
      description: "Exports a file from the virtual FS to the user's computer.",
      helpText:
          "Usage: export <file_path>\n\nDownloads the specified file from OopisOS's virtual file system.",
    },
    upload: {
      handler: createCommandHandler(uploadCommandDefinition),
      description:
          "Uploads one or more files from the user's computer to the virtual FS.",
      helpText:
          "Usage: upload [-f] [destination_directory]\n\nPrompts to select files to upload to the current or specified directory.\n  -f, --force   Overwrite existing files without prompting.",
    },
    backup: {
      handler: createCommandHandler(backupCommandDefinition),
      description: "Creates a JSON backup of the current user's file system.",
      helpText:
          "Usage: backup\n\nCreates a JSON file containing a snapshot of the current user's entire file system.",
    },
    restore: {
      handler: createCommandHandler(restoreCommandDefinition),
      description: "Restores the file system from a JSON backup file.",
      helpText:
          "Usage: restore\n\nPrompts to select an OopisOS JSON backup file to restore the file system. Requires confirmation.",
    },
    savefs: {
      handler: createCommandHandler(savefsCommandDefinition),
      description: "Manually saves the current user's file system state.",
      helpText:
          "Usage: savefs\n\nManually triggers a save of the current user's file system to persistent storage.",
    },
    su: {
      handler: createCommandHandler(suCommandDefinition),
      description: "Substitute user identity.",
      helpText:
          "Usage: su [username]\n\nSwitches the current user to [username] (defaults to 'root'). Will prompt for password if required.",
    },
    clearfs: {
      handler: createCommandHandler(clearfsCommandDefinition),
      description:
          "Clears the current user's home directory to a default empty state.",
      helpText: `Usage: clearfs\n\nWARNING: This command will permanently erase all files and directories in your home directory. This action requires confirmation.`,
    },
    savestate: {
      handler: createCommandHandler(savestateCommandDefinition),
      description: "Saves the current terminal session (FS, output, history).",
      helpText:
          "Usage: savestate\n\nManually saves the entire current terminal session for the current user.",
    },
    loadstate: {
      handler: createCommandHandler(loadstateCommandDefinition),
      description: "Loads a previously saved terminal session.",
      helpText:
          "Usage: loadstate\n\nAttempts to load a manually saved terminal session for the current user. Requires confirmation.",
    },
    reset: {
      handler: createCommandHandler(resetCommandDefinition),
      description:
          "Resets all OopisOS data (users, FS, states) to factory defaults.",
      helpText:
          "Usage: reset\n\nWARNING: Resets all OopisOS data to its initial factory state. This operation is irreversible and requires confirmation.",
    },
    run: {
      handler: createCommandHandler(runCommandDefinition),
      description: "Executes a script file containing OopisOS commands.",
      helpText:
          "Usage: run <script_path> [arg1 arg2 ...]\n\nExecutes the commands listed in the specified .sh script file.\nSupports argument passing: $1, $2, ..., $@, $#.",
    },
    groupdel: {
      handler: createCommandHandler(groupdelCommandDefinition),
      description: "Deletes a user group.",
      helpText: "Usage: groupdel <groupname>\n\nDeletes an existing user group. (root only)",
    },
    find: {
      handler: createCommandHandler(findCommandDefinition),
      description:
          "Searches for files in a directory hierarchy based on expressions.",
      helpText: `Usage: find [path] [expression]\n\nSearches for files. Default path is '.' Default action is '-print'.\nTests: -name, -type, -user, -perm, -mtime, -newermt, -oldermt\nOperators: -not, -o, -a\nActions: -print, -exec, -delete`,
    },
    delay: {
      handler: createCommandHandler(delayCommandDefinition),
      description: "Pauses execution for a specified time.",
      helpText:
          "Usage: delay <milliseconds>\n\nPauses command execution for the specified number of milliseconds.",
    },
    check_fail: {
      handler: createCommandHandler(check_failCommandDefinition),
      description:
          "Tests if a given command string fails, for use in test scripts.",
      helpText:
          'Usage: check_fail "<command_string>"\n\nSucceeds if the command fails, and fails if the command succeeds.',
    },
    removeuser: {
      handler: createCommandHandler(removeuserCommandDefinition),
      description: "Removes a user account and all their data.",
      helpText:
          "Usage: removeuser [-f] <username>\n\nPermanently removes the specified user and all their data.\n  -f, --force    Do not prompt for confirmation.",
    },
    chmod: {
      handler: createCommandHandler(chmodCommandDefinition),
      description: "Changes file mode bits (permissions).",
      helpText: "Usage: chmod <mode> <path>\n\nChanges the permissions of <path> to <mode> (a 3 or 4-digit octal number like 755)."
    },
    chown: {
      handler: createCommandHandler(chownCommandDefinition),
      description: "Changes file owner.",
      helpText:
          "Usage: chown <new_owner> <path>\n\nChanges the owner of <path>. Only root can do this.",
    },
    listusers: {
      handler: createCommandHandler(listusersCommandDefinition),
      description: "Lists all registered user accounts.",
      helpText:
          "Usage: listusers\n\nDisplays a list of all user accounts registered in OopisOS.",
    },
    printscreen: {
      handler: createCommandHandler(printscreenCommandDefinition),
      description: "Saves the current terminal output to a file.",
      helpText: `Usage: printscreen <filepath>\n\nSaves the visible terminal output history to the specified file.`,
    },
    adventure: {
      handler: createCommandHandler(adventureCommandDefinition),
      description: "Starts a text-based adventure game.",
      helpText:
          "Usage: adventure [path_to_adventure_file.json]\n\nStarts a text adventure. Loads from file if specified, otherwise starts a sample game.",
    },
    ps: {
      handler: createCommandHandler(psCommandDefinition),
      description: "Lists active background jobs.",
      helpText:
          "Usage: ps\n\nDisplays a list of processes running in the background, showing their Process ID (PID) and the command that started them.",
    },
    kill: {
      handler: createCommandHandler(killCommandDefinition),
      description: "Terminates a background job.",
      helpText:
          "Usage: kill <job_id>\n\nTerminates the background job specified by its process ID (PID).",
    },
    chgrp: {
      handler: createCommandHandler(chgrpCommandDefinition),
      description: "Changes file group ownership.",
      helpText:
          "Usage: chgrp <group> <path>\n\nChanges the group of a file or directory. Only the owner or root can do this.",
    },
    groupadd: {
      handler: createCommandHandler(groupaddCommandDefinition),
      description: "Creates a new user group.",
      helpText:
          "Usage: groupadd <groupname>\n\nCreates a new user group. (root only)",
    },
    groups: {
      handler: createCommandHandler(groupsCommandDefinition),
      description: "Prints the groups a user is in.",
      helpText:
          "Usage: groups [username]\n\nDisplays group membership for the specified or current user.",
    },
    usermod: {
      handler: createCommandHandler(usermodCommandDefinition),
      description: "Modifies a user account.",
      helpText:
          "Usage: usermod -aG <groupname> <username>\n\nAdds a user to a supplementary group. (root only)",
    },
    curl: {
      handler: createCommandHandler(curlCommandDefinition),
      description: "Transfers data from or to a server.",
      helpText: "Usage: curl [options] <URL>\n\nTransfers data from a URL. By default, prints content to the terminal.\n  -o, --output <file>   Write output to <file> instead of stdout.\n  -i, --include         Include protocol response headers in the output.\n  -L, --location        Follow redirects (this is default behavior).",
    },
    wget: {
      handler: createCommandHandler(wgetCommandDefinition),
      description: "Downloads files from the network.",
      helpText: "Usage: wget [-O <file>] <URL>\n\nDownloads a file from a URL.\n  -O <file>   Save the file with a specific name.",
    },
  };
  async function _executeCommandHandler(segment, execCtxOpts, stdinContent = null, signal) {
    const commandName = segment.command?.toLowerCase();
    const cmdData = commandName ? commands[commandName] : undefined;

    if (cmdData?.handler) {
      try {
        return await cmdData.handler(segment.args, {
          ...execCtxOpts,
          stdinContent,
          signal,
        });
      } catch (e) {
        console.error(`Error in command handler for '${segment.command}':`, e);
        return {
          success: false,
          error: `Command '${segment.command}' failed: ${
              e.message || "Unknown error"
          }`,
        };
      }
    } else if (segment.command) {
      return {
        success: false,
        error: `${segment.command}: command not found`,
      };
    }
    return {
      success: true,
      output: "",
    };
  }
  async function _executePipeline(pipeline, isInteractive, signal, scriptingContext) {
    let currentStdin = null;
    let lastResult = {
      success: true,
      output: "",
    };
    if (
        typeof UserManager === "undefined" ||
        typeof UserManager.getCurrentUser !== "function"
    ) {
      const errorMsg =
          "FATAL: State corruption detected (UserManager is unavailable). Please refresh the page.";
      console.error(errorMsg);
      await OutputManager.appendToOutput(errorMsg, {
        typeClass: Config.CSS_CLASSES.ERROR_MSG,
      });
      return {
        success: false,
        error: errorMsg,
      };
    }
    const user = UserManager.getCurrentUser().name;
    const nowISO = new Date().toISOString();
    for (let i = 0; i < pipeline.segments.length; i++) {
      const segment = pipeline.segments[i];
      lastResult = await _executeCommandHandler(
          segment,
          {
            isInteractive,
            scriptingContext
          },
          currentStdin,
          signal
      );
      if (!lastResult) {
        const err = `Critical: Command handler for '${segment.command}' returned an undefined result.`;
        console.error(err, "Pipeline:", pipeline, "Segment:", segment);
        lastResult = {
          success: false,
          error: err,
        };
      }

      // If the command we just ran has now set the 'waitingForInput' flag, we must exit this loop
      // and let the main 'run' loop take over feeding input.
      if (scriptingContext?.waitingForInput) {
        return { success: true, output: null }; // Signal to run loop to switch modes
      }

      if (!lastResult.success) {
        const err = `${Config.MESSAGES.PIPELINE_ERROR_PREFIX}'${
            segment.command
        }': ${lastResult.error || "Unknown"}`;
        if (!pipeline.isBackground) {
          await OutputManager.appendToOutput(err, {
            typeClass: Config.CSS_CLASSES.ERROR_MSG,
          });
        } else {
          console.log(`Background job pipeline error: ${err}`);
        }
        return lastResult;
      }
      currentStdin = lastResult.output;
    }
    if (pipeline.redirection && lastResult.success) {
      const { type: redirType, file: redirFile } = pipeline.redirection;
      const outputToRedir = lastResult.output || "";
      const redirVal = FileSystemManager.validatePath(
          "redirection",
          redirFile,
          {
            allowMissing: true,
            disallowRoot: true,
            defaultToCurrentIfEmpty: false,
          }
      );
      if (
          redirVal.error &&
          !(redirVal.optionsUsed.allowMissing && !redirVal.node)
      ) {
        if (!pipeline.isBackground)
          await OutputManager.appendToOutput(redirVal.error, {
            typeClass: Config.CSS_CLASSES.ERROR_MSG,
          });
        return {
          success: false,
          error: redirVal.error,
        };
      }
      const absRedirPath = redirVal.resolvedPath;
      let targetNode = redirVal.node;
      const pDirRes =
          FileSystemManager.createParentDirectoriesIfNeeded(absRedirPath);
      if (pDirRes.error) {
        if (!pipeline.isBackground)
          await OutputManager.appendToOutput(`Redir err: ${pDirRes.error}`, {
            typeClass: Config.CSS_CLASSES.ERROR_MSG,
          });
        return {
          success: false,
          error: pDirRes.error,
        };
      }
      const finalParentDirPath =
          absRedirPath.substring(
              0,
              absRedirPath.lastIndexOf(Config.FILESYSTEM.PATH_SEPARATOR)
          ) || Config.FILESYSTEM.ROOT_PATH;
      const finalParentNodeForFile =
          FileSystemManager.getNodeByPath(finalParentDirPath);
      if (!finalParentNodeForFile) {
        if (!pipeline.isBackground)
          await OutputManager.appendToOutput(
              `Redir err: critical internal error, parent dir '${finalParentDirPath}' for file write not found.`,
              {
                typeClass: Config.CSS_CLASSES.ERROR_MSG,
              }
          );
        return {
          success: false,
          error: `parent dir '${finalParentDirPath}' for file write not found (internal)`,
        };
      }
      targetNode = FileSystemManager.getNodeByPath(absRedirPath);
      if (
          targetNode &&
          targetNode.type === Config.FILESYSTEM.DEFAULT_DIRECTORY_TYPE
      ) {
        if (!pipeline.isBackground)
          await OutputManager.appendToOutput(
              `Redir err: '${redirFile}' is dir.`,
              {
                typeClass: Config.CSS_CLASSES.ERROR_MSG,
              }
          );
        return {
          success: false,
          error: `'${redirFile}' is dir.`,
        };
      }
      if (
          targetNode &&
          !FileSystemManager.hasPermission(targetNode, user, "write")
      ) {
        if (!pipeline.isBackground)
          await OutputManager.appendToOutput(
              `Redir err: no write to '${redirFile}'${Config.MESSAGES.PERMISSION_DENIED_SUFFIX}`,
              {
                typeClass: Config.CSS_CLASSES.ERROR_MSG,
              }
          );
        return {
          success: false,
          error: `no write to '${redirFile}'`,
        };
      }
      if (
          !targetNode &&
          !FileSystemManager.hasPermission(finalParentNodeForFile, user, "write")
      ) {
        if (!pipeline.isBackground)
          await OutputManager.appendToOutput(
              `Redir err: no create in '${finalParentDirPath}'${Config.MESSAGES.PERMISSION_DENIED_SUFFIX}`,
              {
                typeClass: Config.CSS_CLASSES.ERROR_MSG,
              }
          );
        return {
          success: false,
          error: `no create in '${finalParentDirPath}'`,
        };
      }
      const fName = absRedirPath.substring(
          absRedirPath.lastIndexOf(Config.FILESYSTEM.PATH_SEPARATOR) + 1
      );
      let exContent = "";
      if (
          redirType === "append" &&
          finalParentNodeForFile.children[fName]?.type ===
          Config.FILESYSTEM.DEFAULT_FILE_TYPE
      ) {
        exContent = finalParentNodeForFile.children[fName].content || "";
        if (exContent && !exContent.endsWith("\n") && outputToRedir)
          exContent += "\n";
      }
      if (targetNode) {
        targetNode.content = exContent + outputToRedir;
      } else {
        const primaryGroup = UserManager.getPrimaryGroupForUser(user);
        if (!primaryGroup) {
          if (!pipeline.isBackground)
            await OutputManager.appendToOutput(
                `Redirection error: could not determine primary group for user '${user}'.`,
                { typeClass: Config.CSS_CLASSES.ERROR_MSG }
            );
          return {
            success: false,
            error: "internal redirection error: no primary group",
          };
        }
        finalParentNodeForFile.children[fName] =
            FileSystemManager._createNewFileNode(
                fName,
                exContent + outputToRedir,
                user,
                primaryGroup
            );
      }
      FileSystemManager._updateNodeAndParentMtime(absRedirPath, nowISO);
      if (!(await FileSystemManager.save())) {
        if (!pipeline.isBackground)
          await OutputManager.appendToOutput(
              `Failed to save redir to '${redirFile}'.`,
              {
                typeClass: Config.CSS_CLASSES.ERROR_MSG,
              }
          );
        return {
          success: false,
          error: `save redir fail`,
        };
      }
      lastResult.output = null;
    }
    if (
        !pipeline.redirection &&
        lastResult.success &&
        lastResult.output !== null &&
        lastResult.output !== undefined
    ) {
      if (!pipeline.isBackground) {
        if (lastResult.output) {
          await OutputManager.appendToOutput(lastResult.output, {
            typeClass: lastResult.messageType || null,
          });
        }
      } else if (lastResult.output && pipeline.isBackground) {
        await OutputManager.appendToOutput(
            `${Config.MESSAGES.BACKGROUND_PROCESS_OUTPUT_SUPPRESSED} (Job ${pipeline.jobId})`,
            {
              typeClass: Config.CSS_CLASSES.CONSOLE_LOG_MSG,
              isBackground: true,
            }
        );
      }
    }
    return lastResult;
  }
  async function _finalizeInteractiveModeUI(originalCommandText) {
    TerminalUI.clearInput();
    TerminalUI.updatePrompt();
    if (!EditorManager.isActive()) {
      if (DOM.inputLineContainerDiv) {
        DOM.inputLineContainerDiv.classList.remove(Config.CSS_CLASSES.HIDDEN);
      }
      TerminalUI.focusInput();
    }
    if (DOM.outputDiv) {
      DOM.outputDiv.scrollTop = DOM.outputDiv.scrollHeight;
    }
    if (!TerminalUI.getIsNavigatingHistory() && originalCommandText.trim()) {
      HistoryManager.resetIndex();
    }
    TerminalUI.setIsNavigatingHistory(false);
  }
  async function processSingleCommand(rawCommandText, isInteractive = true, scriptingContext = null) {
    let overallResult = {
      success: true,
      output: null,
      error: null,
    };
    if (
        scriptExecutionInProgress &&
        isInteractive &&
        !ModalManager.isAwaiting()
    ) {
      await OutputManager.appendToOutput(
          "Script execution in progress. Input suspended.",
          {
            typeClass: Config.CSS_CLASSES.WARNING_MSG,
          }
      );
      return {
        success: false,
        error: "Script execution in progress.",
      };
    }
    if (ModalManager.isAwaiting()) {
      await ModalManager.handleTerminalInput(rawCommandText);
      if (isInteractive) await _finalizeInteractiveModeUI(rawCommandText);
      return overallResult;
    }
    if (EditorManager.isActive()) return overallResult;

    const aliasResult = AliasManager.resolveAlias(rawCommandText.trim());
    if (aliasResult.error) {
      await OutputManager.appendToOutput(aliasResult.error, {
        typeClass: Config.CSS_CLASSES.ERROR_MSG,
      });
      if (isInteractive) await _finalizeInteractiveModeUI(rawCommandText);
      return {
        success: false,
        error: aliasResult.error,
      };
    }

    const commandToProcess = aliasResult.newCommand;
    const cmdToEcho = rawCommandText.trim();
    if (isInteractive) {
      DOM.inputLineContainerDiv.classList.add(Config.CSS_CLASSES.HIDDEN);
      const prompt = `${DOM.promptUserSpan.textContent}${Config.TERMINAL.PROMPT_AT}${DOM.promptHostSpan.textContent}${Config.TERMINAL.PROMPT_SEPARATOR}${DOM.promptPathSpan.textContent}${Config.TERMINAL.PROMPT_CHAR} `;
      await OutputManager.appendToOutput(`${prompt}${cmdToEcho}`);
    }
    if (cmdToEcho === "") {
      if (isInteractive) await _finalizeInteractiveModeUI(rawCommandText);
      return overallResult;
    }
    if (isInteractive) HistoryManager.add(cmdToEcho);
    if (isInteractive && !TerminalUI.getIsNavigatingHistory())
      HistoryManager.resetIndex();
    let parsedPipelines;
    try {
      parsedPipelines = new Parser(
          new Lexer(commandToProcess).tokenize()
      ).parse();
      if (
          parsedPipelines.length === 0 ||
          (parsedPipelines.length === 1 &&
              parsedPipelines[0].segments.length === 0 &&
              !parsedPipelines[0].redirection &&
              !parsedPipelines[0].isBackground)
      ) {
        if (isInteractive) await _finalizeInteractiveModeUI(rawCommandText);
        return {
          success: true,
          output: "",
        };
      }
    } catch (e) {
      await OutputManager.appendToOutput(e.message || "Command parse error.", {
        typeClass: Config.CSS_CLASSES.ERROR_MSG,
      });
      if (isInteractive) await _finalizeInteractiveModeUI(rawCommandText);
      return {
        success: false,
        error: e.message || "Command parse error.",
      };
    }
    for (const pipeline of parsedPipelines) {
      if (
          pipeline.segments.length === 0 &&
          !pipeline.redirection &&
          !pipeline.isBackground
      ) {
        continue;
      }
      if (pipeline.isBackground) {
        const jobId = ++backgroundProcessIdCounter;
        pipeline.jobId = jobId;
        const abortController = new AbortController();
        activeJobs[jobId] = {
          id: jobId,
          command: cmdToEcho,
          abortController: abortController,
        };
        await OutputManager.appendToOutput(
            `${Config.MESSAGES.BACKGROUND_PROCESS_STARTED_PREFIX}${pipeline.jobId}${Config.MESSAGES.BACKGROUND_PROCESS_STARTED_SUFFIX}`,
            {
              typeClass: Config.CSS_CLASSES.CONSOLE_LOG_MSG,
            }
        );
        overallResult = {
          success: true,
          output: null,
        };
        setTimeout(async () => {
          try {
            const bgResult = await _executePipeline(pipeline, false, abortController.signal, scriptingContext);
            const statusMsg = `[Job ${jobId} ${
                bgResult.success ? "finished" : "finished with error"
            }${
                bgResult.success ? "" : `: ${bgResult.error || "Unknown error"}`
            }]`;
            await OutputManager.appendToOutput(statusMsg, {
              typeClass: bgResult.success
                  ? Config.CSS_CLASSES.CONSOLE_LOG_MSG
                  : Config.CSS_CLASSES.WARNING_MSG,
              isBackground: true,
            });
            if (!bgResult.success)
              console.log(
                  `Background job ${jobId} error details: ${
                      bgResult.error || "No specific error message."
                  }`
              );
          } finally {
            delete activeJobs[jobId];
          }
        }, 0);
      } else {
        overallResult = await _executePipeline(pipeline, isInteractive, null, scriptingContext);
        if (!overallResult) {
          const err =
              "Critical: Pipeline execution returned an undefined result.";
          console.error(err, "Pipeline:", pipeline);
          overallResult = {
            success: false,
            error: err,
          };
        }
        if (!overallResult.success) break;
      }
    }
    if (isInteractive && !scriptExecutionInProgress) {
      await _finalizeInteractiveModeUI(rawCommandText);
    }
    return (
        overallResult || {
          success: false,
          error: "Fell through processSingleCommand logic.",
        }
    );
  }
  function getCommands() {
    return commands;
  }
  function isScriptRunning() {
    return scriptExecutionInProgress;
  }
  function setScriptExecutionInProgress(status) {
    scriptExecutionInProgress = status;
  }
  return {
    processSingleCommand,
    getCommands,
    isScriptRunning,
    setScriptExecutionInProgress,
    getActiveJobs,
    killJob,
  };
})();