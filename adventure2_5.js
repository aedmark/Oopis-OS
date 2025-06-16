// adventure.js - OopisOS Adventure Engine and Editor v2.5

const TextAdventureModal = (() => {
  "use strict";
  let adventureModal, adventureContainer, adventureTitle, adventureOutput, adventureInput, adventureCloseBtn;
  let isActive = false;
  let currentAdventureData = null;
  let currentEngineInstance = null;

  function _initDOM() {
    adventureModal = document.getElementById('adventure-modal');
    adventureContainer = document.getElementById('adventure-container');
    adventureTitle = document.getElementById('adventure-title');
    adventureOutput = document.getElementById('adventure-output');
    adventureInput = document.getElementById('adventure-input');
    adventureCloseBtn = document.getElementById('adventure-close-btn');
    if(!adventureModal || !adventureInput || !adventureCloseBtn || !adventureOutput) {
      console.error("TextAdventureModal: Critical UI elements not found in DOM!");
      if(adventureModal && !adventureContainer) {
        adventureModal.innerHTML = `
                    <div id="adventure-container" style="width: 700px; height: 500px; background: #0A0A0A; border: 1px solid #0F0; display: flex; flex-direction: column; padding: 10px; font-family: 'VT323', monospace; color: #0F0;">
                        <div id="adventure-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 5px;">
                            <span id="adventure-title" style="font-size: 1.2em;">Text Adventure</span>
                            <button id="adventure-close-btn" style="background: #333; color: #0F0; border: 1px solid #0F0; padding: 2px 5px; cursor: pointer;">Exit</button>
                        </div>
                        <div id="adventure-output" style="flex-grow: 1; overflow-y: auto; margin-bottom: 10px; white-space: pre-wrap;"></div>
                        <div id="adventure-input-container" style="display: flex;"><span style="margin-right: 5px;">&gt;</span><input type="text" id="adventure-input" style="flex-grow: 1; background: transparent; border: none; color: #0F0; font-family: 'VT323', monospace; outline: none;"></div>
                    </div>`;
        _initDOM();
      }
      return false;
    }
    return true;
  }

  function show(adventureData, engineInstance) {
    if(!_initDOM()) {
      if(typeof OutputManager !== 'undefined' && typeof OutputManager.appendToOutput === 'function' && typeof Config !== 'undefined' && Config.CSS_CLASSES) {
        void OutputManager.appendToOutput("Error: Text Adventure UI could not be initialized.", {
          typeClass: Config.CSS_CLASSES.ERROR_MSG
        });
      } else {
        console.error("Critical Error: Text Adventure UI could not be initialized, and OutputManager/Config are not available for error reporting.");
      }
      return;
    }
    currentAdventureData = adventureData;
    currentEngineInstance = engineInstance;
    isActive = true;
    if(adventureTitle && currentAdventureData && currentAdventureData.title) {
      adventureTitle.textContent = currentAdventureData.title;
    }
    adventureOutput.innerHTML = '';
    adventureInput.value = '';
    adventureInput.disabled = false;
    adventureModal.classList.remove('hidden');
    if(typeof OutputManager !== 'undefined' && typeof OutputManager.setEditorActive === 'function') {
      OutputManager.setEditorActive(true);
    } else {
      console.warn("TextAdventureModal: OutputManager not available to set editor active state.");
    }
    if(typeof TerminalUI !== 'undefined' && typeof TerminalUI.setInputState === 'function') {
      TerminalUI.setInputState(false);
    } else {
      console.warn("TextAdventureModal: TerminalUI not available to set input state.");
    }
    adventureInput.focus();
    adventureInput.addEventListener('keydown', _handleInputKeydown);
    adventureCloseBtn.addEventListener('click', hide);
  }

  function hide() {
    if(!_initDOM() || !isActive) return;
    isActive = false;
    currentAdventureData = null;
    currentEngineInstance = null;
    adventureModal.classList.add('hidden');
    if(typeof OutputManager !== 'undefined' && typeof OutputManager.setEditorActive === 'function') {
      OutputManager.setEditorActive(false);
    }
    if(typeof TerminalUI !== 'undefined' && typeof TerminalUI.setInputState === 'function') {
      TerminalUI.setInputState(true);
      TerminalUI.focusInput();
    }
    adventureInput.removeEventListener('keydown', _handleInputKeydown);
    adventureCloseBtn.removeEventListener('click', hide);
    if(typeof OutputManager !== 'undefined' && typeof OutputManager.appendToOutput === 'function' && typeof Config !== 'undefined' && Config.CSS_CLASSES) {
      void OutputManager.appendToOutput("Exited text adventure.", {
        typeClass: Config.CSS_CLASSES.CONSOLE_LOG_MSG
      });
    }
  }

  function _handleInputKeydown(event) {
    if(event.key === 'Enter') {
      event.preventDefault();
      const command = adventureInput.value.trim();
      adventureInput.value = '';
      if(command && currentEngineInstance) {
        currentEngineInstance.processCommand(command);
      }
    }
  }

  function appendOutput(text, type = 'room-desc') {
    if(!adventureOutput && !_initDOM()) return;
    if(adventureOutput) {
      const p = document.createElement('p');
      p.textContent = text;
      if(type) {
        p.className = type;
      }
      adventureOutput.appendChild(p);
      adventureOutput.scrollTop = adventureOutput.scrollHeight;
    }
  }
  return {
    show,
    hide,
    appendOutput,
    isActive: () => isActive,
  };
})();
const TextAdventureEngine = (() => {
  "use strict";
  let adventure;
  let player;
  let adventureInputRef;

  function startAdventure(adventureData) {
    adventure = JSON.parse(JSON.stringify(adventureData));
    player = {
      currentLocation: adventure.startingRoomId,
      inventory: adventure.player ?.inventory || [],
    };
    const advInput = document.getElementById('adventure-input');
    if(advInput) {
      adventureInputRef = advInput;
    } else {
      console.warn("TextAdventureEngine: Could not get reference to adventure input field.");
      adventureInputRef = null;
    }
    TextAdventureModal.show(adventure, {
      processCommand
    });
    _displayCurrentRoom();
  }

  function processCommand(command) {
    TextAdventureModal.appendOutput(`> ${command}`, 'system');
    const parts = command.toLowerCase().trim().split(/\s+/);
    const action = parts[0];
    const target = parts.slice(1).join(" ");
    if(!action) return;
    switch(action) {
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
        void _handleSave(); // Using void as it's an async function we're not awaiting here
        break;
      case 'load':
        void _handleLoad(); // Using void as it's an async function we're not awaiting here
        break;
      default:
        TextAdventureModal.appendOutput("I don't understand that command. Try 'help'.", 'error');
    }
    _checkWinConditions();
  }

  async function _requestAdventureInput(promptText) {
    TextAdventureModal.appendOutput(promptText, 'system');
    adventureInput.removeEventListener('keydown', _handleInputKeydown);

    return new Promise(resolve => {
      const handlePromptInput = (event) => {
        if (event.key === 'Enter') {
          event.preventDefault();
          const value = adventureInput.value.trim();
          adventureInput.value = '';
          adventureInput.removeEventListener('keydown', handlePromptInput);
          adventureInput.addEventListener('keydown', _handleInputKeydown);
          resolve(value);
        }
      };
      adventureInput.addEventListener('keydown', handlePromptInput);
      adventureInput.focus();
    });
  }

  async function _handleSave() {
    const fileName = await _requestAdventureInput("Save game as (leave blank to cancel):");
    TextAdventureModal.appendOutput(`> ${fileName}`, 'system'); // <-- ADD THIS LINE
    if (!fileName) {
      TextAdventureModal.appendOutput("Save cancelled.", 'info');
      return;
    }

    // 1. Gather the current state
    const itemStates = {};
    for (const id in adventure.items) {
      const item = adventure.items[id];
      itemStates[id] = {
        location: item.location,
        state: item.state
      };
    }

    const saveState = {
      adventureFile: adventure.title, // Reference to the original game file
      timestamp: new Date().toISOString(),
      player: player, // The whole player object (location, inventory)
      itemStates: itemStates
    };

    // 2. Save the state to a file in OopisOS
    const currentUser = UserManager.getCurrentUser().name;
    const primaryGroup = UserManager.getPrimaryGroupForUser(currentUser);
    const savePath = `/home/${currentUser}/${fileName}.sav`;

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
    const fileName = await _requestAdventureInput("Load which save game? (leave blank to cancel):");
    TextAdventureModal.appendOutput(`> ${fileName}`, 'system'); // <-- ADD THIS LINE
    if (!fileName) {
      TextAdventureModal.appendOutput("Load cancelled.", 'info');
      return;
    }

    const currentUser = UserManager.getCurrentUser().name;
    const savePath = `/home/${currentUser}/${fileName}.sav`;
    const pathInfo = FileSystemManager.validatePath("load", savePath);

    if (pathInfo.error) {
      TextAdventureModal.appendOutput(`Could not find save game '${fileName}.sav'.`, 'error');
      return;
    }

    try {
      const saveData = JSON.parse(pathInfo.node.content);

      // Restore player state
      player = saveData.player;

      // Restore item states
      for(const id in saveData.itemStates) {
        if (adventure.items[id]) {
          adventure.items[id].location = saveData.itemStates[id].location;
          if(saveData.itemStates[id].state) {
            adventure.items[id].state = saveData.itemStates[id].state;
          }
        }
      }

      adventureOutput.innerHTML = ''; // Clear the screen
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

    // Scenario 1: Using an item on a target in the room (e.g., "use key on door")
    if (targetName) {
      const targetItem = _findItemByName(targetName, player.currentLocation);
      if (!targetItem) {
        TextAdventureModal.appendOutput(`You don't see a "${targetName}" here.`, 'error');
        return;
      }

      // Check if the item being used is the correct one for the target
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
      // Scenario 2: Just "use item" (we can expand this later)
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
      let descriptionToDisplay = `You see a ${item.name}.`; // A generic fallback

      // New state-based description logic
      if (item.descriptions) {
        if (item.state && item.descriptions[item.state]) {
          // 1. Use the description for the current state (e.g., "open", "locked")
          descriptionToDisplay = item.descriptions[item.state];
        } else if (item.descriptions.default) {
          // 2. Fallback to the default description
          descriptionToDisplay = item.descriptions.default;
        }
      } else if (item.description) {
        // 3. Fallback to the old single description property for backward compatibility
        descriptionToDisplay = item.description;
      }

      TextAdventureModal.appendOutput(descriptionToDisplay, 'info');

      // If looking at an open container, also show its contents (this logic remains)
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

    // Handle locked items
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
        // If it's a container, describe what's inside
        if (targetItem.isContainer) {
          _lookInContainer(targetItem);
        }
      }
    } else { // action is 'close'
      if (targetItem.state === 'closed') {
        TextAdventureModal.appendOutput(`The ${targetItem.name} is already closed.`, 'info');
      } else {
        targetItem.state = 'closed';
        TextAdventureModal.appendOutput(`You close the ${targetItem.name}.`, 'info');
      }
    }
  }

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
      const exitObject = adventure.items[exitId]; // Check if the exit is an item (like a door)

      // If the exit is a stateful item (like a door)
      if (exitObject && exitObject.state) {
        if (exitObject.state === 'locked') {
          TextAdventureModal.appendOutput(exitObject.lockedMessage || `The ${exitObject.name} is locked.`, 'error');
          return;
        }
        // If it's a door, the actual destination is in the item's properties
        if (exitObject.leadsTo && adventure.rooms[exitObject.leadsTo]) {
          player.currentLocation = exitObject.leadsTo;
          _displayCurrentRoom();
        } else {
          TextAdventureModal.appendOutput(`Error: The ${exitObject.name} leads to an undefined area!`, 'error');
        }
      } else { // It's a simple direction exit
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
    if(item) {
      if(item.canTake !== false) {
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
    if(item) {
      player.inventory = player.inventory.filter(id => id !== item.id);
      item.location = player.currentLocation;
      TextAdventureModal.appendOutput(`You drop the ${item.name}.`, 'info');
    } else {
      TextAdventureModal.appendOutput(`You don't have a "${itemName}" to drop.`, 'error');
    }
  }

  function _handleInventory() {
    if(player.inventory.length === 0) {
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

  function _findItemByName(name, locationId = null) {
    for (const id in adventure.items) {
      const item = adventure.items[id];
      if (item.name.toLowerCase() === name.toLowerCase()) {
        // Case 1: Item is in the specified room directly
        if (item.location === locationId) {
          return item;
        }
        // Case 2: Item is inside a container which is in the specified room
        const container = adventure.items[item.location];
        if (container && container.location === locationId && container.isContainer && container.state === 'open') {
          return item;
        }
      }
    }
    return null;
  }

  function _findItemInInventory(name) {
    const itemId = player.inventory.find(id => adventure.items[id].name.toLowerCase() === name.toLowerCase());
    return itemId ? adventure.items[itemId] : null;
  }

  function _getItemsInRoom(roomId) {
    const itemsInRoom = [];
    for(const id in adventure.items) {
      if(adventure.items[id].location === roomId) {
        itemsInRoom.push(adventure.items[id]);
      }
    }
    return itemsInRoom;
  }

  function _checkWinConditions() {
    const winCondition = adventure.winCondition;
    if(!winCondition) return;
    let won = false;
    if(winCondition.type === "itemInRoom" && adventure.items[winCondition.itemId] ?.location === winCondition.roomId) {
      won = true;
    } else if(winCondition.type === "playerHasItem" && player.inventory.includes(winCondition.itemId)) {
      won = true;
    }
    if(won) {
      TextAdventureModal.appendOutput(adventure.winMessage || "\n*** Congratulations! You have won! ***", 'system');
      if(adventureInputRef) {
        adventureInputRef.disabled = true;
      }
    }
  }

  return {
    startAdventure,
    processCommand,
  };
})();