/**
 * @file Defines the 'adventure' command, which launches the OopisOS text adventure game engine.
 * @author Andrew Edmark & Gemini
 */

(() => {
    "use strict";

    // The default, built-in adventure game data, now with more NPC interaction.
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
                "onSmell": "The air is sweet with the scent of blooming flowers.",
                "exits": { "north": "west_of_house" }
            },
            "front_door": {
                "name": "Front Door",
                "description": "You are at the front door. It is boarded up but has a large, rusty lock.",
                "onListen": "You hear the wind whistling through the cracks in the boards.",
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
                "description": "A small, folded leaflet.", "location": "mailbox", "canTake": true,
                "readDescription": "WELCOME TO ZORK!\n\nZORK is a game of adventure, danger, and low cunning. In it you will explore some of the most amazing territory ever seen by mortals. No computer should be without one!"
            },
            "key": {
                "id": "key", "name": "rusty key", "noun": "key", "adjectives": ["rusty", "old"],
                "description": "It's an old, rusty key. It looks like it might fit the lock on the front door.", "location": "north_of_house", "canTake": true,
                "unlocks": "door",
                "onTouch": "The key feels cold and rough to the touch."
            },
            "door": {
                "id": "door", "name": "boarded front door", "noun": "door", "adjectives": ["boarded", "front", "white"],
                "description": "The door is made of sturdy oak, but has been boarded up. It is locked.", "location": "front_door", "canTake": false,
                "isOpenable": true, "isLocked": true, "isOpen": false
            },
            "lantern": {
                "id": "lantern", "name": "brass lantern", "noun": "lantern", "adjectives": ["brass", "old"],
                "description": "An old brass lantern. It's currently unlit.", "location": "north_of_house", "canTake": true,
                "isLightSource": true, "isLit": false,
                "onSmell": "It smells faintly of lamp oil."
            }
        },
        "npcs": {
            "wizard": {
                "id": "wizard",
                "name": "old wizard",
                "noun": "wizard",
                "adjectives": ["old", "wise"],
                "description": "The wizard looks ancient, with a kind face and twinkling eyes. He seems to be waiting for someone to talk to.",
                "location": "north_of_house",
                "inventory": [],
                "dialogue": {
                    "default": "The wizard smiles. 'A lovely day for an adventure, isn't it?'",
                    "hello": "The wizard nods. 'Greetings, traveler. What brings you to this part of the woods?'",
                    "key": "The wizard's eyes twinkle. 'Ah, the key! A very important item indeed. It unlocks things, you see. Doors, primarily.'",
                    "house": "'The house has been abandoned for years,' the wizard says sadly. 'A great treasure was lost within its walls.'",
                    "treasure": "'The treasure of Zork! A fool's errand for most, but perhaps not for you. You'll need more than a key to find it, however. You'll need courage... and a light.'",
                    "lantern": "He looks at the lantern. 'A source of light is crucial in the dark places of the world. Keep it safe.'"
                },
                "onShow": {
                    "key": "The wizard peers at the key. 'Yes, that is the one. It will open a great many things, but not the final door. For that, you need more than simple metal.'",
                    "lantern": "He nods approvingly. 'A fine lantern. It will be invaluable in the darkness below.'",
                    "default": "The wizard looks at the item you're holding. 'Interesting,' he says noncommittally."
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

If no path to a custom game file is provided, the default built-in adventure, "The Lost Key of Oopis," will be started.

GAMEPLAY COMMANDS
       The following commands are available while inside the adventure:
       
       look [target]      - Describes the room or a specific item/person.
       listen             - Listen to the sounds of the room.
       smell              - Smell the scents in the room.
       touch [item]       - Touch an item.
       go [direction]     - Moves the player (e.g., go north).
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
       inventory (or i)   - Shows what you are carrying.
       save / load        - Saves or loads game progress to a file in the VFS.
       help               - Shows this list of gameplay commands.
       quit / exit        - Exits the game and returns to the terminal.

CUSTOM ADVENTURES
       You can create your own adventures using a specific JSON format. The JSON file must contain objects for 'rooms' and 'items', and specify a 'startingRoomId' and a 'winCondition'. Upload your .json file and run \`adventure /path/to/your_game.json\` to play.`;

    CommandRegistry.register("adventure", adventureCommandDefinition, adventureDescription, adventureHelpText);
})();