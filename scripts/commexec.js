/**
 * @file Manages the execution of all commands, pipelines, I/O redirection, and background processes.
 * @module CommandExecutor
 */

const CommandExecutor = (() => {
  "use strict";
  let scriptExecutionInProgress = false;
  let backgroundProcessIdCounter = 0;
  let activeJobs = {};
  const commands = {};
  const loadingPromises = {};



  function createCommandHandler(definition) {
    const handler = async (args, options) => {
      const { flags, remainingArgs } = Utils.parseFlags(
          args,
          definition.flagDefinitions || []
      );
      const currentUser = UserManager.getCurrentUser().name;

      if (definition.argValidation) {
        const validation = Utils.validateArguments(remainingArgs, definition.argValidation);
        if (!validation.isValid) {
          return { success: false, error: `${definition.commandName}: ${validation.errorDetail}` };
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
    handler.definition = definition;
    return handler;
  }

  async function _ensureCommandLoaded(commandName) {
    if (!commandName) return false;
    if (commands[commandName]) return true; // Already loaded.
    if (loadingPromises[commandName]) return await loadingPromises[commandName]; // Already in progress.

    const promise = new Promise((resolve) => {
      const script = document.createElement('script');
      script.src = `./scripts/commands/${commandName}.js`;
      script.onload = () => {
        const definition = CommandRegistry.getDefinitions()[commandName];
        if (definition) {
          commands[commandName] = {
            handler: createCommandHandler(definition.definition),
            description: definition.description,
            helpText: definition.helpText,
          };
          resolve(true);
        } else {
          console.error(`Script for '${commandName}' loaded, but command not found in registry.`);
          resolve(false);
        }
        delete loadingPromises[commandName];
      };
      script.onerror = () => {
        resolve(false);
        delete loadingPromises[commandName];
      };
      document.head.appendChild(script);
    });

    loadingPromises[commandName] = promise;
    return await loadingPromises[commandName];
  }

  async function _expandGlobPatterns(commandString) {
    const GLOB_WHITELIST = ['ls', 'rm', 'cat', 'cp', 'mv', 'chmod', 'chown', 'chgrp'];
    const args = commandString.match(/(?:[^\s"']+|"[^"]*"|'[^']*')+/g) || [];

    if (args.length === 0 || !GLOB_WHITELIST.includes(args[0])) {
      return commandString;
    }

    const expandedArgs = [args[0]];
    let hasExpansionOccurred = false;

    for (let i = 1; i < args.length; i++) {
      const originalArg = args[i];
      const isQuoted = (originalArg.startsWith('"') && originalArg.endsWith('"')) || (originalArg.startsWith("'") && originalArg.endsWith("'"));

      const globPattern = isQuoted ? originalArg.slice(1, -1) : originalArg;
      const hasGlobChar = globPattern.includes('*') || globPattern.includes('?');

      if (hasGlobChar) {
        const lastSlashIndex = globPattern.lastIndexOf('/');
        let pathPrefix = '.';
        let patternPart = globPattern;

        if (lastSlashIndex > -1) {
          pathPrefix = globPattern.substring(0, lastSlashIndex + 1);
          patternPart = globPattern.substring(lastSlashIndex + 1);
        }

        const searchDir = (pathPrefix === '/') ? '/' : FileSystemManager.getAbsolutePath(pathPrefix, FileSystemManager.getCurrentPath());
        const dirNode = FileSystemManager.getNodeByPath(searchDir);

        if (dirNode && dirNode.type === 'directory') {
          const regex = Utils.globToRegex(patternPart);
          if (regex) {
            const matches = Object.keys(dirNode.children)
                .filter(name => regex.test(name))
                .map(name => {
                  const fullPath = FileSystemManager.getAbsolutePath(name, searchDir);
                  return fullPath.includes(' ') ? `"${fullPath}"` : fullPath;
                });

            if (matches.length > 0) {
              expandedArgs.push(...matches);
              hasExpansionOccurred = true;
            } else {
              expandedArgs.push(originalArg);
            }
          } else {
            expandedArgs.push(originalArg);
          }
        } else {
          expandedArgs.push(originalArg);
        }
      } else {
        expandedArgs.push(originalArg);
      }
    }

    return hasExpansionOccurred ? expandedArgs.join(' ') : commandString;
  }

  function getActiveJobs() {
    return activeJobs;
  }

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

  async function _executeCommandHandler(segment, execCtxOpts, stdinContent = null, signal) {
    const commandName = segment.command?.toLowerCase();

    // Dynamically load command if necessary.
    const commandExists = await _ensureCommandLoaded(commandName);
    if (!commandExists) {
      return { success: false, error: `${commandName}: command not found` };
    }

    const cmdData = commands[commandName];

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
      return { success: false, error: `${segment.command}: command not found` };
    }

    return {
      success: true,
      output: "",
    };
  }

  async function _executePipeline(pipeline, options) {
    const { isInteractive, signal, scriptingContext, suppressOutput } = options;
    let currentStdin = null;
    let lastResult = {
      success: true,
      output: "",
    };
    if (pipeline.inputRedirectFile) {
      const pathValidation = FileSystemManager.validatePath("input redirection", pipeline.inputRedirectFile, { expectedType: 'file' });
      if (pathValidation.error) {
        return { success: false, error: pathValidation.error };
      }
      if (!FileSystemManager.hasPermission(pathValidation.node, UserManager.getCurrentUser().name, "read")) {
        return { success: false, error: `cannot open '${pipeline.inputRedirectFile}' for reading: Permission denied` };
      }
      currentStdin = pathValidation.node.content || "";
    }
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
      lastResult.output = "";
    }

    if (
        !pipeline.redirection &&
        lastResult.success &&
        lastResult.output !== null &&
        lastResult.output !== undefined
    ) {
      if (pipeline.isBackground) {
        if (lastResult.output) {
          await OutputManager.appendToOutput(
              `${Config.MESSAGES.BACKGROUND_PROCESS_OUTPUT_SUPPRESSED} (Job ${pipeline.jobId})`,
              {
                typeClass: Config.CSS_CLASSES.CONSOLE_LOG_MSG,
                isBackground: true,
              }
          );
        }
      } else {
        if (lastResult.output && !suppressOutput) {
          await OutputManager.appendToOutput(lastResult.output, {
            typeClass: lastResult.messageType || null,
          });
        }
      }
    }
    return lastResult;
  }

  async function _preprocessCommandString(rawCommandText) {
    let expandedCommand = rawCommandText.trim();
    if (!expandedCommand) {
      return "";
    }

    expandedCommand = expandedCommand.replace(/\$([a-zA-Z_][a-zA-Z0-9_]*)|\$\{([a-zA-Z_][a-zA-Z0-9_]*)\}/g, (match, var1, var2) => {
      const varName = var1 || var2;
      return EnvironmentManager.get(varName);
    });

    const aliasResult = AliasManager.resolveAlias(expandedCommand);
    if (aliasResult.error) {
      throw new Error(aliasResult.error);
    }
    const commandAfterAliases = aliasResult.newCommand;

    const commandToParse = await _expandGlobPatterns(commandAfterAliases);
    return commandToParse;
  }

  async function _finalizeInteractiveModeUI(originalCommandText) {
    TerminalUI.clearInput();
    TerminalUI.updatePrompt();
    if (!EditorManager.isActive()) {
      if (DOM.inputLineContainerDiv) {
        DOM.inputLineContainerDiv.classList.remove(Config.CSS_CLASSES.HIDDEN);
      }
      TerminalUI.setInputState(true);
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

  async function processSingleCommand(rawCommandText, options = {}) {
    const { isInteractive = true, scriptingContext = null, suppressOutput = false } = options;

    if (scriptExecutionInProgress && isInteractive && !ModalManager.isAwaiting()) {
      await OutputManager.appendToOutput("Script execution in progress. Input suspended.", { typeClass: Config.CSS_CLASSES.WARNING_MSG });
      return { success: false, error: "Script execution in progress." };
    }
    if (ModalManager.isAwaiting()) {
      await ModalManager.handleTerminalInput(rawCommandText);
      if (isInteractive) await _finalizeInteractiveModeUI(rawCommandText);
      return { success: true, output: "" };
    }
    if (EditorManager.isActive()) return { success: true, output: "" };

    let commandToParse;
    try {
      commandToParse = await _preprocessCommandString(rawCommandText);
    } catch (e) {
      await OutputManager.appendToOutput(e.message, { typeClass: Config.CSS_CLASSES.ERROR_MSG });
      if (isInteractive) await _finalizeInteractiveModeUI(rawCommandText);
      return { success: false, error: e.message };
    }

    const cmdToEcho = rawCommandText.trim();
    if (isInteractive) {
      DOM.inputLineContainerDiv.classList.add(Config.CSS_CLASSES.HIDDEN);
      const prompt = DOM.promptContainer.textContent;
      await OutputManager.appendToOutput(`${prompt}${cmdToEcho}`);
    }
    if (cmdToEcho === "") {
      if (isInteractive) await _finalizeInteractiveModeUI(rawCommandText);
      return { success: true, output: "" };
    }
    if (isInteractive) HistoryManager.add(cmdToEcho);
    if (isInteractive && !TerminalUI.getIsNavigatingHistory()) HistoryManager.resetIndex();

    let commandSequence;
    try {
      commandSequence = new Parser(new Lexer(commandToParse).tokenize()).parse();
    } catch (e) {
      await OutputManager.appendToOutput(e.message || "Command parse error.", { typeClass: Config.CSS_CLASSES.ERROR_MSG });
      if (isInteractive) await _finalizeInteractiveModeUI(rawCommandText);
      return { success: false, error: e.message || "Command parse error." };
    }

    let lastPipelineSuccess = true;
    let overallResult = { success: true, output: "" };

    for (let i = 0; i < commandSequence.length; i++) {
      const { pipeline, operator } = commandSequence[i];

      if (i > 0) {
        const prevOperator = commandSequence[i-1].operator;
        if (prevOperator === '&&' && !lastPipelineSuccess) continue;
        if (prevOperator === '||' && lastPipelineSuccess) continue;
      }

      let result;
      if (operator === '&') {
        pipeline.isBackground = true;
        const jobId = ++backgroundProcessIdCounter;
        pipeline.jobId = jobId;
        const abortController = new AbortController();
        activeJobs[jobId] = { id: jobId, command: cmdToEcho, abortController };
        await OutputManager.appendToOutput(`${Config.MESSAGES.BACKGROUND_PROCESS_STARTED_PREFIX}${jobId}${Config.MESSAGES.BACKGROUND_PROCESS_STARTED_SUFFIX}`, { typeClass: Config.CSS_CLASSES.CONSOLE_LOG_MSG });

        setTimeout(async () => {
          try {
            const bgResult = await _executePipeline(pipeline, { isInteractive: false, signal: abortController.signal, scriptingContext, suppressOutput: true });
            const statusMsg = `[Job ${pipeline.jobId} ${bgResult.success ? "finished" : "finished with error"}${bgResult.success ? "" : `: ${bgResult.error || "Unknown error"}`}]`;
            await OutputManager.appendToOutput(statusMsg, { typeClass: bgResult.success ? Config.CSS_CLASSES.CONSOLE_LOG_MSG : Config.CSS_CLASSES.WARNING_MSG, isBackground: true });
          } finally {
            delete activeJobs[jobId];
          }
        }, 0);
        result = { success: true };
      } else {
        result = await _executePipeline(pipeline, { isInteractive, signal: null, scriptingContext, suppressOutput });
      }

      if (!result) {
        const err = `Critical: Pipeline execution returned an undefined result.`;
        console.error(err, "Pipeline:", pipeline);
        result = { success: false, error: err };
      }
      lastPipelineSuccess = result.success;
      overallResult = result;
    }

    if (isInteractive && !scriptExecutionInProgress) {
      await _finalizeInteractiveModeUI(rawCommandText);
    }

    return overallResult;
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
    initialize: () => {},
    processSingleCommand,
    getCommands,
    isScriptRunning,
    setScriptExecutionInProgress,
    getActiveJobs,
    killJob,
    _ensureCommandLoaded,
  };
})();