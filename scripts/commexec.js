// commexec.js - OopisOS Command Executor

/**
 * @file Manages the execution of all commands, pipelines, I/O redirection, and background processes.
 * @module CommandExecutor
 */
const CommandExecutor = (() => {
  "use strict";

  /**
   * A flag to indicate if a script is currently being executed by the 'run' command.
   * This prevents nested script execution in interactive mode and manages input suspension.
   * @private
   * @type {boolean}
   */
  let scriptExecutionInProgress = false;

  /**
   * A counter to assign unique IDs to background processes.
   * @private
   * @type {number}
   */
  let backgroundProcessIdCounter = 0;

  /**
   * An object to store active background jobs, keyed by their process ID (PID).
   * Each job object contains its ID, the command string, and an AbortController.
   * @private
   * @type {Object.<number, {id: number, command: string, abortController: AbortController}>}
   */
  let activeJobs = {};

  /**
   * A dictionary to hold all registered command definitions and their handlers.
   * This is populated by `_initializeCommands`.
   * @private
   * @type {Object.<string, {handler: Function, description: string, helpText: string}>}
   */
  const commands = {};

  /**
   * Initializes the CommandExecutor by populating the internal `commands` object
   * from the definitions stored in the `CommandRegistry`. This function is called
   * once when the OS boots.
   * @private
   */
  function _initializeCommands() {
    const definitions = CommandRegistry.getDefinitions();
    for (const commandName in definitions) {
      const cmd = definitions[commandName];
      if (commands[commandName]) {
        console.warn(`CommandExecutor: Overwriting command '${commandName}' during initialization.`);
      }
      commands[commandName] = {
        handler: createCommandHandler(cmd.definition),
        description: cmd.description,
        helpText: cmd.helpText,
      };
    }
  }

  /**
   * A factory function that takes a command definition and returns a standardized,
   * wrapped async command handler. This wrapper performs all the boilerplate checks
   * like argument validation, flag parsing, path validation, and permission checks
   * before invoking the command's core logic.
   * @param {object} definition - The command's definition object from its file.
   * @returns {Function} An async function that serves as the standardized handler.
   */
  function createCommandHandler(definition) {
    const handler = async (args, options) => {
      const { flags, remainingArgs } = Utils.parseFlags(
          args,
          definition.flagDefinitions || []
      );
      const currentUser = UserManager.getCurrentUser().name;

      // 1. Argument Count Validation
      if (definition.argValidation) {
        const validation = Utils.validateArguments(remainingArgs, definition.argValidation);
        if (!validation.isValid) {
          return { success: false, error: `${definition.commandName}: ${validation.errorDetail}` };
        }
      }

      // 2. Path Validation
      const validatedPaths = {};
      if (definition.pathValidation) {
        for (const pv of definition.pathValidation) {
          const pathArg = remainingArgs[pv.argIndex];
          if (pathArg === undefined) {
            if (pv.optional) {
              continue; // Skip optional missing paths
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
            // Only fail if the path wasn't allowed to be missing
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

      // 3. Permission Checks
      if (definition.permissionChecks) {
        for (const pc of definition.permissionChecks) {
          const validatedPath = validatedPaths[pc.pathArgIndex];
          // Skip check if path is not valid or doesn't exist (it would have failed in path validation if required)
          if (!validatedPath || !validatedPath.node) {
            continue;
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

      // 4. Core Logic Execution
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
    // Attach definition to handler for inspection (e.g., by `man` command)
    handler.definition = definition;
    return handler;
  }

  /**
   * Returns a dictionary of all active background jobs.
   * @returns {Object.<number, {id: number, command: string, abortController: AbortController}>} A dictionary of active jobs.
   */
  function getActiveJobs() {
    return activeJobs;
  }

  /**
   * Terminates a running background job by its process ID.
   * @param {number} jobId - The ID of the job to terminate.
   * @returns {{success: boolean, message?: string, error?: string}} A result object.
   */
  function killJob(jobId) {
    const job = activeJobs[jobId];
    if (job && job.abortController) {
      job.abortController.abort("Killed by user command.");
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

  /**
   * Executes a single command segment, which is a part of a pipeline.
   * @private
   * @param {ParsedCommandSegment} segment - The parsed command segment from the parser.
   * @param {object} execCtxOpts - Execution context options, including `isInteractive` and `scriptingContext`.
   * @param {string|null} [stdinContent=null] - The standard input content from a previous command in a pipeline.
   * @param {AbortSignal|null} signal - The AbortSignal for cancellation, used for background jobs.
   * @returns {Promise<{success: boolean, output?: string, error?: string}>} The result of the command execution.
   */
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
    // Handle cases like empty input or just redirection
    return {
      success: true,
      output: "",
    };
  }

  /**
   * Executes a full pipeline of commands, handling I/O between segments and output redirection.
   * @private
   * @param {ParsedPipeline} pipeline - The parsed pipeline object.
   * @param {boolean} isInteractive - Whether the command is being run from an interactive terminal session.
   * @param {AbortSignal|null} signal - The AbortSignal for cancellation, used for background jobs.
   * @param {object|null} scriptingContext - The context object if the command is being run from a script.
   * @returns {Promise<{success: boolean, output?: string, error?: string}>} The final result of the pipeline.
   */
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
    // Execute each command in the pipeline
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

      // If a command is waiting for scripted input, pause this pipeline execution
      if (scriptingContext?.waitingForInput) {
        return { success: true, output: "" };
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
    // Handle file redirection ('>' or '>>')
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
      lastResult.output = ""; // Output was redirected, so clear it
    }
    // Print final output to terminal if not redirected
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

  /**
   * Finalizes the terminal UI state after a command has been executed in interactive mode.
   * This includes clearing the input, updating the prompt, and managing focus.
   * @private
   * @param {string} originalCommandText - The command text that was just executed.
   */
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

  /**
   * Processes a complete command-line string. This is the main entry point for command execution.
   * It handles alias expansion, environment variable expansion, parsing, and execution of all pipelines.
   * @param {string} rawCommandText - The raw string entered by the user.
   * @param {boolean} [isInteractive=true] - Whether the command is being run interactively.
   * @param {object|null} [scriptingContext=null] - The context if the command is part of a script.
   * @returns {Promise<{success: boolean, output?: string, error?: string}>} The final result of the entire command line.
   */
  async function processSingleCommand(rawCommandText, isInteractive = true, scriptingContext = null) {
    let overallResult = {
      success: true,
      output: "",
      error: undefined,
    };

    // Prevent interactive commands while a script is running
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

    // Handle input for modal dialogs (e.g., confirmations)
    if (ModalManager.isAwaiting()) {
      await ModalManager.handleTerminalInput(rawCommandText);
      if (isInteractive) await _finalizeInteractiveModeUI(rawCommandText);
      return overallResult;
    }

    if (EditorManager.isActive()) return overallResult;

    // Expand environment variables
    let expandedCommand = rawCommandText.trim();
    if (expandedCommand) {
      expandedCommand = expandedCommand.replace(/\$([a-zA-Z_][a-zA-Z0-9_]*)|\$\{([a-zA-Z_][a-zA-Z0-9_]*)}/g, (match, var1, var2) => {
        const varName = var1 || var2;
        return EnvironmentManager.get(varName);
      });
    }

    // Expand aliases
    const aliasResult = AliasManager.resolveAlias(expandedCommand);
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

    const commandToParse = aliasResult.newCommand;
    const cmdToEcho = rawCommandText.trim();

    // Echo the command to the output if interactive
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

    // Parse the command string into pipelines
    let parsedPipelines;
    try {
      parsedPipelines = new Parser(
          new Lexer(commandToParse).tokenize()
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

    // Execute each pipeline
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
            `${Config.MESSAGES.BACKGROUND_PROCESS_STARTED_PREFIX}${jobId}${Config.MESSAGES.BACKGROUND_PROCESS_STARTED_SUFFIX}`,
            {
              typeClass: Config.CSS_CLASSES.CONSOLE_LOG_MSG,
            }
        );
        overallResult = {
          success: true,
          output: "",
        };
        // Execute background job asynchronously
        setTimeout(async () => {
          try {
            const bgResult = await _executePipeline(pipeline, false, abortController.signal, scriptingContext);
            const statusMsg = `[Job ${pipeline.jobId} ${
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
                  `Background job ${pipeline.jobId} error details: ${
                      bgResult.error || "No specific error message."
                  }`
              );
          } finally {
            delete activeJobs[pipeline.jobId];
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
        if (!overallResult.success) break; // Stop on first failed pipeline
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

  /**
   * Returns the dictionary of all registered commands and their handlers.
   * @returns {Object.<string, {handler: Function, description: string, helpText: string}>} The commands object.
   */
  function getCommands() {
    return commands;
  }

  /**
   * Checks if a script is currently being executed.
   * @returns {boolean} True if a script is running, false otherwise.
   */
  function isScriptRunning() {
    return scriptExecutionInProgress;
  }

  /**
   * Sets the script execution status flag.
   * @param {boolean} status - The new status to set.
   */
  function setScriptExecutionInProgress(status) {
    scriptExecutionInProgress = status;
  }

  // Public interface of the CommandExecutor module
  return {
    initialize: _initializeCommands,
    processSingleCommand,
    getCommands,
    isScriptRunning,
    setScriptExecutionInProgress,
    getActiveJobs,
    killJob,
  };
})();