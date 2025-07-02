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
    // Create elements using new CSS classes
    elements.adventureTitle = Utils.createElement('span', { id: 'adventure-title' });
    // Apply standard button classes, plus a specific cancel modifier for thematic consistency
    elements.adventureCloseBtn = Utils.createElement('button', { id: 'adventure-close-btn', className: 'btn btn--cancel', textContent: 'Exit Adventure' });
    elements.adventureHeader = Utils.createElement('div', { id: 'adventure-header' }, [elements.adventureTitle, elements.adventureCloseBtn]);

    elements.adventureOutput = Utils.createElement('div', { id: 'adventure-output' });
    elements.adventureInput = Utils.createElement('input', { id: 'adventure-input', type: 'text', spellcheck: 'false', autocomplete: 'off' });
    elements.adventureInputContainer = Utils.createElement('div', { id: 'adventure-input-container' }, [
      Utils.createElement('span', { textContent: '> ' }),
      elements.adventureInput
    ]);

    // Main container now just needs its ID; all styling is in the CSS.
    const adventureContainer = Utils.createElement('div', { id: 'adventure-container' }, [
      elements.adventureHeader,
      elements.adventureOutput,
      elements.adventureInputContainer
    ]);
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
   * @param {string} [type='room-desc'] - The semantic type of the message, maps to a CSS class.
   */
  function appendOutput(text, type = 'room-desc') {
    if (!elements.adventureOutput) return;
    // The 'type' parameter now directly corresponds to our new BEM-style classes.
    const className = `adv-${type}`;
    const p = Utils.createElement('p', { textContent: text, className: className });
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
  let disambiguationContext = null;

  /**
   * Starts a new adventure game.
   * @param {Adventure} adventureData - The adventure data object.
   * @param {object} [options={}] - Options for the game session.
   */
  function startAdventure(adventureData, options = {}) {
    // ... (existing code for startAdventure)
    adventure = JSON.parse(JSON.stringify(adventureData));
    scriptingContext = options.scriptingContext || null;
    disambiguationContext = null; // Ensure context is cleared on new game start
    player = {
      currentLocation: adventure.startingRoomId,
      inventory: adventure.player?.inventory || [],
    };
    _displayCurrentRoom();
    return TextAdventureModal.show(adventure, { processCommand }, scriptingContext);
  }

  /**
   * Processes a single command from the player.
   * @param {string} command - The command string entered by the player.
   * @async
   */
  async function processCommand(command) {
    TextAdventureModal.appendOutput(`> ${command}`, 'system');
    const commandLower = command.toLowerCase().trim();

    // --- NEW: Handle disambiguation follow-up (Directive 2) ---
    if (disambiguationContext) {
      _handleDisambiguation(commandLower);
      return;
    }

    const words = commandLower.split(/\s+/);
    const verb = _resolveVerb(words[0]); // (Directive 3)

    if (!verb) {
      TextAdventureModal.appendOutput("I don't understand that verb. Try 'help'.", 'error');
      return;
    }

    // --- NEW: Preposition and indirect object parsing (Directive 4) ---
    const directObjectStr = [];
    const indirectObjectStr = [];
    let preposition = null;
    let currentTarget = directObjectStr;

    // A simple preposition list. Could be expanded.
    const prepositions = ["in", "on", "with", "at", "to", "under", "inside"];

    for (let i = 1; i < words.length; i++) {
      if (prepositions.includes(words[i])) {
        preposition = words[i];
        currentTarget = indirectObjectStr;
      } else {
        currentTarget.push(words[i]);
      }
    }

    const directObject = directObjectStr.join(' ');
    const indirectObject = indirectObjectStr.join(' ');

    // --- REFACTORED: Centralized command handler ---
    switch (verb.action) {
      case 'look':    _handleLook(directObject); break;
      case 'go':      _handleGo(directObject); break;
      case 'take':    _handleTake(directObject); break;
      case 'drop':    _handleDrop(directObject); break;
      case 'put':     await _handlePut(directObject, indirectObject); break; // (Directive 4)
        // ... (other cases like inventory, help, save, etc.)
      default:
        TextAdventureModal.appendOutput("That's not a verb I recognize in this context. Try 'help'.", 'error');
    }

    _checkWinConditions();
  }

  // --- NEW: Resolve verb and synonyms (Directive 3) ---
  function _resolveVerb(verbWord) {
    for (const verbKey in adventure.verbs) {
      const verbDef = adventure.verbs[verbKey];
      if (verbKey === verbWord || verbDef.aliases.includes(verbWord)) {
        return verbDef;
      }
    }
    return null;
  }

  // --- REFACTORED: Noun/Adjective parsing logic (Directive 1) ---
  function _findItem(targetString, scope) {
    if (!targetString) return { found: [] };

    const targetWords = new Set(targetString.toLowerCase().split(/\s+/));
    const potentialItems = [];

    for (const item of scope) {
      const itemAdjectives = new Set(item.adjectives?.map(a => a.toLowerCase()));
      const itemNoun = item.noun.toLowerCase();

      let score = 0;
      if (targetWords.has(itemNoun)) {
        score += 10; // High score for matching the noun
        targetWords.forEach(word => {
          if (itemAdjectives.has(word)) {
            score += 1; // Bonus for each matching adjective
          }
        });
      }

      if (score > 0) {
        potentialItems.push({ item, score });
      }
    }

    if (potentialItems.length === 0) return { found: [] };

    // Return all items that have the highest score
    potentialItems.sort((a, b) => b.score - a.score);
    const topScore = potentialItems[0].score;
    return { found: potentialItems.filter(p => p.score === topScore).map(p => p.item) };
  }

  // --- NEW: Disambiguation Handler (Directive 2) ---
  function _handleDisambiguation(response) {
    const { found, context } = disambiguationContext;
    const result = _findItem(response, found); // Find from the ambiguous list

    if (result.found.length === 1) {
      const selectedItem = result.found[0];
      disambiguationContext = null; // Clear context
      // Re-run original command with the now-unambiguous item
      context.callback(selectedItem);
    } else {
      TextAdventureModal.appendOutput("That's still not specific enough. Please try again.", 'info');
      // We could also list the options again here.
    }
  }

  // Example of a refactored action handler
  function _handleTake(target) {
    const scope = _getItemsInRoom(player.currentLocation);
    const result = _findItem(target, scope);

    if (result.found.length === 0) {
      TextAdventureModal.appendOutput(`I don't see a "${target}" here.`, 'error');
      return;
    }

    if (result.found.length > 1) {
      disambiguationContext = {
        found: result.found,
        context: { verb: 'take', callback: (item) => _performTake(item) }
      };
      const itemNames = result.found.map(item => item.name).join(' or the ');
      TextAdventureModal.appendOutput(`Which do you mean, the ${itemNames}?`, 'info');
      return;
    }

    _performTake(result.found[0]);
  }

  function _performTake(item) {
    // ... (actual logic for taking the item)
    player.inventory.push(item.id);
    item.location = 'player';
    TextAdventureModal.appendOutput(`You take the ${item.name}.`, 'info');
  }

  // --- NEW: Handler for complex commands (Directive 4) ---
  async function _handlePut(directObjectStr, indirectObjectStr) {
    if (!directObjectStr || !indirectObjectStr) {
      TextAdventureModal.appendOutput("What do you want to put, and where?", 'error');
      return;
    }

    const directObjectResult = _findItem(directObjectStr, player.inventory.map(id => adventure.items[id]));
    if (directObjectResult.found.length !== 1) {
      TextAdventureModal.appendOutput(`You don't have a "${directObjectStr}".`, 'error');
      return;
    }

    const indirectObjectScope = _getItemsInRoom(player.currentLocation);
    const indirectObjectResult = _findItem(indirectObjectStr, indirectObjectScope);
    if (indirectObjectResult.found.length !== 1) {
      TextAdventureModal.appendOutput(`You don't see a "${indirectObjectStr}" here.`, 'error');
      return;
    }

    const directObject = directObjectResult.found[0];
    const indirectObject = indirectObjectResult.found[0];

    // Example logic
    if (!indirectObject.isContainer) {
      TextAdventureModal.appendOutput(`You can't put things in the ${indirectObject.name}.`, 'info');
      return;
    }

    if (indirectObject.state !== 'open') {
      TextAdventureModal.appendOutput(`The ${indirectObject.name} is closed.`, 'info');
      return;
    }

    // Move the item
    directObject.location = indirectObject.id;
    player.inventory = player.inventory.filter(id => id !== directObject.id);
    TextAdventureModal.appendOutput(`You put the ${directObject.name} in the ${indirectObject.name}.`, 'info');
  }

  // This is a placeholder for the original _displayCurrentRoom function,
  // which would need to be updated to use the new item properties.
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

  // Placeholder for _handleGo
  function _handleGo(direction) {
    const room = adventure.rooms[player.currentLocation];
    if (room.exits && room.exits[direction]) {
      const nextRoomId = room.exits[direction];
      if (adventure.rooms[nextRoomId]) {
        player.currentLocation = nextRoomId;
        _displayCurrentRoom();
      } else if (adventure.items[nextRoomId]) { // It's an item like a door
        const door = adventure.items[nextRoomId];
        if (door.state === 'open' && door.leadsTo) {
          player.currentLocation = door.leadsTo;
          _displayCurrentRoom();
        } else if (door.state === 'locked') {
          TextAdventureModal.appendOutput(door.lockedMessage || `The ${door.name} is locked.`, 'error');
        } else {
          TextAdventureModal.appendOutput(`The ${door.name} is closed.`, 'info');
        }
      } else {
        TextAdventureModal.appendOutput(`You can't go that way.`, 'error');
      }
    } else {
      TextAdventureModal.appendOutput(`You can't go that way.`, 'error');
    }
  }

  // Placeholder for _handleLook
  function _handleLook(target) {
    if (!target) {
      _displayCurrentRoom();
      return;
    }
    const scope = [..._getItemsInRoom(player.currentLocation), ...player.inventory.map(id => adventure.items[id])];
    const result = _findItem(target, scope);
    if (result.found.length > 0) {
      TextAdventureModal.appendOutput(result.found[0].description, 'info');
    } else {
      TextAdventureModal.appendOutput(`You don't see any "${target}" here.`, 'error');
    }
  }

  // Placeholder for _handleDrop
  function _handleDrop(target) {
    const result = _findItem(target, player.inventory.map(id => adventure.items[id]));
    if (result.found.length === 1) {
      const item = result.found[0];
      item.location = player.currentLocation;
      player.inventory = player.inventory.filter(id => id !== item.id);
      TextAdventureModal.appendOutput(`You drop the ${item.name}.`, 'info');
    } else {
      TextAdventureModal.appendOutput(`You don't have a "${target}".`, 'error');
    }
  }

  // This would need to be implemented fully
  function _checkWinConditions() {
    //...
  }

  function _getItemsInRoom(roomId) {
    const items = [];
    for (const id in adventure.items) {
      if (adventure.items[id].location === roomId) {
        items.push(adventure.items[id]);
      }
    }
    return items;
  }


  return {
    startAdventure,
    processCommand,
  };
})();

// Define the global sampleAdventure object
window.sampleAdventure = {
  "title": "The Test Chamber",
  "verbs": {
    "go": { "action": "go", "aliases": ["move", "walk", "run"] },
    "take": { "action": "take", "aliases": ["get", "grab"] },
    "look": { "action": "look", "aliases": ["examine", "x", "l"] },
    "inventory": { "action": "inventory", "aliases": ["i", "inv"] },
    "put": { "action": "put", "aliases": ["place", "drop"] }
  },
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
      "description": "A dusty hallway. A heavy oak door is to the north. A rusty key is on the floor.",
      "exits": {
        "north": "oak_door"
      }
    },
    "throne_room": {
      "id": "throne_room",
      "name": "Throne Room",
      "description": "A grand room with a single, ornate throne. A large chest sits in the corner.",
      "exits": {}
    }
  },
  "items": {
    "rusty_key": {
      "id": "rusty_key",
      "name": "rusty key",
      "noun": "key",
      "adjectives": ["rusty", "old", "small"],
      "description": "It's an old, rusty key.",
      "location": "hallway"
    },
    "oak_door": {
      "id": "oak_door",
      "name": "oak door",
      "noun": "door",
      "adjectives": ["oak", "heavy", "large", "wooden"],
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
      "noun": "trophy",
      "adjectives": ["shiny", "golden"],
      "description": "A brilliant, shiny golden trophy.",
      "location": "player"
    },
    "chest": {
      "id": "chest",
      "name": "large chest",
      "noun": "chest",
      "adjectives": ["large", "wooden"],
      "description": "A large wooden chest. It looks unlocked.",
      "location": "throne_room",
      "isContainer": true,
      "isOpenable": true,
      "state": "closed",
      "canTake": false
    }
  }
};