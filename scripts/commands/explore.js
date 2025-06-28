/**
 * @file Defines the 'explore' command, which launches the graphical file explorer.
 * @author Architect
 */

(() => {
    "use strict";

    const exploreCommandDefinition = {
        commandName: "explore",
        argValidation: {
            max: 1, // Accepts an optional starting path
            error: "Usage: explore [path]",
        },
        /**
         * The core logic for the 'explore' command.
         * It validates that the command is run in an interactive session and then
         * delegates the launching of the UI to the ExplorerManager.
         * @async
         * @param {object} context - The context object provided by the command executor.
         * @returns {Promise<object>} A promise that resolves to a command result object.
         */
        coreLogic: async (context) => {
            const { args, options } = context;

            if (!options.isInteractive) {
                return {
                    success: false,
                    error: "explore: Can only be run in an interactive session.",
                };
            }

            if (typeof ExplorerManager === 'undefined') {
                return {
                    success: false,
                    error: "explore: Explorer application module is not loaded.",
                };
            }

            const startPath = args.length > 0 ? args[0] : null;

            // ExplorerManager.enter will handle path validation internally
            ExplorerManager.enter(startPath);

            return {
                success: true,
                output: "Opening File Explorer..."
            };
        },
    };

    const exploreDescription = "Opens the graphical file explorer.";

    const exploreHelpText = `Usage: explore [path]

Launches the graphical file explorer application.

DESCRIPTION
       The explore command opens a two-pane graphical user interface for
       navigating the file system. The left pane shows a directory tree,
       and the right pane shows the contents of the selected directory.

       If an optional [path] is provided, the explorer will attempt to
       start at that location.

       The explorer is a read-only view and respects all file permissions
       of the current user.`;

    // Register the command with the system.
    CommandRegistry.register("explore", exploreCommandDefinition, exploreDescription, exploreHelpText);

})();