// scripts/commands/adventure.js

(() => {
    "use strict";

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
    const adventureDescription = "Starts a text adventure.";
    const adventureHelpText = "Usage: adventure [path_to_adventure_file.json]\n\nStarts a text adventure. If no path is specified, the default game will be loaded.";

    CommandRegistry.register("adventure", adventureCommandDefinition, adventureDescription, adventureHelpText);
})();