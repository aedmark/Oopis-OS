/**
 * @file Defines the 'adventure' command, which launches the OopisOS text adventure game engine.
 * @author Andrew Edmark
 * @author Gemini
 */

(() => {
    "use strict";

    /**
     * @const {object} adventureCommandDefinition
     * @description The command definition for the 'adventure' command.
     * This object specifies how the command should be parsed and executed.
     */
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
        /**
         * The core logic for the 'adventure' command.
         * It handles loading adventure data from a file or using a default,
         * then launches the adventure modal and engine. It also manages scripted
         * interaction for automated testing.
         * @async
         * @param {object} context - The context object provided by the command executor.
         * @returns {Promise<object>} A promise that resolves to a command result object.
         */
        coreLogic: async (context) => {
            const { args, currentUser, validatedPaths, options } = context;

            if (typeof TextAdventureModal === "undefined" || typeof TextAdventureEngine === "undefined") {
                return { success: false, error: "Adventure module is not properly loaded." };
            }
            if (TextAdventureModal.isActive()) {
                return { success: false, error: "An adventure is already in progress." };
            }

            let adventureToLoad;

            if (args.length > 0) {
                const filePath = args[0];
                const pathInfo = validatedPaths[0];

                if (pathInfo.error) return { success: false, error: pathInfo.error };
                if (!pathInfo.node) return { success: false, error: `adventure: File not found at '${filePath}'.` };
                if (!FileSystemManager.hasPermission(pathInfo.node, currentUser, "read")) {
                    return { success: false, error: `adventure: Cannot read file '${filePath}'${Config.MESSAGES.PERMISSION_DENIED_SUFFIX}` };
                }
                try {
                    adventureToLoad = JSON.parse(pathInfo.node.content);
                    if (!adventureToLoad.rooms || !adventureToLoad.startingRoomId) {
                        return { success: false, error: `adventure: Invalid adventure file format in '${filePath}'.` };
                    }
                    if (!adventureToLoad.title) adventureToLoad.title = filePath;
                } catch (e) {
                    return { success: false, error: `adventure: Error parsing adventure file '${filePath}': ${e.message}` };
                }
            } else {
                if (typeof window.sampleAdventure === "undefined") {
                    return { success: false, error: "adventure: Default game data (window.sampleAdventure) not found." };
                }
                adventureToLoad = window.sampleAdventure;
            }

            const scriptingContext = options.scriptingContext || null;

            // Start the adventure engine, which will show the modal.
            // The `show` function now returns a promise that resolves when the game is hidden.
            // This `await` is the key to making the `run` command wait.
            await TextAdventureEngine.startAdventure(adventureToLoad, { scriptingContext: scriptingContext });

            // The game's main loop is now handled internally by the engine/modal via either
            // the keydown listener (for interactive users) or the requestInput function (for scripted users).
            // We just need to keep feeding it commands if we are in a script.
            if (scriptingContext && scriptingContext.isScripting) {
                while (scriptingContext.currentLineIndex < scriptingContext.lines.length - 1 && TextAdventureModal.isActive()) {
                    let nextCommand = await TextAdventureModal.requestInput(""); // requestInput is now the script-aware input source
                    if(nextCommand === null) break; // End of script
                    await TextAdventureEngine.processCommand(nextCommand);
                }
                // Ensure the modal is hidden if the script finishes without a 'quit' command
                if (TextAdventureModal.isActive()) {
                    TextAdventureModal.hide();
                }
            }

            return {
                success: true,
                output: ``,
            };
        },
    };

    /**
     * @const {string} adventureDescription
     * @description A brief, one-line description of the 'adventure' command for the 'help' command.
     */
    const adventureDescription = "Starts an interactive text adventure game.";

    /**
     * @const {string} adventureHelpText
     * @description The detailed help text for the 'adventure' command, used by 'man'.
     */
    const adventureHelpText = `Usage: adventure [path_to_game.json]

Launches the OopisOS interactive text adventure game engine. The game runs in a dedicated full-screen view.

If no path to a custom game file is provided, the default built-in adventure, "The Lost Key of Oopis," will be started.

GAMEPLAY COMMANDS
       The following commands are available while inside the adventure:
       
       look [target]      - Describes the room or a specific item.
       go [direction]     - Moves the player (e.g., go north).
       take [item]        - Picks up an item from the room.
       drop [item]        - Drops an item from inventory.
       use [item] on [target]
                          - Uses an inventory item on something in the room.
       inventory (or i)   - Shows what you are carrying.
       open/close [target]
                          - Opens or closes an item like a door or chest.
       save / load        - Saves or loads game progress to a file in the VFS.
       help               - Shows this list of gameplay commands.
       quit / exit        - Exits the game and returns to the terminal.

CUSTOM ADVENTURES
       You can create your own adventures using a specific JSON format. The JSON file must contain objects for 'rooms' and 'items', and specify a 'startingRoomId' and a 'winCondition'. Upload your .json file and run \`adventure /path/to/your_game.json\` to play.`;

    // Register the command with the system
    CommandRegistry.register("adventure", adventureCommandDefinition, adventureDescription, adventureHelpText);
})();
