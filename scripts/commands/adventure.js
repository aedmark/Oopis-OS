/**
 * @file Defines the 'adventure' command, which launches the OopisOS text adventure game engine.
 * @author Andrew Edmark & Gemini
 */

(() => {
    "use strict";

    const defaultAdventureData = {
        "title": "The Architect's Apprentice",
        "startingRoomId": "test_chamber",
        "maxScore": 50,
        "winCondition": {
            "type": "itemUsedOn",
            "itemId": "page",
            "targetId": "terminal"
        },
        "winMessage": "You touch the manual page to the terminal's screen. The text on the page dissolves into light, flowing into the terminal. The room shimmers, and the placeholder textures resolve into solid, finished surfaces. The low hum ceases, replaced by a soft, pleasant ambiance.\n\nThe Architect smiles. 'Excellent work. Test complete.'",
        "rooms": {
            "test_chamber": {
                "name": "Test Chamber",
                "points": 0,
                "description": "You are in a room that feels... unfinished. Some wall textures are flickering placeholders, and a low, persistent hum fills the air. There is a simple metal desk, a sturdy-looking chest, and a computer terminal with a dark screen. A single door is to the north. A shimmering, holographic figure watches you expectantly.",
                "exits": { "north": "server_closet" }
            },
            "server_closet": {
                "name": "Server Closet",
                "description": "You have entered a small, dark closet. It is pitch black.",
                "isDark": true,
                "onListen": "You hear the quiet whirring of server fans, somewhere in the darkness.",
                "onSmell": "The air is stale and smells of hot electronics.",
                "exits": { "south": "test_chamber" }
            }
        },
        "items": {
            "desk": {
                "id": "desk", "name": "metal desk", "noun": "desk", "adjectives": ["metal", "simple"],
                "description": "A simple metal desk. A small, brass key rests on its surface.", "location": "test_chamber", "canTake": false
            },
            "key": {
                "id": "key", "name": "brass key", "noun": "key", "adjectives": ["brass", "small"],
                "description": "A small, plain brass key. It feels slightly warm.", "location": "test_chamber", "canTake": true,
                "unlocks": "chest", "points": 10
            },
            "chest": {
                "id": "chest", "name": "wooden chest", "noun": "chest", "adjectives": ["wooden", "sturdy"],
                "description": "A sturdy wooden chest, firmly locked.", "location": "test_chamber", "canTake": false,
                "isOpenable": true, "isLocked": true, "isOpen": false, "isContainer": true, "contains": ["page"]
            },
            "page": {
                "id": "page", "name": "manual page", "noun": "page", "adjectives": ["manual", "lost", "torn"],
                "description": "A single page torn from a technical manual. It is covered in complex-looking code.", "location": "chest", "canTake": true,
                "readDescription": "== COMPILATION SCRIPT v1.1 ==\nTo compile the target environment, apply this page directly to the primary terminal interface. Note: Ensure target system is adequately powered before initiating script.",
                "points": 25
            },
            "terminal": {
                "id": "terminal", "name": "computer terminal", "noun": "terminal", "adjectives": ["computer", "primary"],
                "location": "test_chamber", "canTake": false, "state": "off",
                "descriptions": {
                    "off": "A computer terminal with a blank, dark screen. A small label at the base reads 'Primary Interface.' It appears to be powered down.",
                    "on": "The terminal screen glows with a soft green light, displaying a command prompt: [COMPILE_TARGET:]"
                },
                "onUse": {
                    "page": {
                        "conditions": [
                            { "itemId": "terminal", "requiredState": "on" }
                        ],
                        "message": "",
                        "failureMessage": "You touch the page to the dark screen, but nothing happens. The terminal seems to be off.",
                        "destroyItem": true
                    }
                }
            },
            "lantern": {
                "id": "lantern", "name": "old lantern", "noun": "lantern", "adjectives": ["old", "brass"],
                "description": "An old-fashioned brass lantern. It seems functional and ready to be lit.", "location": "server_closet", "canTake": true,
                "isLightSource": true, "isLit": false, "points": 5
            },
            "power_box": {
                "id": "power_box", "name": "power box", "noun": "box", "adjectives": ["power", "metal", "heavy"],
                "location": "server_closet", "canTake": false, "state": "off",
                "descriptions": {
                    "off": "A heavy metal power box is bolted to the wall. A large lever on its front is set to the 'OFF' position.",
                    "on": "The lever on the power box is now in the 'ON' position. The box emits a low electrical hum."
                },
                "onPush": {
                    "newState": "on",
                    "message": "You push the heavy lever. It clunks into the 'ON' position. You hear an electrical thrum, and a light from the other room flickers under the door.",
                    "effects": [
                        { "targetId": "terminal", "newState": "on" }
                    ]
                }
            }
        },
        "npcs": {
            "architect": {
                "id": "architect", "name": "The Architect", "noun": "architect", "adjectives": ["shimmering", "holographic"],
                "description": "A shimmering, semi-transparent figure paces around the room. It looks like a system projection, an architect of this digital space.",
                "location": "test_chamber", "inventory": [],
                "dialogue": {
                    "default": "'Welcome, apprentice,' the holographic figure says. 'This test chamber is bugged. Your task is to find the Lost Manual Page and use it to compile the room correctly. The system is yours to explore.'",
                    "terminal": "'The terminal is the key to compiling the environment,' the Architect explains, 'but it appears to be without power.'",
                    "page": "'The Manual Page contains the final compilation script. You'll need to apply it to the terminal.'",
                    "room": "'Just a sandbox,' it says, gesturing at the flickering walls. 'But a sandbox in need of a fix.'",
                    "key": "'Every lock has its key. A simple principle, but effective.'"
                },
                "onShow": {
                    "page": "The Architect's form stabilizes for a moment. 'Excellent! Now, use the page on the terminal to compile the room.'",
                    "default": "The Architect glances at the item. 'An interesting tool, but is it what you need to complete the primary objective?'"
                }
            }
        },
        "daemons": {
            "hint_daemon": {
                "active": true,
                "repeatable": true,
                "trigger": {
                    "type": "every_x_turns",
                    "value": 10
                },
                "action": {
                    "type": "message",
                    "text": "The Architect looks at you thoughtfully. 'Remember to examine everything closely. ASK me about things if you get stuck. And if you find something that can be opened, look inside it.'"
                }
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
                while (scriptContext.currentLineIndex < scriptContext.lines.length - 1 && TextAdventureModal.isActive()) {
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

If no path to a custom game file is provided, the default built-in adventure, "The Architect's Apprentice," will be started.

GAMEPLAY COMMANDS
       The following commands are available while inside the adventure:
       
       look [target]      - Describes the room or a specific item/person.
       listen             - Listen to the sounds of the room.
       smell              - Smell the scents in the room.
       touch [item]       - Touch an item.
       go [direction]     - Moves the player (e.g., go north).
       again              - Repeats the last command you typed.
       wait               - Pass some time.
       talk to [person]   - Start a conversation.
       ask [person] about [topic]
                          - Ask someone about a specific topic.
       give [item] to [person]
                          - Give an item from your inventory to someone.
       show [item] to [person]
                          - Show an item to someone without giving it away.
       take [item]        - Picks up an item from the room.
       drop [item]        - Drops an item from inventory.
       read [item]        - Read a book, scroll, or leaflet.
       eat [item]         - Eat an edible item.
       drink [item]       - Drink a potable item.
       open / close [item]
                          - Open or close a container or door.
       lock / unlock [item] with [key]
                          - Lock or unlock something with a key.
       push / pull / turn [item]
                          - Interact with mechanisms.
       wear / remove [item]
                          - Wear or remove clothing/armor.
       use [item] on [target]
                          - Uses an inventory item on something in the room.
       score              - Displays your current score and number of moves.
       inventory (or i)   - Shows what you are carrying.
       save / load        - Saves or loads game progress to a file in the VFS.
       help               - Shows this list of gameplay commands.
       quit / exit        - Exits the game and returns to the terminal.

CUSTOM ADVENTURES
       You can create your own adventures using a specific JSON format. The JSON file must contain objects for 'rooms' and 'items', and specify a 'startingRoomId' and a 'winCondition'. Upload your .json file and run \`adventure /path/to/your_game.json\` to play.`;

    CommandRegistry.register("adventure", adventureCommandDefinition, adventureDescription, adventureHelpText);
})();