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
   * A cache for loaded command definitions. This is populated on-demand.
   * @private
   * @type {Object.<string, {handler: Function, description: string, helpText: string}>}
   */
  const commands = {};

  /**
   * An object to track command scripts currently being loaded to prevent race conditions.
   * @private
   * @type {Object.<string, Promise<boolean>>}
   */
  const loadingPromises = {};


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
   * Ensures a command's script is loaded. If not already cached, it dynamically
   * injects the script tag and waits for it to load.
   * @private
   * @param {string} commandName The name of the command to load.
   * @returns {Promise<boolean>} Resolves true if the command is loaded, false otherwise.
   */
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
        // A script failing to load is equivalent to a "command not found" error.
        // We resolve false to allow the executor to handle it gracefully.
        resolve(false);
        delete loadingPromises[commandName];
      };
      document.head.appendChild(script);
    });

    loadingPromises[commandName] = promise;
    return await loadingPromises[commandName];
  }


  /**
   * REFACTORED: Expands wildcard glob patterns (*, ?) in command arguments before parsing.
   * This is a pre-processing step to handle file path expansion with more robust path handling.
   * @private
   * @param {string} commandString The raw command string after alias/variable expansion.
   * @returns {Promise<string>} The command string with glob patterns expanded to matching file paths.
   */
  async function _expandGlobPatterns(commandString) {
    const GLOB_WHITELIST = ['ls', 'rm', 'cat', 'cp', 'mv', 'chmod', 'chown', 'chgrp'];
    // This regex correctly handles quoted arguments.
    const args = commandString.match(/(?:[^\s"']+|"[^"]*"|'[^']*')+/g) || [];

    if (args.length === 0 || !GLOB_WHITELIST.includes(args[0])) {
      return commandString;
    }

    const expandedArgs = [args[0]]; // Start with the command name itself.
    let hasExpansionOccurred = false;

    for (let i = 1; i < args.length; i++) {
      const arg = args[i];
      const isQuoted = (arg.startsWith('"') && arg.endsWith('"')) || (arg.startsWith("'") && arg.endsWith("'"));
      const hasGlobChar = arg.includes('*') || arg.includes('?');

      if (!isQuoted && hasGlobChar) {
        const globPattern = arg;
        const lastSlashIndex = globPattern.lastIndexOf('/');

        let pathPrefix = '.';
        let patternPart = globPattern;

        if (lastSlashIndex > -1) {
          pathPrefix = globPattern.substring(0, lastSlashIndex + 1);
          patternPart = globPattern.substring(lastSlashIndex + 1);
        }
        // If the prefix is just "/", handle it as root. Otherwise, resolve it.
        const searchDir = (pathPrefix === '/') ? '/' : FileSystemManager.getAbsolutePath(pathPrefix, FileSystemManager.getCurrentPath());
        const dirNode = FileSystemManager.getNodeByPath(searchDir);

        if (dirNode && dirNode.type === 'directory') {
          const regex = Utils.globToRegex(patternPart);
          if (regex) {
            const matches = Object.keys(dirNode.children)
                .filter(name => regex.test(name))
                .map(name => {
                  const fullPath = FileSystemManager.getAbsolutePath(name, searchDir);
                  // Quote paths with spaces to ensure they are treated as a single argument.
                  return fullPath.includes(' ') ? `"${fullPath}"` : fullPath;
                });

            if (matches.length > 0) {
              expandedArgs.push(...matches);
              hasExpansionOccurred = true;
            } else {
              // No matches found, preserve the original glob pattern.
              expandedArgs.push(globPattern);
            }
          } else {
            // Invalid glob pattern, preserve it.
            expandedArgs.push(globPattern);
          }
        } else {
          // Path doesn't exist or isn't a directory, preserve the original glob pattern.
          expandedArgs.push(globPattern);
        }
      } else {
        // Not a glob pattern (or is quoted), just add the argument as is.
        expandedArgs.push(arg);
      }
    }

    // Only reconstruct the string if an expansion actually happened.
    return hasExpansionOccurred ? expandedArgs.join(' ') : commandString;
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
      // This case is now a fallback, as _ensureCommandLoaded should handle it.
      return { success: false, error: `${segment.command}: command not found` };
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
   * @param {object} options - Execution options.
   * @returns {Promise<{success: boolean, output?: string, error?: string}>} The final result of the pipeline.
   */
  async function _executePipeline(pipeline, options) {
    const { isInteractive, signal, scriptingContext, suppressOutput } = options;
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
      if (pipeline.isBackground) {
        // Suppress output for background jobs, but notify the user.
        if (lastResult.output) { // Only notify if there was actually output to suppress.
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

  /**
   * NEW: A helper function to handle the pre-processing of a command string before parsing.
   * This includes variable expansion, alias resolution, and glob expansion.
   * @private
   * @param {string} rawCommandText - The raw string entered by the user.
   * @returns {Promise<string>} The fully processed command string ready for the parser.
   * @throws {Error} if alias resolution fails.
   */
  async function _preprocessCommandString(rawCommandText) {
    let expandedCommand = rawCommandText.trim();
    if (!expandedCommand) {
      return "";
    }

    // 1. Expand Environment Variables
    expandedCommand = expandedCommand.replace(/\$([a-zA-Z_][a-zA-Z0-9_]*)|\$\{([a-zA-Z_][a-zA-Z0-9_]*)\}/g, (match, var1, var2) => {
      const varName = var1 || var2;
      return EnvironmentManager.get(varName);
    });

    // 2. Resolve Aliases
    const aliasResult = AliasManager.resolveAlias(expandedCommand);
    if (aliasResult.error) {
      throw new Error(aliasResult.error);
    }
    const commandAfterAliases = aliasResult.newCommand;

    // 3. Expand Glob Patterns
    const commandToParse = await _expandGlobPatterns(commandAfterAliases);
    return commandToParse;
  }

  /**
   * REFACTORED: Finalizes the terminal UI state after a command has been executed in interactive mode.
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

  /**
   * REFACTORED: Processes a complete command-line string. This is the main entry point for command execution.
   * It now uses helper functions for pre-processing and post-processing, making the main flow cleaner.
   * @param {string} rawCommandText - The raw string entered by the user.
   * @param {object} [options={}] - An object containing execution options.
   * @returns {Promise<{success: boolean, output?: string, error?: string}>} The final result of the entire command line.
   */
  async function processSingleCommand(rawCommandText, options = {}) {
    const { isInteractive = true, scriptingContext = null, suppressOutput = false } = options;

    // --- 1. Initial State Checks ---
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

    // --- 2. Pre-process the Command String ---
    let commandToParse;
    try {
      commandToParse = await _preprocessCommandString(rawCommandText);
    } catch (e) {
      await OutputManager.appendToOutput(e.message, { typeClass: Config.CSS_CLASSES.ERROR_MSG });
      if (isInteractive) await _finalizeInteractiveModeUI(rawCommandText);
      return { success: false, error: e.message };
    }

    // --- 3. UI Updates & History ---
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


    // --- 4. Parse the Command ---
    let commandSequence;
    try {
      commandSequence = new Parser(new Lexer(commandToParse).tokenize()).parse();
    } catch (e) {
      await OutputManager.appendToOutput(e.message || "Command parse error.", { typeClass: Config.CSS_CLASSES.ERROR_MSG });
      if (isInteractive) await _finalizeInteractiveModeUI(rawCommandText);
      return { success: false, error: e.message || "Command parse error." };
    }

    // --- 5. Orchestration Loop ---
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

    // --- 6. Finalize the UI ---
    if (isInteractive && !scriptExecutionInProgress) {
      await _finalizeInteractiveModeUI(rawCommandText);
    }

    return overallResult;
  }

  /**
   * Returns a dictionary of all registered commands and their handlers.
   * This is now more dynamic, as the `commands` object is a cache.
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
    initialize: () => {}, // No longer pre-loads all commands.
    processSingleCommand,
    getCommands,
    isScriptRunning,
    setScriptExecutionInProgress,
    getActiveJobs,
    killJob,
    _ensureCommandLoaded, // Exposed for TabCompletionManager
  };
})();