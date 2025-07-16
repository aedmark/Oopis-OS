// scripts/commands/printscreen.js
(() => {
    "use strict";

    const printscreenCommandDefinition = {
        commandName: "printscreen",
        completionType: "paths", // Preserved for tab completion
        argValidation: {
            exact: 1,
            error: "Usage: printscreen <filepath>",
        },
        coreLogic: async (context) => {
            const { args, currentUser } = context;
            const filePathArg = args[0];
            const nowISO = new Date().toISOString();

            try {
                const pathValidation = FileSystemManager.validatePath(filePathArg, {
                    allowMissing: true,
                    expectedType: 'file',
                    disallowRoot: true
                });

                if (pathValidation.error && !pathValidation.optionsUsed.allowMissing) {
                    return { success: false, error: `printscreen: ${pathValidation.error}` };
                }

                if (pathValidation.node && pathValidation.node.type === 'directory') {
                    return { success: false, error: `printscreen: cannot overwrite directory '${filePathArg}' with a file.` };
                }

                if (pathValidation.node && !FileSystemManager.hasPermission(pathValidation.node, currentUser, "write")) {
                    return { success: false, error: `printscreen: '${filePathArg}': Permission denied` };
                }

                const outputContent = DOM.outputDiv ? DOM.outputDiv.innerText : "";

                const saveResult = await FileSystemManager.createOrUpdateFile(
                    pathValidation.resolvedPath,
                    outputContent,
                    { currentUser, primaryGroup: UserManager.getPrimaryGroupForUser(currentUser) }
                );

                if (!saveResult.success) {
                    return { success: false, error: `printscreen: ${saveResult.error}`};
                }

                if (!(await FileSystemManager.save(currentUser))) {
                    return {
                        success: false,
                        error: "printscreen: Failed to save file system changes.",
                    };
                }

                return {
                    success: true,
                    output: `Terminal output saved to '${pathValidation.resolvedPath}'`,
                };
            } catch (e) {
                return { success: false, error: `printscreen: An unexpected error occurred: ${e.message}` };
            }
        },
    };

    const printscreenDescription = "Saves the visible terminal output to a file.";
    const printscreenHelpText = `Usage: printscreen <filepath>

Save the visible terminal output to a file.

DESCRIPTION
       The printscreen command captures all text currently visible in the
       terminal's output area and saves it as plain text to the specified
       <filepath>.

       This is useful for creating logs or saving the results of a series
       of commands for later review. If the file already exists, it will be
       overwritten.

EXAMPLES
       ls -la /
       printscreen /home/Guest/root_listing.txt
              Saves the output of the 'ls -la /' command into a new file.`;

    CommandRegistry.register("printscreen", printscreenCommandDefinition, printscreenDescription, printscreenHelpText);
})();