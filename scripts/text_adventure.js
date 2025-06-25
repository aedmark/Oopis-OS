// text_adventure.js - OopisOS Adventure Engine and Editor

/**
 * @typedef {Object.<string, Room>} RoomDict
 */

/**
 * @typedef {Object.<string, Item>} ItemDict
 */

/**
 * @typedef {Object} WinCondition
 * @property {'itemInRoom' | 'playerHasItem'} type - The type of condition to check for winning.
 * @property {string} itemId - The ID of the item involved in the win condition.
 * @property {string} [roomId] - The ID of the room, required if type is 'itemInRoom'.
 */

/**
 * @typedef {Object} PlayerState
 * @property {string} currentLocation - The ID of the room the player is currently in.
 * @property {string[]} inventory - An array of item IDs that the player is carrying.
 */

/**
 * @typedef {Object} Item
 * @property {string} id - The unique identifier for the item.
 * @property {string} name - The display name of the item.
 * @property {string} description - The default description of the item when looked at.
 * @property {Object.<string, string>} [descriptions] - State-based descriptions (e.g., for 'open', 'closed').
 * @property {string} location - The current location of the item (a room ID, container ID, or 'player').
 * @property {boolean} [canTake=true] - Whether the player can pick up this item.
 * @property {boolean} [isContainer=false] - Whether this item can hold other items.
 * @property {boolean} [isOpenable=false] - Whether this item can be opened or closed.
 * @property {string} [state] - The current state of the item (e.g., 'locked', 'open', 'closed').
 * @property {string} [unlocksWith] - The ID of the item required to unlock this one.
 * @property {string} [unlockMessage] - The message displayed upon successful unlocking.
 * @property {string} [lockedMessage] - The message displayed when trying to interact while locked.
 * @property {string} [leadsTo] - For door-like items, the room ID they lead to.
 */

/**
 * @typedef {Object} Room
 * @property {string} id - The unique identifier for the room.
 * @property {string} name - The name of the room.
 * @property {string} description - The description of the room.
 * @property {Object.<string, string>} [exits] - A dictionary mapping direction names to room or item IDs.
 */

/**
 * @typedef {Object} Adventure
 * @property {string} title - The title of the adventure.
 * @property {string} startingRoomId - The ID of the room where the player begins.
 * @property {RoomDict} rooms - A dictionary of all rooms in the adventure.
 * @property {ItemDict} items - A dictionary of all items in the adventure.
 * @property {PlayerState} player - The initial state of the player.
 * @property {WinCondition} winCondition - The condition required to win the game.
 * @property {string} winMessage - The message displayed when the win condition is met.
 */


const TextAdventureModal = (() => {
  "use strict";
  let adventureModal, adventureOutput, adventureInput, adventureCloseBtn, adventureTitle;
  let isActive = false;
  let promptResolver = null;
  let currentEngineInstance = null;
  let currentScriptingContext = null;
  let sessionCompletionResolver = null; // Add this line

  function _initDOM() {
    adventureModal = document.getElementById('adventure-modal');
    adventureOutput = document.getElementById('adventure-output');
    adventureInput = document.getElementById('adventure-input');
    adventureCloseBtn = document.getElementById('adventure-close-btn');
    adventureTitle = document.getElementById('adventure-title');
    if (!adventureModal || !adventureOutput || !adventureInput || !adventureCloseBtn || !adventureTitle) {
      console.error("TextAdventureModal: Critical UI elements not found in DOM!");
      return false;
    }
    return true;
  }

  function show(adventureData, engineInstance, scriptingContext) {
    if (!_initDOM()) return Promise.reject("DOM Not Ready");

    return new Promise(resolve => {
      sessionCompletionResolver = resolve;
      currentEngineInstance = engineInstance;
      currentScriptingContext = scriptingContext;
      isActive = true;
      adventureTitle.textContent = adventureData.title || "Text Adventure";
      adventureOutput.innerHTML = '';
      adventureInput.value = '';
      adventureInput.disabled = false;
      adventureModal.classList.remove('hidden');

      if (typeof OutputManager !== 'undefined') OutputManager.setEditorActive(true);
      if (typeof TerminalUI !== 'undefined') TerminalUI.setInputState(false);

      adventureInput.focus();
      adventureInput.addEventListener('keydown', _handleInputKeydown);
      adventureCloseBtn.addEventListener('click', hide);
    });
  }

  function hide() {
    if (!isActive) return;

    if (sessionCompletionResolver) {
      sessionCompletionResolver();
      sessionCompletionResolver = null;
    }

    isActive = false;

    if (promptResolver) {
      promptResolver(null);
      promptResolver = null;
    }

    currentScriptingContext = null;

    adventureModal.classList.add('hidden');
    if (typeof OutputManager !== 'undefined') OutputManager.setEditorActive(false);
    if (typeof TerminalUI !== 'undefined') {
      TerminalUI.setInputState(true);
      TerminalUI.focusInput();
    }

    adventureInput.removeEventListener('keydown', _handleInputKeydown);
    adventureCloseBtn.removeEventListener('click', hide);
    if (typeof OutputManager !== 'undefined') {
      void OutputManager.appendToOutput("Exited text adventure.", { typeClass: Config.CSS_CLASSES.CONSOLE_LOG_MSG });
    }
  }

  function _handleInputKeydown(event) {
    if (event.key === 'Enter') {
      event.preventDefault();
      const command = adventureInput.value.trim();
      adventureInput.value = '';

      if (promptResolver) {
        appendOutput(`> ${command}`, 'system');
        const resolver = promptResolver;
        promptResolver = null;
        resolver(command);
      }
      else if (command && currentEngineInstance) {
        currentEngineInstance.processCommand(command);
      }
    }
  }

  function requestInput(promptText) {
    appendOutput(promptText, 'system');

    if (currentScriptingContext && currentScriptingContext.isScripting) {
      let inputLine = null;
      while (currentScriptingContext.currentLineIndex < currentScriptingContext.lines.length - 1) {
        currentScriptingContext.currentLineIndex++;
        const line = currentScriptingContext.lines[currentScriptingContext.currentLineIndex].trim();
        if (line && !line.startsWith('#')) {
          inputLine = line;
          break;
        }
      }

      if (inputLine !== null) {
        appendOutput(`> ${inputLine}`, 'system');
        return Promise.resolve(inputLine);
      } else {
        appendOutput("> [end of script]", 'system');
        return Promise.resolve(null);
      }
    }

    return new Promise(resolve => {
      promptResolver = resolve;
      adventureInput.focus();
    });
  }

  function appendOutput(text, type = 'room-desc') {
    if (!_initDOM()) return;
    const p = document.createElement('p');
    p.textContent = text;
    if (type) p.className = type;
    adventureOutput.appendChild(p);
    adventureOutput.scrollTop = adventureOutput.scrollHeight;
  }

  function clearOutput() {
    if(adventureOutput) adventureOutput.innerHTML = '';
  }

  return {
    show,
    hide,
    appendOutput,
    clearOutput,
    requestInput,
    isActive: () => isActive,
  };
})();

const TextAdventureEngine = (() => {
  "use strict";
  /** @type {Adventure} */
  let adventure;
  /** @type {PlayerState} */
  let player;
  let scriptingContext = null;

  /**
   * @param {Adventure} adventureData
   * @param {object} options
   */
  function startAdventure(adventureData, options = {}) {
    adventure = JSON.parse(JSON.stringify(adventureData));
    scriptingContext = options.scriptingContext || null;
    player = {
      currentLocation: adventure.startingRoomId,
      inventory: adventure.player?.inventory || [],
    };
    TextAdventureModal.show(adventure, { processCommand }, scriptingContext);
    _displayCurrentRoom();
  }

  async function processCommand(command) {
    TextAdventureModal.appendOutput(`> ${command}`, 'system');
    const parts = command.toLowerCase().trim().split(/\s+/);
    const action = parts[0];
    const target = parts.slice(1).join(" ");
    if (!action) return;

    switch(action) {
      case 'look': _handleLook(target); break;
      case 'go': case 'move': _handleGo(target); break;
      case 'take': case 'get': _handleTake(target); break;
      case 'drop': _handleDrop(target); break;
      case 'inventory': case 'i': _handleInventory(); break;
      case 'help': _handleHelp(); break;
      case 'quit': case 'exit': TextAdventureModal.hide(); break;
      case 'use': _handleUse(target); break;
      case 'open': case 'close': _handleOpen(action, target); break;
      case 'save': void _handleSave(); break;
      case 'load': void _handleLoad(); break;
      default: TextAdventureModal.appendOutput("I don't understand that command. Try 'help'.", 'error');
    }
    _checkWinConditions();
  }

  async function _handleSave() {
    const fileName = await TextAdventureModal.requestInput("Save game as (leave blank to cancel):");
    if (!fileName) {
      TextAdventureModal.appendOutput("Save cancelled.", 'info');
      return;
    }

    const itemStates = {};
    for (const id in adventure.items) {
      itemStates[id] = { location: adventure.items[id].location, state: adventure.items[id].state };
    }

    const saveState = {
      adventureFile: adventure.title,
      timestamp: new Date().toISOString(),
      player: player,
      itemStates: itemStates
    };

    const currentUser = UserManager.getCurrentUser().name;
    const primaryGroup = UserManager.getPrimaryGroupForUser(currentUser);
    const savePath = FileSystemManager.getAbsolutePath(`${fileName}.sav`, FileSystemManager.getCurrentPath());

    const saveResult = await FileSystemManager.createOrUpdateFile(
        savePath,
        JSON.stringify(saveState, null, 2),
        { currentUser, primaryGroup }
    );

    if (saveResult.success) {
      await FileSystemManager.save();
      TextAdventureModal.appendOutput(`Game saved to '${fileName}.sav'.`, 'info');
    } else {
      TextAdventureModal.appendOutput(`Error saving game: ${saveResult.error}`, 'error');
    }
  }

  async function _handleLoad() {
    const fileName = await TextAdventureModal.requestInput("Load which save game? (leave blank to cancel):");
    if (!fileName) {
      TextAdventureModal.appendOutput("Load cancelled.", 'info');
      return;
    }

    const savePath = FileSystemManager.getAbsolutePath(`${fileName}.sav`, FileSystemManager.getCurrentPath());
    const pathInfo = FileSystemManager.validatePath("adventure load", savePath, {
      expectedType: Config.FILESYSTEM.DEFAULT_FILE_TYPE
    });

    if (pathInfo.error) {
      TextAdventureModal.appendOutput(`Could not find save game '${fileName}.sav'.`, 'error');
      return;
    }

    try {
      const saveData = JSON.parse(pathInfo.node.content);
      player = saveData.player;
      for(const id in saveData.itemStates) {
        if (adventure.items[id]) {
          adventure.items[id].location = saveData.itemStates[id].location;
          if (saveData.itemStates[id].state) {
            adventure.items[id].state = saveData.itemStates[id].state;
          }
        }
      }

      TextAdventureModal.clearOutput();
      TextAdventureModal.appendOutput(`Game '${fileName}.sav' loaded successfully.`, 'info');
      _displayCurrentRoom();

    } catch (e) {
      TextAdventureModal.appendOutput(`Failed to load save game. File may be corrupt.`, 'error');
      console.error("Adventure load error:", e);
    }
  }

  function _displayCurrentRoom() {
    const room = adventure.rooms[player.currentLocation];
    if(!room) {
      TextAdventureModal.appendOutput("Error: You are in an unknown void!", 'error');
      return;
    }
    TextAdventureModal.appendOutput(`\n--- ${room.name} ---`, 'room-name');
    TextAdventureModal.appendOutput(room.description, 'room-desc');
    const roomItems = _getItemsInRoom(player.currentLocation);
    if(roomItems.length > 0) {
      TextAdventureModal.appendOutput("You see here: " + roomItems.map(item => adventure.items[item.id].name).join(", ") + ".", 'items');
    }
    const exitNames = Object.keys(room.exits || {});
    if(exitNames.length > 0) {
      TextAdventureModal.appendOutput("Exits: " + exitNames.join(", ") + ".", 'exits');
    } else {
      TextAdventureModal.appendOutput("There are no obvious exits.", 'exits');
    }
  }

  function _handleUse(target) {
    const parts = target.split(/ on | with /);
    const itemName = parts[0]?.trim();
    const targetName = parts[1]?.trim();

    if (!itemName) {
      TextAdventureModal.appendOutput("What do you want to use?", 'error');
      return;
    }

    const itemToUse = _findItemInInventory(itemName);
    if (!itemToUse) {
      TextAdventureModal.appendOutput(`You don't have a "${itemName}".`, 'error');
      return;
    }

    if (targetName) {
      const targetItem = _findItemByName(targetName, player.currentLocation);
      if (!targetItem) {
        TextAdventureModal.appendOutput(`You don't see a "${targetName}" here.`, 'error');
        return;
      }

      if (targetItem.unlocksWith === itemToUse.id) {
        if (targetItem.state === 'locked') {
          targetItem.state = 'unlocked';
          TextAdventureModal.appendOutput(targetItem.unlockMessage || `You unlock the ${targetItem.name}.`, 'info');
        } else {
          TextAdventureModal.appendOutput(`The ${targetItem.name} is already unlocked.`, 'info');
        }
      } else {
        TextAdventureModal.appendOutput(`You can't use the ${itemToUse.name} on the ${targetItem.name}.`, 'info');
      }
    } else {
      TextAdventureModal.appendOutput("What do you want to use that on?", 'error');
    }
  }

  function _handleLook(target) {
    if (!target || target === 'room' || target === 'around') {
      _displayCurrentRoom();
      return;
    }

    const item = _findItemByName(target, player.currentLocation) || _findItemInInventory(target);

    if (item) {
      let descriptionToDisplay = `You see a ${item.name}.`;

      if (item.descriptions) {
        if (item.state && item.descriptions[item.state]) {
          descriptionToDisplay = item.descriptions[item.state];
        } else if (item.descriptions.default) {
          descriptionToDisplay = item.descriptions.default;
        }
      } else if (item.description) {
        descriptionToDisplay = item.description;
      }

      TextAdventureModal.appendOutput(descriptionToDisplay, 'info');

      if (item.isContainer && item.state === 'open') {
        _lookInContainer(item);
      }
    } else {
      TextAdventureModal.appendOutput(`You don't see any "${target}" here.`, 'error');
    }
  }

  function _handleOpen(action, targetName) {
    if (!targetName) {
      TextAdventureModal.appendOutput(`What do you want to ${action}?`, 'error');
      return;
    }

    const targetItem = _findItemByName(targetName, player.currentLocation);

    if (!targetItem) {
      TextAdventureModal.appendOutput(`You don't see a "${targetName}" here.`, 'error');
      return;
    }

    if (!targetItem.isOpenable) {
      TextAdventureModal.appendOutput(`You can't ${action} that.`, 'info');
      return;
    }

    if (targetItem.state === 'locked') {
      TextAdventureModal.appendOutput(targetItem.lockedMessage || `The ${targetItem.name} is locked.`, 'error');
      return;
    }

    if (action === 'open') {
      if (targetItem.state === 'open') {
        TextAdventureModal.appendOutput(`The ${targetItem.name} is already open.`, 'info');
      } else {
        targetItem.state = 'open';
        TextAdventureModal.appendOutput(`You open the ${targetItem.name}.`, 'info');
        if (targetItem.isContainer) {
          _lookInContainer(targetItem);
        }
      }
    } else { // 'close'
      if (targetItem.state === 'closed') {
        TextAdventureModal.appendOutput(`The ${targetItem.name} is already closed.`, 'info');
      } else {
        targetItem.state = 'closed';
        TextAdventureModal.appendOutput(`You close the ${targetItem.name}.`, 'info');
      }
    }
  }

  /** @param {Item} container */
  function _lookInContainer(container) {
    const itemsInside = _getItemsInContainer(container.id);
    if (itemsInside.length > 0) {
      const itemNames = itemsInside.map(item => adventure.items[item.id].name);
      TextAdventureModal.appendOutput("Inside you see: " + itemNames.join(", ") + ".", 'items');
    } else {
      TextAdventureModal.appendOutput("It is empty.", 'info');
    }
  }

  function _getItemsInContainer(containerId) {
    /** @type {Item[]} */
    const items = [];
    for (const id in adventure.items) {
      if (adventure.items[id].location === containerId) {
        items.push(adventure.items[id]);
      }
    }
    return items;
  }

  function _handleGo(direction) {
    const room = adventure.rooms[player.currentLocation];
    if (room.exits && room.exits[direction]) {
      const exitId = room.exits[direction];
      const exitObject = adventure.items[exitId];

      if (exitObject && exitObject.state) {
        if (exitObject.state === 'locked') {
          TextAdventureModal.appendOutput(exitObject.lockedMessage || `The ${exitObject.name} is locked.`, 'error');
          return;
        }
        if (exitObject.leadsTo && adventure.rooms[exitObject.leadsTo]) {
          player.currentLocation = exitObject.leadsTo;
          _displayCurrentRoom();
        } else {
          TextAdventureModal.appendOutput(`Error: The ${exitObject.name} leads to an undefined area!`, 'error');
        }
      } else {
        const nextRoomId = exitId;
        if (adventure.rooms[nextRoomId]) {
          player.currentLocation = nextRoomId;
          _displayCurrentRoom();
        } else {
          TextAdventureModal.appendOutput(`Error: The path to ${direction} leads to an undefined area!`, 'error');
        }
      }

    } else {
      TextAdventureModal.appendOutput(`You can't go that way.`, 'error');
    }
  }

  function _handleTake(itemName) {
    const item = _findItemByName(itemName, player.currentLocation);
    if (item) {
      if (item.canTake !== false) {
        player.inventory.push(item.id);
        item.location = 'player';
        TextAdventureModal.appendOutput(`You take the ${item.name}.`, 'info');
      } else {
        TextAdventureModal.appendOutput(`You can't take the ${item.name}.`, 'error');
      }
    } else {
      TextAdventureModal.appendOutput(`There is no "${itemName}" here to take.`, 'error');
    }
  }

  function _handleDrop(itemName) {
    const item = _findItemInInventory(itemName);
    if (item) {
      player.inventory = player.inventory.filter(id => id !== item.id);
      item.location = player.currentLocation;
      TextAdventureModal.appendOutput(`You drop the ${item.name}.`, 'info');
    } else {
      TextAdventureModal.appendOutput(`You don't have a "${itemName}" to drop.`, 'error');
    }
  }

  function _handleInventory() {
    if (player.inventory.length === 0) {
      TextAdventureModal.appendOutput("You are not carrying anything.", 'info');
    } else {
      const itemNames = player.inventory.map(id => adventure.items[id].name);
      TextAdventureModal.appendOutput("You are carrying: " + itemNames.join(", ") + ".", 'info');
    }
  }

  function _handleHelp() {
    TextAdventureModal.appendOutput("\nAvailable commands:", 'system');
    TextAdventureModal.appendOutput("  look [target] - Describes the room or an item.", 'system');
    TextAdventureModal.appendOutput("  go [direction] - Moves in a direction (e.g., go north).", 'system');
    TextAdventureModal.appendOutput("  take [item]   - Picks up an item.", 'system');
    TextAdventureModal.appendOutput("  drop [item]   - Drops an item.", 'system');
    TextAdventureModal.appendOutput("  use [item] on [target] - Uses an item from your inventory.", 'system');
    TextAdventureModal.appendOutput("  inventory (i) - Shows what you are carrying.", 'system');
    TextAdventureModal.appendOutput("  help          - Shows this help message.", 'system');
    TextAdventureModal.appendOutput("  quit / exit   - Exits the adventure.", 'system');
    TextAdventureModal.appendOutput("  open [container] - Opens a container or door.", 'system');
    TextAdventureModal.appendOutput("  close [container] - Closes a container or door.", 'system');
    TextAdventureModal.appendOutput("  save          - Saves your current progress.", 'system');
    TextAdventureModal.appendOutput("  load          - Loads a previous save file.", 'system');
  }

  /**
   * @param {string} name
   * @param {string | null} locationId
   * @returns {Item | null}
   */
  function _findItemByName(name, locationId = null) {
    for (const id in adventure.items) {
      const item = adventure.items[id];
      if (item.name.toLowerCase() === name.toLowerCase()) {
        if (item.location === locationId) {
          return item;
        }
        // Check if item is inside an open container in the current location
        const container = adventure.items[item.location];
        if (container && container.location === locationId && container.isContainer && container.state === 'open') {
          return item;
        }
      }
    }
    return null;
  }

  /**
   * @param {string} name
   * @returns {Item | null}
   */
  function _findItemInInventory(name) {
    const itemId = player.inventory.find(id => adventure.items[id].name.toLowerCase() === name.toLowerCase());
    return itemId ? adventure.items[itemId] : null;
  }

  /**
   * @param {string} roomId
   * @returns {Item[]}
   */
  function _getItemsInRoom(roomId) {
    /** @type {Item[]} */
    const itemsInRoom = [];
    for (const id in adventure.items) {
      if (adventure.items[id].location === roomId) {
        itemsInRoom.push(adventure.items[id]);
      }
    }
    return itemsInRoom;
  }

  function _checkWinConditions() {
    const winCondition = adventure.winCondition;
    if (!winCondition) return;

    let won = false;
    if (winCondition.type === "itemInRoom" && adventure.items[winCondition.itemId]?.location === winCondition.roomId) {
      won = true;
    } else if (winCondition.type === "playerHasItem" && player.inventory.includes(winCondition.itemId)) {
      won = true;
    }

    if (won) {
      TextAdventureModal.appendOutput(adventure.winMessage || "\n*** Congratulations! You have won! ***", 'system');
      const adventureInput = document.getElementById('adventure-input');
      if (adventureInput) adventureInput.disabled = true;
    }
  }

  return {
    startAdventure,
    processCommand,
  };
})();

// Define the global sampleAdventure object
window.sampleAdventure = {
  "title": "The Test Chamber",
  "startingRoomId": "hallway",
  "winCondition": {"type": "itemInRoom", "itemId": "trophy", "roomId": "throne_room"},
  "winMessage": "You place the trophy on the throne. You have won the test!",
  "rooms": {
    "hallway": {
      "id": "hallway", "name": "Stone Hallway",
      "description": "A dusty hallway. A heavy oak door is to the north.",
      "exits": {"north": "oak_door"}
    },
    "throne_room": {
      "id": "throne_room", "name": "Throne Room",
      "description": "A grand room with a single throne.",
      "exits": {}
    }
  },
  "items": {
    "rusty_key": {
      "id": "rusty_key", "name": "rusty key", "location": "hallway"
    },
    "oak_door": {
      "id": "oak_door", "name": "oak door", "location": "hallway",
      "isOpenable": true, "state": "locked", "unlocksWith": "rusty_key",
      "leadsTo": "throne_room", "canTake": false
    },
    "trophy": { "id": "trophy", "name": "shiny trophy", "location": "player" }
  }
};