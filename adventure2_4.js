// adventure.js - OopisOS Adventure Engine and Editor v2.4
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
      default:
        TextAdventureModal.appendOutput("I don't understand that command. Try 'help'.", 'error');
    }
    _checkWinConditions();
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

  function _handleLook(target) {
    if(!target || target === 'room' || target === 'around') {
      _displayCurrentRoom();
    } else {
      const item = _findItemByName(target, player.currentLocation) || _findItemInInventory(target);
      if(item) {
        TextAdventureModal.appendOutput(item.description, 'info');
      } else {
        TextAdventureModal.appendOutput(`You don't see any "${target}" here.`, 'error');
      }
    }
  }

  function _handleGo(direction) {
    const room = adventure.rooms[player.currentLocation];
    if(room.exits && room.exits[direction]) {
      const nextRoomId = room.exits[direction];
      if(adventure.rooms[nextRoomId]) {
        player.currentLocation = nextRoomId;
        _displayCurrentRoom();
      } else {
        TextAdventureModal.appendOutput(`Error: The path to ${direction} leads to an undefined area!`, 'error');
      }
    } else {
      TextAdventureModal.appendOutput(`You can't go ${direction}.`, 'error');
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
    TextAdventureModal.appendOutput("  inventory (i) - Shows what you are carrying.", 'system');
    TextAdventureModal.appendOutput("  help          - Shows this help message.", 'system');
    TextAdventureModal.appendOutput("  quit / exit   - Exits the adventure.", 'system');
  }

  function _findItemByName(name, locationId = null) {
    for(const id in adventure.items) {
      const item = adventure.items[id];
      if(item.name.toLowerCase() === name.toLowerCase()) {
        if(locationId === null || item.location === locationId) {
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