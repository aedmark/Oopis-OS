// /scripts/commands/adventure.js

const defaultAdventureData = {
  title: "The Architect's Apprentice",
  startingRoomId: "test_chamber",
  maxScore: 50,
  winCondition: {
    type: "itemUsedOn",
    itemId: "page",
    targetId: "terminal",
  },
  winMessage:
      "You touch the manual page to the terminal's screen. The text on the page dissolves into light, flowing into the terminal. The room shimmers, and the placeholder textures resolve into solid, finished surfaces. The low hum ceases, replaced by a soft, pleasant ambiance.\\n\\nThe Architect smiles. 'Excellent work. Test complete.'",
  rooms: {
    test_chamber: {
      name: "Test Chamber",
      points: 0,
      description:
          "You are in a room that feels... unfinished. Some wall textures are flickering placeholders, and a low, persistent hum fills the air. There is a simple metal desk, a sturdy-looking chest, and a computer terminal with a dark screen. A single door is to the north. A shimmering, holographic figure watches you expectantly.",
      exits: { north: "server_closet" },
    },
    server_closet: {
      name: "Server Closet",
      description:
          "You have entered a small, dark closet. It is pitch black.",
      isDark: true,
      onListen:
          "You hear the quiet whirring of server fans, somewhere in the darkness.",
      onSmell: "The air is stale and smells of hot electronics.",
      exits: { south: "test_chamber" },
    },
  },
  items: {
    desk: {
      id: "desk",
      name: "metal desk",
      noun: "desk",
      adjectives: ["metal", "simple"],
      description:
          "A simple metal desk. A small, brass key rests on its surface.",
      location: "test_chamber",
      canTake: false,
    },
    key: {
      id: "key",
      name: "brass key",
      noun: "key",
      adjectives: ["brass", "small"],
      description: "A small, plain brass key. It feels slightly warm.",
      location: "test_chamber",
      canTake: true,
      unlocks: "chest",
      points: 10,
    },
    chest: {
      id: "chest",
      name: "wooden chest",
      noun: "chest",
      adjectives: ["wooden", "sturdy"],
      description: "A sturdy wooden chest, firmly locked.",
      location: "test_chamber",
      canTake: false,
      isOpenable: true,
      isLocked: true,
      isOpen: false,
      isContainer: true,
      contains: ["page"],
    },
    page: {
      id: "page",
      name: "manual page",
      noun: "page",
      adjectives: ["manual", "lost", "torn"],
      description:
          "A single page torn from a technical manual. It is covered in complex-looking code.",
      location: "chest",
      canTake: true,
      readDescription:
          "== COMPILATION SCRIPT v1.1 ==\\nTo compile the target environment, apply this page directly to the primary terminal interface. Note: Ensure target system is adequately powered before initiating script.",
      points: 25,
    },
    terminal: {
      id: "terminal",
      name: "computer terminal",
      noun: "terminal",
      adjectives: ["computer", "primary"],
      location: "test_chamber",
      canTake: false,
      state: "off",
      descriptions: {
        off: "A computer terminal with a blank, dark screen. A small label at the base reads 'Primary Interface.' It appears to be powered down.",
        on: "The terminal screen glows with a soft green light, displaying a command prompt: [COMPILE_TARGET:]",
      },
      onUse: {
        page: {
          conditions: [{ itemId: "terminal", requiredState: "on" }],
          message: "",
          failureMessage:
              "You touch the page to the dark screen, but nothing happens. The terminal seems to be off.",
          destroyItem: true,
        },
      },
    },
    lantern: {
      id: "lantern",
      name: "old lantern",
      noun: "lantern",
      adjectives: ["old", "brass"],
      description:
          "An old-fashioned brass lantern. It seems functional and ready to be lit.",
      location: "server_closet",
      canTake: true,
      isLightSource: true,
      isLit: false,
      points: 5,
    },
    power_box: {
      id: "power_box",
      name: "power box",
      noun: "box",
      adjectives: ["power", "metal", "heavy"],
      location: "server_closet",
      canTake: false,
      state: "off",
      descriptions: {
        off: "A heavy metal power box is bolted to the wall. A large lever on its front is set to the 'OFF' position.",
        on: "The lever on the power box is now in the 'ON' position. The box emits a low electrical hum.",
      },
      onPush: {
        newState: "on",
        message:
            "You push the heavy lever. It clunks into the 'ON' position. You hear an electrical thrum, and a light from the other room flickers under the door.",
        effects: [{ targetId: "terminal", newState: "on" }],
      },
    },
  },
  npcs: {
    architect: {
      id: "architect",
      name: "The Architect",
      noun: "architect",
      adjectives: ["shimmering", "holographic"],
      description:
          "A shimmering, semi-transparent figure paces around the room. It looks like a system projection, an architect of this digital space.",
      location: "test_chamber",
      inventory: [],
      dialogue: {
        startNode: "start",
        nodes: {
          "start": {
            "npcResponse": "'Welcome, apprentice. This test chamber is bugged. Your task is to find the Lost Manual Page and use it to compile the room correctly. Do you understand the objective, or do you have questions about the chamber itself?'",
            "playerChoices": [
              { "keywords": ["understand", "objective", "yes"], "prompt": "(You could say you understand the objective.)", "nextNode": "objective_understood" },
              { "keywords": ["chamber", "questions", "room"], "prompt": "(You could ask about the chamber.)", "nextNode": "ask_about_chamber" }
            ]
          },
          "objective_understood": {
            "npcResponse": "'Excellent. The system is yours to explore. Remember to examine everything closely. ASK me about things if you get stuck.'",
            "playerChoices": []
          },
          "ask_about_chamber": {
            "npcResponse": "'Just a sandbox,' it says, gesturing at the flickering walls. 'But a sandbox in need of a fix. The terminal is the key, but it appears to be without power. Every lock has its key, of course.'",
            "playerChoices": []
          }
        }
      },
      onShow: {
        page: "The Architect's form stabilizes for a moment. 'Excellent! Now, use the page on the terminal to compile the room.'",
        default:
            "The Architect glances at the item. 'An interesting tool, but is it what you need to complete the primary objective?'",
      },
    },
  },
  daemons: {
    hint_daemon: {
      active: true,
      repeatable: true,
      trigger: {
        type: "every_x_turns",
        value: 10,
      },
      action: {
        type: "message",
        text: "The Architect looks at you thoughtfully. 'Remember to examine everything closely. ASK me about things if you get stuck. And if you find something that can be opened, look inside it.'",
      },
    },
  },
};

window.AdventureCommand = class AdventureCommand extends Command {
  constructor() {
    super({
      commandName: "adventure",
      dependencies: [
        "apps/adventure/adventure_ui.js",
        "apps/adventure/adventure_manager.js",
        "apps/adventure/adventure_create.js",
        "pager.js",
      ],
      applicationModules: ["AdventureManager", "TextAdventureModal", "App", "Adventure_create"],
      description: "Starts an interactive text adventure game or creation tool.",
      helpText: `Usage: adventure [--create] [path_to_game.json]
    Launches the OopisOS interactive text adventure engine.
    MODES
    Play Mode (default)
    Launches the game. If no file is provided, starts the default adventure.
    Creation Mode
    Use 'adventure --create <file.json>' to enter an interactive shell
    for building or editing an adventure file.
    GAMEPLAY COMMANDS
    look, go, take, drop, use, inventory, save, load, quit, etc.
    Type 'help' inside the game for a full list of gameplay commands.
    CREATION COMMANDS
    create <type> "<name>"
    edit <type> "<name>"
    set <property> "<value>"
    link "<room1>" <dir> "<room2>"
    save
    exit
    Type 'help' inside the creator for a full list of building commands.`,
      completionType: "paths",
      flagDefinitions: [{ name: "create", short: "--create" }],
      validations: {
        args: {
          max: 1
        },
      },
    });
  }

  async coreLogic(context) {

    const { args, options, flags, dependencies } = context;
    const { ErrorHandler, AppLayerManager, FileSystemManager, AdventureManager, TextAdventureModal, App, Adventure_create } = dependencies;

    try {
      if (flags.create) {
        const filename = args[0];
        if (!filename) {
          return ErrorHandler.createError(
              "Usage: adventure --create <filename.json>"
          );
        }
        if (!filename.endsWith(".json")) {
          return ErrorHandler.createError("Filename must end with .json");
        }

        if (typeof Adventure_create === 'undefined') {
          return ErrorHandler.createError("Adventure Creator module is not properly loaded.");
        }

        let initialData = {};
        const pathInfoResult = FileSystemManager.validatePath(filename, { allowMissing: true, expectedType: 'file', permissions: ['read'] });
        if (!pathInfoResult.success && pathInfoResult.data.node) {
          return ErrorHandler.createError(`adventure: ${pathInfoResult.error}`);
        }
        const pathInfo = pathInfoResult.data;

        if (pathInfo && pathInfo.node) {
          try {
            initialData = JSON.parse(pathInfo.node.content || "{}");
          } catch (e) {
            return ErrorHandler.createError(
                `Could not parse existing file '${filename}'. It may be corrupt.`
            );
          }
        } else {
          initialData = {
            title: "New Adventure",
            rooms: {},
            items: {},
            npcs: {},
            daemons: {},
          };
        }
        await Adventure_create.enter(filename, initialData, context);
        return ErrorHandler.createSuccess("");
      }

      if (
          typeof AdventureManager === "undefined" ||
          typeof TextAdventureModal === "undefined" ||
          typeof App === "undefined"
      ) {
        return ErrorHandler.createError(
            "Adventure module is not properly loaded."
        );
      }

      let adventureToLoad;
      if (args.length > 0) {
        const pathValidationResult = FileSystemManager.validatePath(args[0], { expectedType: 'file', permissions: ['read'] });
        if (!pathValidationResult.success) {
          return ErrorHandler.createError(`adventure: ${pathValidationResult.error}`);
        }
        try {
          adventureToLoad = JSON.parse(pathValidationResult.data.node.content);
        } catch (e) {
          return ErrorHandler.createError(
              `adventure: Error parsing adventure file '${args[0]}': ${e.message}`
          );
        }
      } else {
        adventureToLoad = defaultAdventureData;
      }

      AppLayerManager.show(new AdventureManager(), {
        adventureData: adventureToLoad,
        scriptingContext: options.scriptingContext,
        dependencies
      });

      return ErrorHandler.createSuccess("");
    } catch (e) {
      return ErrorHandler.createError(
          `adventure: An unexpected error occurred: ${e.message}`
      );
    }

  }
}

window.CommandRegistry.register(new AdventureCommand());