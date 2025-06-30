/**
 * @file Manages the OopisOS text adventure game engine, including game state,
 * command processing, and UI interaction via the TextAdventureModal.
 * @author Andrew Edmark
 * @author Gemini
 */

/**
 * @typedef {Object.<string, Room>} RoomDict A dictionary of Room objects, keyed by room ID.
 */

/**
 * @typedef {Object.<string, Item>} ItemDict A dictionary of Item objects, keyed by item ID.
 */

/**
 * @typedef {Object} WinCondition Defines the condition required to win the game.
 * @property {'itemInRoom' | 'playerHasItem'} type - The type of condition to check for winning.
 * @property {string} itemId - The ID of the item involved in the win condition.
 * @property {string} [roomId] - The ID of the room, required if type is 'itemInRoom'.
 */

/**
 * @typedef {Object} PlayerState Represents the player's current state.
 * @property {string} currentLocation - The ID of the room the player is currently in.
 * @property {string[]} inventory - An array of item IDs that the player is carrying.
 */

/**
 * @typedef {Object} Item Represents an item within the adventure.
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
 * @typedef {Object} Room Represents a location in the adventure.
 * @property {string} id - The unique identifier for the room.
 * @property {string} name - The name of the room.
 * @property {string} description - The description of the room.
 * @property {Object.<string, string>} [exits] - A dictionary mapping direction names to room or item IDs.
 */

/**
 * @typedef {Object} Adventure The complete data structure for an adventure game.
 * @property {string} title - The title of the adventure.
 * @property {string} startingRoomId - The ID of the room where the player begins.
 * @property {RoomDict} rooms - A dictionary of all rooms in the adventure.
 * @property {ItemDict} items - A dictionary of all items in the adventure.
 * @property {PlayerState} player - The initial state of the player.
 * @property {WinCondition} winCondition - The condition required to win the game.
 * @property {string} winMessage - The message displayed when the win condition is met.
 */


/**
 * @module TextAdventureModal
 * @description Manages the UI modal for the text adventure game.
 */
const TextAdventureModal = (() => {
  "use strict";
  let elements = {};
  let isActive = false;
  let promptResolver = null;
  let currentEngineInstance = null;
  let currentScriptingContext = null;
  let sessionCompletionResolver = null;

  /**
   * Creates the DOM structure for the adventure game modal.
   * This function is called once when the game is launched.
   * @private
   * @returns {HTMLElement} The root element for the adventure modal.
   */
  function _buildLayout() {
    // Create elements using Utils.createElement for robustness
    elements.adventureTitle = Utils.createElement('span', { id: 'adventure-title' });
    elements.adventureCloseBtn = Utils.createElement('button', { id: 'adventure-close-btn', className: 'btn btn--cancel', textContent: 'Exit Adventure' });
    elements.adventureHeader = Utils.createElement('div', { id: 'adventure-header', className: 'modal-dialog__header' }, [elements.adventureTitle, elements.adventureCloseBtn]);

    elements.adventureOutput = Utils.createElement('div', { id: 'adventure-output' });
    elements.adventureInput = Utils.createElement('input', { id: 'adventure-input', type: 'text', spellcheck: 'false', autocomplete: 'off' });
    elements.adventureInputContainer = Utils.createElement('div', { id: 'adventure-input-container' }, [
      Utils.createElement('span', { textContent: '> ' }),
      elements.adventureInput
    ]);

    // Main container, styled like a modal dialog for consistency
    const adventureContainer = Utils.createElement('div', { id: 'adventure-container', className: 'modal-dialog' }, [
      elements.adventureHeader,
      elements.adventureOutput,
      elements.adventureInputContainer
    ]);

    // Add custom adventure game styles for better presentation
    adventureContainer.style.width = '90%';
    adventureContainer.style.maxWidth = '800px';
    adventureContainer.style.height = '80%';
    adventureContainer.style.display = 'flex';
    adventureContainer.style.flexDirection = 'column';
    elements.adventureOutput.style.flexGrow = '1';
    elements.adventureOutput.style.overflowY = 'auto';
    elements.adventureOutput.style.textAlign = 'left';
    elements.adventureOutput.style.padding = 'var(--spacing-md)';
    elements.adventureOutput.style.border = '1px solid var(--color-border-primary)';
    elements.adventureOutput.style.marginBottom = 'var(--spacing-md)';
    elements.adventureInputContainer.style.display = 'flex';
    elements.adventureInput.style.flexGrow = '1';
    elements.adventureInput.style.background = 'transparent';
    elements.adventureInput.style.border = 'none';
    elements.adventureInput.style.color = 'var(--color-text-primary)';
    elements.adventureInput.style.fontFamily = 'var(--font-family-mono)';
    elements.adventureInput.style.outline = 'none';
    elements.adventureHeader.style.display = 'flex';
    elements.adventureHeader.style.justifyContent = 'space-between';
    elements.adventureHeader.style.alignItems = 'center';
    elements.adventureHeader.style.marginBottom = 'var(--spacing-md)';


    return adventureContainer;
  }


  /**
   * Displays the adventure modal and starts a new game session.
   * @param {Adventure} adventureData - The data for the adventure to be played.
   * @param {object} engineInstance - A reference to the main TextAdventureEngine instance.
   * @param {object|null} scriptingContext - The context for scripted play, if any.
   * @returns {Promise<void>} A promise that resolves when the game session ends (modal is hidden).
   */
  function show(adventureData, engineInstance, scriptingContext) {
    const adventureElement = _buildLayout();

    return new Promise(resolve => {
      sessionCompletionResolver = resolve;
      currentEngineInstance = engineInstance;
      currentScriptingContext = scriptingContext;
      isActive = true;
      elements.adventureTitle.textContent = adventureData.title || "Text Adventure";
      elements.adventureOutput.innerHTML = '';
      elements.adventureInput.value = '';
      elements.adventureInput.disabled = false;

      AppLayerManager.show(adventureElement);

      elements.adventureInput.focus();
      elements.adventureInput.addEventListener('keydown', _handleInputKeydown);
      elements.adventureCloseBtn.addEventListener('click', hide);
    });
  }

  /**
   * Hides the adventure modal and cleans up the session.
   */
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

    AppLayerManager.hide();

    elements.adventureInput.removeEventListener('keydown', _handleInputKeydown);
    elements.adventureCloseBtn.removeEventListener('click', hide);
    if (typeof OutputManager !== 'undefined') {
      void OutputManager.appendToOutput("Exited text adventure.", {
        typeClass: Config.CSS_CLASSES.CONSOLE_LOG_MSG
      });
    }
    elements = {}; // Clear cached elements
  }

  /**
   * Handles the keydown event on the adventure input field.
   * @private
   * @param {KeyboardEvent} event - The keyboard event.
   */
  function _handleInputKeydown(event) {
    if (event.key === 'Enter') {
      event.preventDefault();
      const command = elements.adventureInput.value.trim();
      elements.adventureInput.value = '';

      if (promptResolver) {
        appendOutput(`> ${command}`, 'system');
        const resolver = promptResolver;
        promptResolver = null;
        resolver(command);
      } else if (command && currentEngineInstance) {
        currentEngineInstance.processCommand(command);
      }
    }
  }

  /**
   * Requests a line of input from the user or script.
   * @param {string} promptText - The prompt message to display.
   * @returns {Promise<string|null>} A promise that resolves with the user's input, or null if cancelled or end of script.
   */
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
      elements.adventureInput.focus();
    });
  }

  /**
   * Appends a line of text to the adventure output screen.
   * @param {string} text - The text to display.
   * @param {string} [type='room-desc'] - The CSS class to apply for styling (e.g., 'error', 'info').
   */
  function appendOutput(text, type = 'room-desc') {
    if (!elements.adventureOutput) return;
    const p = Utils.createElement('p', { textContent: text, className: type });
    elements.adventureOutput.appendChild(p);
    elements.adventureOutput.scrollTop = elements.adventureOutput.scrollHeight;
  }

  /**
   * Clears all text from the adventure output screen.
   */
  function clearOutput() {
    if (elements.adventureOutput) elements.adventureOutput.innerHTML = '';
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

/**
 * @module TextAdventureEngine
 * @description The core engine for processing text adventure game logic.
 */
const TextAdventureEngine = (() => {
  "use strict";
  /** @type {Adventure} */
  let adventure;
  /** @type {PlayerState} */
  let player;
  let scriptingContext = null;

  /**
   * Starts a new adventure game.
   * @param {Adventure} adventureData - The adventure data object.
   * @param {object} [options={}] - Options for the game session.
   * @param {object|null} [options.scriptingContext=null] - Context for scripted play.
   * @returns {Promise<void>} A promise that resolves when the adventure session ends.
   */
  function startAdventure(adventureData, options = {}) {
    adventure = JSON.parse(JSON.stringify(adventureData));
    scriptingContext = options.scriptingContext || null;
    player = {
      currentLocation: adventure.startingRoomId,
      inventory: adventure.player?.inventory || [],
    };
    _displayCurrentRoom();
    return TextAdventureModal.show(adventure, {
      processCommand
    }, scriptingContext);
  }

  /**
   * Processes a single command from the player.
   * @param {string} command - The command string entered by the player.
   * @async
   */
  async function processCommand(command) {
    TextAdventureModal.appendOutput(`> ${command}`, 'system');
    const parts = command.toLowerCase().trim().split(/\s+/);
    const action = parts[0];
    const target = parts.slice(1).join(" ");
    if (!action) return;

    switch (action) {
      case 'look':
        _handleLook(target);
        break;
      case 'go':
      case 'move':
        _handleGo(target);
        break;
      case 'take':
      case 'get':
        _handleTake(target);
        break;
      case 'drop':
        _handleDrop(target);
        break;
      case 'inventory':
      case 'i':
        _handleInventory();
        break;
      case 'help':
        _handleHelp();
        break;
      case 'quit':
      case 'exit':
        TextAdventureModal.hide();
        break;
      case 'use':
        _handleUse(target);
        break;
      case 'open':
      case 'close':
        _handleOpen(action, target);
        break;
      case 'save':
        void _handleSave();
        break;
      case 'load':
        void _handleLoad();
        break;
      default:
        TextAdventureModal.appendOutput("I don't understand that command. Try 'help'.", 'error');
    }
    _checkWinConditions();
  }

  /**
   * Handles the 'save' command logic.
   * @private
   * @async
   */
  async function _handleSave() {
    const fileName = await TextAdventureModal.requestInput("Save game as (leave blank to cancel):");
    if (!fileName) {
      TextAdventureModal.appendOutput("Save cancelled.", 'info');
      return;
    }

    const itemStates = {};
    for (const id in adventure.items) {
      itemStates[id] = {
        location: adventure.items[id].location,
        state: adventure.items[id].state
      };
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
        JSON.stringify(saveState, null, 2), {
          currentUser,
          primaryGroup
        }
    );

    if (saveResult.success) {
      await FileSystemManager.save();
      TextAdventureModal.appendOutput(`Game saved to '${fileName}.sav'.`, 'info');
    } else {
      TextAdventureModal.appendOutput(`Error saving game: ${saveResult.error}`, 'error');
    }
  }

  /**
   * Handles the 'load' command logic.
   * @private
   * @async
   */
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
      for (const id in saveData.itemStates) {
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

  /**
   * Displays the description of the current room.
   * @private
   */
  function _displayCurrentRoom() {
    const room = adventure.rooms[player.currentLocation];
    if (!room) {
      TextAdventureModal.appendOutput("Error: You are in an unknown void!", 'error');
      return;
    }
    TextAdventureModal.appendOutput(`\n--- ${room.name} ---`, 'room-name');
    TextAdventureModal.appendOutput(room.description, 'room-desc');
    const roomItems = _getItemsInRoom(player.currentLocation);
    if (roomItems.length > 0) {
      TextAdventureModal.appendOutput("You see here: " + roomItems.map(item => adventure.items[item.id].name).join(", ") + ".", 'items');
    }
    const exitNames = Object.keys(room.exits || {});
    if (exitNames.length > 0) {
      TextAdventureModal.appendOutput("Exits: " + exitNames.join(", ") + ".", 'exits');
    } else {
      TextAdventureModal.appendOutput("There are no obvious exits.", 'exits');
    }
  }

  /**
   * Handles the 'use' command logic.
   * @private
   * @param {string} target - The full argument string for the 'use' command.
   */
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

  /**
   * Handles the 'look' command logic.
   * @private
   * @param {string} target - The item or area to look at.
   */
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

  /**
   * Handles the 'open' and 'close' command logic.
   * @private
   * @param {string} action - The action to perform ('open' or 'close').
   * @param {string} targetName - The name of the item to open/close.
   */
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

  /**
   * Displays the contents of a container item.
   * @private
   * @param {Item} container - The container item to look inside.
   */
  function _lookInContainer(container) {
    const itemsInside = _getItemsInContainer(container.id);
    if (itemsInside.length > 0) {
      const itemNames = itemsInside.map(item => adventure.items[item.id].name);
      TextAdventureModal.appendOutput("Inside you see: " + itemNames.join(", ") + ".", 'items');
    } else {
      TextAdventureModal.appendOutput("It is empty.", 'info');
    }
  }

  /**
   * Gets all items located within a specific container.
   * @private
   * @param {string} containerId - The ID of the container item.
   * @returns {Item[]} An array of items inside the container.
   */
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

  /**
   * Handles the 'go' command logic.
   * @private
   * @param {string} direction - The direction the player wants to move.
   */
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

  /**
   * Handles the 'take' command logic.
   * @private
   * @param {string} itemName - The name of the item to take.
   */
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

  /**
   * Handles the 'drop' command logic.
   * @private
   * @param {string} itemName - The name of the item to drop.
   */
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

  /**
   * Handles the 'inventory' command logic.
   * @private
   */
  function _handleInventory() {
    if (player.inventory.length === 0) {
      TextAdventureModal.appendOutput("You are not carrying anything.", 'info');
    } else {
      const itemNames = player.inventory.map(id => adventure.items[id].name);
      TextAdventureModal.appendOutput("You are carrying: " + itemNames.join(", ") + ".", 'info');
    }
  }

  /**
   * Displays the help text for game commands.
   * @private
   */
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
   * Finds an item by name in a given location or in open containers within that location.
   * @private
   * @param {string} name - The name of the item to find.
   * @param {string | null} locationId - The ID of the location to search in.
   * @returns {Item | null} The found item object or null.
   */
  function _findItemByName(name, locationId = null) {
    for (const id in adventure.items) {
      const item = adventure.items[id];
      if (item.name.toLowerCase() === name.toLowerCase()) {
        if (item.location === locationId) {
          return item;
        }
        const container = adventure.items[item.location];
        if (container && container.location === locationId && container.isContainer && container.state === 'open') {
          return item;
        }
      }
    }
    return null;
  }

  /**
   * Finds an item by name within the player's inventory.
   * @private
   * @param {string} name - The name of the item to find.
   * @returns {Item | null} The found item object or null.
   */
  function _findItemInInventory(name) {
    const itemId = player.inventory.find(id => adventure.items[id].name.toLowerCase() === name.toLowerCase());
    return itemId ? adventure.items[itemId] : null;
  }

  /**
   * Gets all items directly located in a specific room.
   * @private
   * @param {string} roomId - The ID of the room.
   * @returns {Item[]} An array of items in the room.
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

  /**
   * Checks if the win condition for the game has been met.
   * @private
   */
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
  "winCondition": {
    "type": "itemInRoom",
    "itemId": "trophy",
    "roomId": "throne_room"
  },
  "winMessage": "You place the trophy on the throne. You have won the test!",
  "rooms": {
    "hallway": {
      "id": "hallway",
      "name": "Stone Hallway",
      "description": "A dusty hallway. A heavy oak door is to the north.",
      "exits": {
        "north": "oak_door"
      }
    },
    "throne_room": {
      "id": "throne_room",
      "name": "Throne Room",
      "description": "A grand room with a single throne.",
      "exits": {}
    }
  },
  "items": {
    "rusty_key": {
      "id": "rusty_key",
      "name": "rusty key",
      "location": "hallway"
    },
    "oak_door": {
      "id": "oak_door",
      "name": "oak door",
      "location": "hallway",
      "isOpenable": true,
      "state": "locked",
      "unlocksWith": "rusty_key",
      "leadsTo": "throne_room",
      "canTake": false
    },
    "trophy": {
      "id": "trophy",
      "name": "shiny trophy",
      "location": "player"
    }
  }
};