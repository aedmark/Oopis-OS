// scripts/commands/run.js
(() => {
    "use strict";

    const runCommandDefinition = {
        commandName: "run",
        completionType: "paths", // Preserved for tab completion
        argValidation: {
            min: 1,
        },
        coreLogic: async (context) => {
            const { args, options, signal } = context;
            const scriptPathArg = args[0];

            // 1. Create a new, isolated environment for the script
            EnvironmentManager.push();

            try {
                // --- RECURSION DEPTH CHECK ---
                const currentDepth = (options.scriptingContext?.depth || 0) + 1;
                if (currentDepth > Config.FILESYSTEM.MAX_SCRIPT_DEPTH) {
                    return {
                        success: false,
                        error: `Maximum script recursion depth (${Config.FILESYSTEM.MAX_SCRIPT_DEPTH}) exceeded. Halting execution.`
                    };
                }
                // --- END CHECK ---

                const pathValidation = FileSystemManager.validatePath(scriptPathArg, {
                    expectedType: 'file',
                    permissions: ['read', 'execute']
                });

                if (pathValidation.error) {
                    return { success: false, error: `run: ${scriptPathArg}: ${pathValidation.error}` };
                }

                const scriptNode = pathValidation.node;
                const scriptContent = scriptNode.content || "";
                const scriptArgs = args.slice(1);
                const lines = scriptContent.split('\n');
                let overallSuccess = true;

                const scriptingContext = {
                    sourceFile: scriptPathArg,
                    isScripting: true,
                    lines: lines,
                    currentLineIndex: -1,
                    depth: currentDepth // Pass the new depth to child commands
                };

                for (let i = 0; i < lines.length; i++) {
                    scriptingContext.currentLineIndex = i;

                    if (signal?.aborted) {
                        await OutputManager.appendToOutput("Script execution aborted by user.", { typeClass: "text-warning" });
                        overallSuccess = false;
                        break;
                    }

                    let line = lines[i].trim();

                    if (line.startsWith('#') || line === '') {
                        continue;
                    }

                    line = line.replace(/\$@/g, scriptArgs.join(' '));
                    line = line.replace(/\$#/g, scriptArgs.length);
                    scriptArgs.forEach((j, k) => {
                        const regex = new RegExp(`\\$${k + 1}`, 'g');
                        line = line.replace(regex, j);
                    });

                    const result = await CommandExecutor.processSingleCommand(line, {
                        isInteractive: false,
                        scriptingContext: scriptingContext
                    });

                    i = scriptingContext.currentLineIndex;

                    if (!result.success) {
                        await OutputManager.appendToOutput(`Script '${scriptPathArg}' error on line ${i + 1}: ${line}\nError: ${result.error || 'Command failed.'}`, { typeClass: 'text-error' });
                        overallSuccess = false;
                        break;
                    }
                }

                return { success: overallSuccess };

            } catch (e) {
                return { success: false, error: `run: An unexpected error occurred: ${e.message}` };
            } finally {
                // 2. Clean up the script's environment, restoring the parent's
                EnvironmentManager.pop();
            }
        }
    };

    const runDescription = "Executes a shell script.";
    const runHelpText = `Usage: run <script_path> [arguments...]

Execute a shell script.

DESCRIPTION
       The run command executes a script file containing a sequence of
       OopisOS commands. The script is read and executed line by line.

       By convention, script files should have a '.sh' extension.
       To be executed, the script file must have execute (x) permissions
       for the current user (see 'chmod').

SCRIPTING
       Scripts can be made more powerful and flexible using the following
       features:

       Comments
              Lines beginning with a '#' are treated as comments and are
              ignored by the executor.

       Arguments
              You can pass arguments to your script from the command line.
              These arguments can be accessed within the script using
              special variables:
              $1, $2, ...  - The first, second, etc., argument.
              $@           - All arguments as a single string.
              $#           - The total number of arguments.

       Error Handling
              If any command within the script fails, the script will
              stop execution immediately.`;

    CommandRegistry.register(runCommandDefinition.commandName, runCommandDefinition, runDescription, runHelpText);
})();