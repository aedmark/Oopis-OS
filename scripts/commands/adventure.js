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
                    allowMissing: true, // Allow missing to handle default game
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

            // Launch the adventure UI and engine state. This is non-blocking.
            TextAdventureEngine.startAdventure(adventureToLoad, options);

            // If we are in a script, hijack the execution flow.
            if (options.scriptingContext && options.scriptingContext.isScripting) {
                const scriptContext = options.scriptingContext;

                // Loop through the rest of the script, feeding lines to the adventure engine
                while (scriptContext.currentLineIndex < scriptContext.lines.length - 1) {
                    scriptContext.currentLineIndex++; // Consume the next line
                    const command = scriptContext.lines[scriptContext.currentLineIndex].trim();

                    if (command && !command.startsWith('#')) {
                        // Have the engine process the command from the script
                        if (TextAdventureEngine && typeof TextAdventureEngine.processCommand === 'function') {
                            await TextAdventureEngine.processCommand(command);
                        }

                        // If the command was quit/exit, the modal will close. Break the loop.
                        const lowerCmd = command.toLowerCase();
                        if (lowerCmd === 'quit' || lowerCmd === 'exit') {
                            break;
                        }
                    }
                }
            }

            // This return now happens AFTER the game session (interactive or scripted) is complete.
            return {
                success: true,
                output: `Adventure session for "${adventureToLoad.title || "Untitled Adventure"}" has ended.`,
                messageType: Config.CSS_CLASSES.CONSOLE_LOG_MSG,
            };
        },
    };
    const adventureDescription = "Starts a text adventure.";
    const adventureHelpText = "Usage: adventure [path_to_adventure_file.json]\n\nStarts a text adventure. If no path is specified, the default game will be loaded.";
    CommandRegistry.register("adventure", adventureCommandDefinition, adventureDescription, adventureHelpText);
})();