/**
 * @file Manages the text adventure game engine and its associated user interface modal.
 * @module TextAdventure
 * @author Andrew Edmark & Gemini
 * @author The Architect (UI Module Design)
 */

/**
 * @module TextAdventureModal
 * @description Manages all UI components and user interaction for the text adventure game.
 */
const TextAdventureModal = (() => {
  "use strict";

  let state = {
    isModalOpen: false,
    isActive: false,
    inputCallback: null,
    exitPromiseResolve: null
  };

  let elements = {};

  function _createLayout(adventureData) {
    const title = Utils.createElement('span', { id: 'adventure-title', textContent: adventureData.title });
    const closeBtn = Utils.createElement('button', { id: 'adventure-close-btn', className: 'btn btn--cancel', textContent: 'Exit', eventListeners: { click: hide } });
    const header = Utils.createElement('header', { id: 'adventure-header' }, title, closeBtn);
    const output = Utils.createElement('div', { id: 'adventure-output' });
    const inputPrompt = Utils.createElement('span', { id: 'adventure-prompt', textContent: '>' });
    const input = Utils.createElement('input', { id: 'adventure-input', type: 'text', spellcheck: 'false', autocapitalize: 'none' });
    const inputContainer = Utils.createElement('div', { id: 'adventure-input-container' }, inputPrompt, input);
    const container = Utils.createElement('div', { id: 'adventure-container' }, header, output, inputContainer);

    elements = { container, header, output, input };
    return container;
  }

  function _handleInput(e) {
    if (e.key !== 'Enter' || !state.inputCallback) return;
    const command = elements.input.value;
    elements.input.value = '';
    appendOutput(`> ${command}`, 'system');
    state.inputCallback(command);
  }

  function _setupEventListeners() {
    elements.input.addEventListener('keydown', _handleInput);
    document.addEventListener('keydown', _handleGlobalKeys);
  }

  function _removeEventListeners() {
    if (elements.input) {
      elements.input.removeEventListener('keydown', _handleInput);
    }
    document.removeEventListener('keydown', _handleGlobalKeys);
  }

  function _handleGlobalKeys(e) {
    if (e.key === 'Escape' && state.isModalOpen) {
      hide();
    }
  }

  function show(adventureData, callbacks, scriptingContext) {
    if (state.isModalOpen) return Promise.resolve();

    const layout = _createLayout(adventureData);
    AppLayerManager.show(layout);

    state.isModalOpen = true;
    state.isActive = true;
    state.inputCallback = callbacks.processCommand;

    _setupEventListeners();
    elements.input.focus();

    if (scriptingContext && scriptingContext.isScripting) {
      elements.input.style.display = 'none';
    }

    return new Promise(resolve => {
      state.exitPromiseResolve = resolve;
    });
  }

  function hide() {
    if (!state.isModalOpen) return;
    _removeEventListeners();
    AppLayerManager.hide();
    const resolver = state.exitPromiseResolve;
    state = { isModalOpen: false, isActive: false, inputCallback: null, exitPromiseResolve: null };
    elements = {};

    if (resolver) {
      resolver();
    }
  }

  function appendOutput(text, styleClass = '') {
    if (!elements.output) return;
    const p = Utils.createElement('p', { textContent: text });
    if (styleClass) {
      p.className = `adv-${styleClass}`;
    }
    elements.output.appendChild(p);
    elements.output.scrollTop = elements.output.scrollHeight;
  }

  function requestInput(promptMessage) {
    return new Promise(resolve => {
      const scriptContext = TextAdventureEngine.getScriptingContext();
      if (scriptContext && scriptContext.isScripting) {
        while (scriptContext.currentLineIndex < scriptContext.lines.length - 1) {
          scriptContext.currentLineIndex++;
          const line = scriptContext.lines[scriptContext.currentLineIndex]?.trim();
          if (line && !line.startsWith('#')) {
            appendOutput(`> ${line}`, 'system');
            resolve(line);
            return;
          }
        }
        resolve(null); // End of script
      }
    });
  }

  return {
    show,
    hide,
    appendOutput,
    requestInput,
    isActive: () => state.isActive
  };
})();

/**
 * @module TextAdventureEngine
 * @description The core engine for processing text adventure game logic.
 */
const TextAdventureEngine = (() => {
  "use strict";
  let adventure;
  let player;
  let scriptingContext = null;
  let disambiguationContext = null;

  const defaultVerbs = {
    look: { action: 'look', aliases: ['l', 'examine', 'x'] },
    go: { action: 'go', aliases: ['north', 'south', 'east', 'west', 'up', 'down', 'n', 's', 'e', 'w', 'u', 'd', 'enter', 'exit'] },
    take: { action: 'take', aliases: ['get', 'grab', 'pick up'] },
    drop: { action: 'drop', aliases: [] },
    use: { action: 'use', aliases: [] },
    inventory: { action: 'inventory', aliases: ['i', 'inv'] },
    help: { action: 'help', aliases: ['?'] },
    quit: { action: 'quit', aliases: [] },
    save: { action: 'save', aliases: [] },
    load: { action: 'load', aliases: [] },
    dance: { action: 'dance', aliases: [] },
    sing: { action: 'sing', aliases: [] },
    jump: { action: 'jump', aliases: [] }
  };

  function getScriptingContext() {
    return scriptingContext;
  }

  function startAdventure(adventureData, options = {}) {
    adventure = JSON.parse(JSON.stringify(adventureData));
    adventure.verbs = { ...defaultVerbs, ...adventure.verbs };
    scriptingContext = options.scriptingContext || null;
    disambiguationContext = null;
    player = {
      currentLocation: adventure.startingRoomId,
      inventory: adventure.player?.inventory || [],
    };

    const gamePromise = TextAdventureModal.show(adventure, { processCommand }, scriptingContext);
    _displayCurrentRoom();
    return gamePromise;
  }

  function _getItemsInLocation(locationId) {
    const items = [];
    for (const id in adventure.items) {
      if (adventure.items[id].location === locationId) {
        items.push(adventure.items[id]);
      }
    }
    return items;
  }

  function _displayCurrentRoom() {
    const room = adventure.rooms[player.currentLocation];
    if (!room) {
      TextAdventureModal.appendOutput("Error: You have fallen into the void. The game cannot continue.", 'error');
      return;
    }

    TextAdventureModal.appendOutput(`\n--- ${room.name} ---`, 'room-name');
    TextAdventureModal.appendOutput(room.description, 'room-desc');

    const roomItems = _getItemsInLocation(player.currentLocation);
    if (roomItems.length > 0) {
      TextAdventureModal.appendOutput("You see here: " + roomItems.map(item => item.name).join(", ") + ".", 'items');
    }

    const exitNames = Object.keys(room.exits || {});
    if (exitNames.length > 0) {
      TextAdventureModal.appendOutput("Exits: " + exitNames.join(", ") + ".", 'exits');
    } else {
      TextAdventureModal.appendOutput("There are no obvious exits.", 'exits');
    }
  }

  function _parseCommand(command) {
    const words = command.toLowerCase().trim().split(/\s+/).filter(Boolean);
    if (words.length === 0) return { verb: null, directObject: null, indirectObject: null };

    let verb = null;
    let verbWordCount = 0;
    for (let i = Math.min(words.length, 3); i > 0; i--) {
      const potentialVerbPhrase = words.slice(0, i).join(' ');
      const resolvedVerb = _resolveVerb(potentialVerbPhrase);
      if (resolvedVerb) {
        verb = resolvedVerb;
        verbWordCount = i;
        break;
      }
    }

    if (!verb && words.length === 1) {
      const potentialGoVerb = _resolveVerb(words[0]);
      if (potentialGoVerb && potentialGoVerb.action === 'go') {
        verb = potentialGoVerb;
        return { verb, directObject: words[0], indirectObject: null };
      }
    }

    if (!verb) {
      return { verb: null, directObject: null, indirectObject: null };
    }

    const remainingWords = words.slice(verbWordCount);
    const prepositions = ['on', 'in', 'at', 'with', 'using', 'to', 'under'];
    let directObject = '';
    let indirectObject = null;
    let prepositionIndex = -1;
    for (const prep of prepositions) {
      const index = remainingWords.indexOf(prep);
      if (index !== -1) {
        prepositionIndex = index;
        break;
      }
    }

    const articles = new Set(['a', 'an', 'the']);
    if (prepositionIndex !== -1) {
      directObject = remainingWords.slice(0, prepositionIndex).filter(w => !articles.has(w)).join(' ');
      indirectObject = remainingWords.slice(prepositionIndex + 1).filter(w => !articles.has(w)).join(' ');
    } else {
      directObject = remainingWords.filter(w => !articles.has(w)).join(' ');
    }

    return { verb, directObject, indirectObject };
  }


  async function processCommand(command) {
    if (!command) return;
    const commandLower = command.toLowerCase().trim();

    if (disambiguationContext) {
      _handleDisambiguation(commandLower);
      return;
    }

    const { verb, directObject, indirectObject } = _parseCommand(command);

    if (!verb) {
      TextAdventureModal.appendOutput("I don't understand that verb. Try 'help'.", 'error');
      return;
    }

    switch (verb.action) {
      case 'look':      _handleLook(directObject); break;
      case 'go':        _handleGo(directObject); break;
      case 'take':      _handleTake(directObject); break;
      case 'drop':      _handleDrop(directObject); break;
      case 'use':       _handleUse(directObject, indirectObject); break;
      case 'inventory': _handleInventory(); break;
      case 'help':      _handleHelp(); break;
      case 'quit':      TextAdventureModal.hide(); break;
      case 'save':      await _handleSave(directObject); break;
      case 'load':      await _handleLoad(directObject); break;
      case 'dance':     TextAdventureModal.appendOutput("You do a little jig. You feel refreshed.", 'system'); break;
      case 'sing':      TextAdventureModal.appendOutput("You belt out a sea shanty. A nearby bird looks annoyed.", 'system'); break;
      case 'jump':      TextAdventureModal.appendOutput("You jump on the spot. Whee!", 'system'); break;
      default:
        TextAdventureModal.appendOutput(`I don't know how to "${verb.action}".`, 'error');
    }

    _checkWinConditions();
  }

  async function _handleSave(filename) {
    if (!filename) {
      TextAdventureModal.appendOutput("You need to specify a filename to save to. (e.g., save mygame.json)", 'error');
      return;
    }

    const saveState = {
      saveVersion: "1.0",
      playerState: JSON.parse(JSON.stringify(player)),
      itemsState: JSON.parse(JSON.stringify(adventure.items))
    };

    const jsonContent = JSON.stringify(saveState, null, 2);
    const currentUser = UserManager.getCurrentUser().name;
    const primaryGroup = UserManager.getPrimaryGroupForUser(currentUser);

    if (!primaryGroup) {
      TextAdventureModal.appendOutput("Critical Error: Cannot determine primary group for user. Save failed.", 'error');
      return;
    }

    const absPath = FileSystemManager.getAbsolutePath(filename);
    const saveResult = await FileSystemManager.createOrUpdateFile(
        absPath,
        jsonContent,
        { currentUser, primaryGroup }
    );

    if (!saveResult.success) {
      TextAdventureModal.appendOutput(`Error saving game: ${saveResult.error}`, 'error');
      return;
    }

    if (!(await FileSystemManager.save())) {
      TextAdventureModal.appendOutput("Critical Error: Failed to persist file system changes.", 'error');
      return;
    }

    TextAdventureModal.appendOutput(`Game saved successfully to '${filename}'.`, 'system');
  }

  async function _handleLoad(filename) {
    if (!filename) {
      TextAdventureModal.appendOutput("You need to specify a filename to load from. (e.g., load mygame.json)", 'error');
      return;
    }

    const currentUser = UserManager.getCurrentUser().name;
    const pathInfo = FileSystemManager.validatePath("adventure_load", filename, { expectedType: 'file' });

    if (pathInfo.error) {
      TextAdventureModal.appendOutput(`Error: ${pathInfo.error}`, 'error');
      return;
    }

    if (!FileSystemManager.hasPermission(pathInfo.node, currentUser, "read")) {
      TextAdventureModal.appendOutput(`Cannot read file '${filename}': Permission denied.`, 'error');
      return;
    }

    try {
      const saveData = JSON.parse(pathInfo.node.content);
      if (!saveData.playerState || !saveData.itemsState) {
        throw new Error("Invalid save file format.");
      }

      player = JSON.parse(JSON.stringify(saveData.playerState));
      adventure.items = JSON.parse(JSON.stringify(saveData.itemsState));

      TextAdventureModal.appendOutput(`Game loaded successfully from '${filename}'.\n`, 'system');
      _displayCurrentRoom();

    } catch (e) {
      TextAdventureModal.appendOutput(`Error loading game: ${e.message}`, 'error');
    }
  }

  function _handleUse(directObjectStr, indirectObjectStr) {
    if (!directObjectStr || !indirectObjectStr) {
      TextAdventureModal.appendOutput("What do you want to use on what?", 'error');
      return;
    }
    // This is a stub for future implementation. The parser is ready for it.
    TextAdventureModal.appendOutput(`(Pretending to use ${directObjectStr} on ${indirectObjectStr})`, 'system');
  }

  function _resolveVerb(verbWord) {
    if (!verbWord) return null;
    for (const verbKey in adventure.verbs) {
      const verbDef = adventure.verbs[verbKey];
      if (verbKey === verbWord || verbDef.aliases?.includes(verbWord)) {
        return verbDef;
      }
    }
    return null;
  }

  function _findItem(targetString, scope) {
    if (!targetString) return { found: [] };
    const targetWords = new Set(targetString.toLowerCase().split(/\s+/).filter(Boolean));
    if (targetWords.size === 0) return { found: [] };

    const potentialItems = [];
    for (const item of scope) {
      const itemAdjectives = new Set(item.adjectives?.map(a => a.toLowerCase()));
      const itemNoun = item.noun.toLowerCase();
      let score = 0;

      if (targetWords.has(itemNoun)) {
        score += 10;
        targetWords.forEach(word => {
          if (itemAdjectives.has(word)) score += 1;
        });
      }

      if (score > 0) potentialItems.push({ item, score });
    }

    if (potentialItems.length === 0) return { found: [] };

    potentialItems.sort((a, b) => b.score - a.score);
    const topScore = potentialItems[0].score;
    return { found: potentialItems.filter(p => p.score === topScore).map(p => p.item) };
  }

  function _handleDisambiguation(response) {
    const { found, context } = disambiguationContext;
    const result = _findItem(response, found);
    disambiguationContext = null;

    if (result.found.length === 1) {
      context.callback(result.found[0]);
    } else {
      TextAdventureModal.appendOutput("That's still not specific enough. Please try again.", 'info');
    }
  }

  function _handleInventory() {
    if (player.inventory.length === 0) {
      TextAdventureModal.appendOutput("You are not carrying anything.", 'info');
      return;
    }
    const itemNames = player.inventory.map(id => adventure.items[id].name).join('\n');
    TextAdventureModal.appendOutput("You are carrying:\n" + itemNames, 'info');
  }

  function _handleHelp() {
    const verbList = Object.keys(adventure.verbs).join(', ');
    const helpText = `Try commands like 'look', 'go north', 'take key', 'drop trophy', 'inventory', 'save [filename]', 'load [filename]', or 'quit'.\nAvailable verbs: ${verbList}`;
    TextAdventureModal.appendOutput(helpText, 'system');
  }

  function _handleLook(target) {
    if (!target) {
      _displayCurrentRoom();
      return;
    }
    const scope = [..._getItemsInLocation(player.currentLocation), ...player.inventory.map(id => adventure.items[id])];
    const result = _findItem(target, scope);

    if (result.found.length === 1) {
      TextAdventureModal.appendOutput(result.found[0].description, 'info');
    } else if (result.found.length > 1) {
      TextAdventureModal.appendOutput("You see several of those. Which one do you mean?", 'info');
    } else {
      TextAdventureModal.appendOutput(`You don't see any "${target}" here.`, 'error');
    }
  }

  function _handleGo(direction) {
    const room = adventure.rooms[player.currentLocation];
    const exitId = room.exits ? room.exits[direction] : null;

    if (!exitId) {
      TextAdventureModal.appendOutput("You can't go that way.", 'error');
      return;
    }

    if (adventure.rooms[exitId]) {
      player.currentLocation = exitId;
      _displayCurrentRoom();
    } else if (adventure.items[exitId]) {
      const door = adventure.items[exitId];
      if (door.state === 'open' && door.leadsTo) {
        player.currentLocation = door.leadsTo;
        _displayCurrentRoom();
      } else if (door.state === 'locked') {
        TextAdventureModal.appendOutput(door.lockedMessage || `The ${door.name} is locked.`, 'error');
      } else {
        TextAdventureModal.appendOutput(`The ${door.name} is closed.`, 'info');
      }
    } else {
      TextAdventureModal.appendOutput("You can't go that way.", 'error');
    }
  }

  function _handleTake(target) {
    const scope = _getItemsInLocation(player.currentLocation);
    const result = _findItem(target, scope);

    if (result.found.length === 0) {
      TextAdventureModal.appendOutput(`I don't see a "${target}" here.`, 'error');
      return;
    }

    if (result.found.length > 1) {
      disambiguationContext = {
        found: result.found,
        context: { callback: _performTake }
      };
      const itemNames = result.found.map(item => item.name).join(' or the ');
      TextAdventureModal.appendOutput(`Which do you mean, the ${itemNames}?`, 'info');
      return;
    }
    _performTake(result.found[0]);
  }

  function _performTake(item) {
    if (item.canTake === false) {
      TextAdventureModal.appendOutput(`You can't take the ${item.name}.`, 'info');
      return;
    }
    player.inventory.push(item.id);
    adventure.items[item.id].location = 'player';
    TextAdventureModal.appendOutput(`You take the ${item.name}.`, 'info');
  }

  function _handleDrop(target) {
    const result = _findItem(target, player.inventory.map(id => adventure.items[id]));

    if (result.found.length === 0) {
      TextAdventureModal.appendOutput(`You don't have a "${target}".`, 'error');
      return;
    }

    if (result.found.length > 1) {
      disambiguationContext = {
        found: result.found,
        context: { callback: (item) => _performDrop(item) }
      };
      const itemNames = result.found.map(item => item.name).join(' or the ');
      TextAdventureModal.appendOutput(`Which do you mean to drop, the ${itemNames}?`, 'info');
      return;
    }
    _performDrop(result.found[0]);
  }

  function _performDrop(item) {
    adventure.items[item.id].location = player.currentLocation;
    player.inventory = player.inventory.filter(id => id !== item.id);
    TextAdventureModal.appendOutput(`You drop the ${item.name}.`, 'info');
  }

  function _checkWinConditions() {
    const wc = adventure.winCondition;
    if (!wc) return;

    let won = false;
    if (wc.type === "itemInRoom" && adventure.items[wc.itemId]?.location === wc.roomId) {
      won = true;
    } else if (wc.type === "playerHasItem" && player.inventory.includes(wc.itemId)) {
      won = true;
    }

    if (won) {
      TextAdventureModal.appendOutput(`\n${adventure.winMessage}`, 'adv-success');
      if(document.getElementById('adventure-input')) {
        document.getElementById('adventure-input').disabled = true;
      }
    }
  }

  return {
    startAdventure,
    processCommand,
    getScriptingContext,
  };
})();