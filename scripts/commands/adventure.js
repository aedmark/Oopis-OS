/**
 * @file Defines the 'adventure' command, which launches the OopisOS text adventure game engine.
 * @author Andrew Edmark & Gemini
 */

(() => {
    "use strict";

    // The default, built-in adventure game data, now with more properties.
    const defaultAdventureData = {
        "title": "The Lost Key of Oopis",
        "startingRoomId": "west_of_house",
        "winCondition": {
            "type": "itemInRoom",
            "itemId": "key",
            "roomId": "front_door"
        },
        "winMessage": "\n*** With a satisfying click, you unlock the door. You have won! ***",
        "rooms": {
            "west_of_house": {
                "name": "West of House",
                "description": "You are standing in an open field west of a white house, with a boarded front door. There is a small mailbox here.",
                "exits": { "north": "north_of_house", "south": "south_of_house", "east": "front_door" }
            },
            "north_of_house": {
                "name": "North of House",
                "description": "You are in a forest, with trees surrounding you. A rusty key is lying on the ground next to an old brass lantern.",
                "exits": { "south": "west_of_house" }
            },
            "south_of_house": {
                "name": "South of House",
                "description": "You are in a garden. There are beautiful flowers here.",
                "exits": { "north": "west_of_house" }
            },
            "front_door": {
                "name": "Front Door",
                "description": "You are at the front door. It is boarded up but has a large, rusty lock.",
                "exits": { "west": "west_of_house" }
            }
        },
        "items": {
            "mailbox": {
                "id": "mailbox", "name": "small mailbox", "noun": "mailbox", "adjectives": ["small"],
                "description": "It's a small, standard-issue mailbox.", "location": "west_of_house", "canTake": false,
                "isOpenable": true, "isContainer": true, "isOpen": false, "capacity": 3, "contains": ["leaflet"]
            },
            "leaflet": {
                "id": "leaflet", "name": "leaflet", "noun": "leaflet", "adjectives": ["small", "folded"],
                "description": "A small, folded leaflet. It reads: 'OopisOS v3.2 - Now with more adventure!'", "location": "mailbox", "canTake": true
            },
            "key": {
                "id": "key", "name": "rusty key", "noun": "key", "adjectives": ["rusty", "old"],
                "description": "It's an old, rusty key. It looks like it might fit the lock on the front door.", "location": "north_of_house", "canTake": true,
                "unlocks": "door"
            },
            "door": {
                "id": "door", "name": "boarded front door", "noun": "door", "adjectives": ["boarded", "front", "white"],
                "description": "The door is made of sturdy oak, but has been boarded up. It is locked.", "location": "front_door", "canTake": false,
                "isOpenable": true, "isLocked": true, "isOpen": false
            },
            "lantern": {
                "id": "lantern", "name": "brass lantern", "noun": "lantern", "adjectives": ["brass", "old"],
                "description": "An old brass lantern. It's currently unlit.", "location": "north_of_house", "canTake": true,
                "isLightSource": true, "isLit": false
            }
        }
    };


    /**
     * @const {object} adventureCommandDefinition
     * @description The command definition for the 'adventure' command.
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
                adventureToLoad = defaultAdventureData;
            }

            const scriptingContext = options.scriptingContext || null;

            await TextAdventureEngine.startAdventure(adventureToLoad, { scriptingContext: scriptingContext });

            if (scriptingContext && scriptingContext.isScripting) {
                while (scriptingContext.currentLineIndex < scriptContext.lines.length - 1 && TextAdventureModal.isActive()) {
                    let nextCommand = await TextAdventureModal.requestInput("");
                    if(nextCommand === null) break;
                    await TextAdventureEngine.processCommand(nextCommand);
                }
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

    const adventureDescription = "Starts an interactive text adventure game.";
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
       save / load        - Saves or loads game progress to a file in the VFS.
       help               - Shows this list of gameplay commands.
       quit / exit        - Exits the game and returns to the terminal.

CUSTOM ADVENTURES
       You can create your own adventures using a specific JSON format. The JSON file must contain objects for 'rooms' and 'items', and specify a 'startingRoomId' and a 'winCondition'. Upload your .json file and run \`adventure /path/to/your_game.json\` to play.`;

    CommandRegistry.register("adventure", adventureCommandDefinition, adventureDescription, adventureHelpText);
})();