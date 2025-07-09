const TextAdventureModal = (() => {
  "use strict";

  let state = {
    isModalOpen: false,
    isActive: false,
    inputCallback: null,
    exitPromiseResolve: null
  };

  let elements = {};

  function _createLayout() {
    const roomNameSpan = Utils.createElement('span', { id: 'adventure-room-name' });
    const scoreSpan = Utils.createElement('span', { id: 'adventure-score' });
    const headerLeft = Utils.createElement('div', {}, roomNameSpan);
    const headerRight = Utils.createElement('div', {}, scoreSpan);
    const header = Utils.createElement('header', { id: 'adventure-header' }, headerLeft, headerRight);
    const output = Utils.createElement('div', { id: 'adventure-output' });
    const inputPrompt = Utils.createElement('span', { id: 'adventure-prompt', textContent: '>' });
    const input = Utils.createElement('input', { id: 'adventure-input', type: 'text', spellcheck: 'false', autocapitalize: 'none' });
    const inputContainer = Utils.createElement('div', { id: 'adventure-input-container' }, inputPrompt, input);
    const container = Utils.createElement('div', { id: 'adventure-container' }, header, output, inputContainer);

    elements = { container, header, output, input, roomNameSpan, scoreSpan };
    return container; // Directive: Return the created element.
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

    const layout = _createLayout();
    AppLayerManager.show(layout); // Directive: Use AppLayerManager to show the UI.

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
    AppLayerManager.hide(); // Directive: Use AppLayerManager to hide the UI.
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

  function requestInput() {
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
        resolve(null);
      }
    });
  }

  function updateStatusLine(roomName, score, moves) {
    if (elements.roomNameSpan) {
      elements.roomNameSpan.textContent = roomName;
    }
    if (elements.scoreSpan) {
      elements.scoreSpan.textContent = `Score: ${score}  Moves: ${moves}`;
    }
  }

  return {
    show,
    hide,
    appendOutput,
    requestInput,
    updateStatusLine,
    isActive: () => state.isActive
  };
})();
// The TextAdventureEngine remains unchanged as its internal logic is sound.
// The changes were confined to the TextAdventureModal UI component.
const TextAdventureEngine = (() => {
  "use strict";
  let adventure;
  let player;
  let scriptingContext = null;
  let disambiguationContext = null;
  let lastReferencedItemId = null;
  let lastPlayerCommand = '';

  const defaultVerbs = {
    look: { action: 'look', aliases: ['l', 'examine', 'x', 'look at', 'look in', 'look inside'] },
    go: { action: 'go', aliases: ['north', 'south', 'east', 'west', 'up', 'down', 'n', 's', 'e', 'w', 'u', 'd', 'enter', 'exit'] },
    take: { action: 'take', aliases: ['get', 'grab', 'pick up'] },
    drop: { action: 'drop', aliases: [] },
    use: { action: 'use', aliases: [] },
    inventory: { action: 'inventory', aliases: ['i', 'inv'] },
    help: { action: 'help', aliases: ['?'] },
    quit: { action: 'quit', aliases: [] },
    save: { action: 'save', aliases: [] },
    load: { action: 'load', aliases: [] },
    talk: { action: 'talk', aliases: ['talk to', 'speak to', 'speak with'] },
    ask: { action: 'ask', aliases: [] },
    give: { action: 'give', aliases: [] },
    show: { action: 'show', aliases: ['show to'] },
    score: { action: 'score', aliases: [] },
    read: { action: 'read', aliases: [] },
    eat: { action: 'eat', aliases: [] },
    drink: { action: 'drink', aliases: [] },
    push: { action: 'push', aliases: [] },
    pull: { action: 'pull', aliases: [] },
    turn: { action: 'turn', aliases: [] },
    wear: { action: 'wear', aliases: [] },
    remove: { action: 'remove', aliases: ['take off'] },
    listen: { action: 'listen', aliases: [] },
    smell: { action: 'smell', aliases: [] },
    touch: { action: 'touch', aliases: [] },
    again: { action: 'again', aliases: ['g'] },
    wait: { action: 'wait', aliases: ['z'] },
    dance: { action: 'dance', aliases: [] },
    sing: { action: 'sing', aliases: [] },
    jump: { action: 'jump', aliases: [] },
    open: { action: 'open', aliases: [] },
    close: { action: 'close', aliases: [] },
    unlock: { action: 'unlock', aliases: [] },
    lock: { action: 'lock', aliases: [] },
    light: { action: 'light', aliases: [] },
    put: { action: 'put', aliases: [] }
  };

  function getScriptingContext() {
    return scriptingContext;
  }

  function startAdventure(adventureData, options = {}) {
    adventure = JSON.parse(JSON.stringify(adventureData));
    adventure.verbs = { ...defaultVerbs, ...adventure.verbs };
    adventure.npcs = adventure.npcs || {};
    adventure.daemons = adventure.daemons || {};
    scriptingContext = options.scriptingContext || null;
    disambiguationContext = null;
    lastReferencedItemId = null;
    lastPlayerCommand = '';
    player = {
      currentLocation: adventure.startingRoomId,
      inventory: adventure.player?.inventory || [],
      score: 0,
      moves: 0,
    };

    if (adventure.winCondition) {
      adventure.winCondition.triggered = false;
    }

    for (const roomId in adventure.rooms) {
      adventure.rooms[roomId].visited = false;
    }

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

  function _getNpcsInLocation(locationId) {
    const npcs = [];
    for (const id in adventure.npcs) {
      if (adventure.npcs[id].location === locationId) {
        npcs.push(adventure.npcs[id]);
      }
    }
    return npcs;
  }

  function _getDynamicDescription(entity) {
    if (entity.descriptions && entity.state && entity.descriptions[entity.state]) {
      return entity.descriptions[entity.state];
    }
    return entity.description;
  }

  function _hasLightSource() {
    return player.inventory.some(itemId => {
      const item = adventure.items[itemId];
      return item && item.isLightSource && item.isLit;
    });
  }

  function _displayCurrentRoom() {
    const room = adventure.rooms[player.currentLocation];
    if (!room) {
      TextAdventureModal.appendOutput("Error: You have fallen into the void. The game cannot continue.", 'error');
      return;
    }

    if (room.isDark && !_hasLightSource()) {
      TextAdventureModal.updateStatusLine(room.name, player.score, player.moves);
      TextAdventureModal.appendOutput("It is pitch black. You are likely to be eaten by a grue.", 'room-desc');
      return;
    }

    if (!room.visited) {
      room.visited = true;
      const roomPoints = room.points || 5;
      player.score += roomPoints;
      TextAdventureModal.appendOutput(`[You have gained ${roomPoints} points for entering a new area]`, 'system');
    }

    TextAdventureModal.updateStatusLine(room.name, player.score, player.moves);
    TextAdventureModal.appendOutput(_getDynamicDescription(room), 'room-desc');

    const roomNpcs = _getNpcsInLocation(player.currentLocation);
    if (roomNpcs.length > 0) {
      roomNpcs.forEach(npc => {
        TextAdventureModal.appendOutput(`You see ${npc.name} here.`, 'items');
      });
    }

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

  function _parseSingleCommand(command, defaultVerb = null) {
    const originalWords = command.toLowerCase().trim().split(/\s+/).filter(Boolean);

    const resolvedWords = originalWords.map(word => {
      if (word === 'it') {
        if (lastReferencedItemId && adventure.items[lastReferencedItemId]) {
          return adventure.items[lastReferencedItemId].noun;
        }
        return 'IT_ERROR_NO_REF';
      }
      return word;
    });

    if (resolvedWords.includes('IT_ERROR_NO_REF')) {
      return { error: "You haven't referred to anything yet. What do you mean by 'it'?" };
    }

    let verb = null;
    let verbWordCount = 0;

    for (let i = Math.min(resolvedWords.length, 3); i > 0; i--) {
      const potentialVerbPhrase = resolvedWords.slice(0, i).join(' ');
      const resolvedVerb = _resolveVerb(potentialVerbPhrase);
      if (resolvedVerb) {
        verb = resolvedVerb;
        verbWordCount = i;
        break;
      }
    }

    if (!verb) {
      if (defaultVerb) {
        verb = defaultVerb;
        verbWordCount = 0;
      } else if (resolvedWords.length === 1) {
        const potentialGoVerb = _resolveVerb(resolvedWords[0]);
        if (potentialGoVerb && potentialGoVerb.action === 'go') {
          return { verb: potentialGoVerb, directObject: resolvedWords[0], indirectObject: null };
        }
      } else {
        return { verb: null, error: `I don't understand the verb in "${command}".` };
      }
    }

    const remainingWords = resolvedWords.slice(verbWordCount);
    const prepositions = ['on', 'in', 'at', 'with', 'using', 'to', 'under', 'about'];
    let directObject;
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


  function _parseMultiCommand(command) {
    const commands = [];
    const separator = ';;;';
    const commandString = command.toLowerCase().trim()
        .replace(/\s*,\s*and\s*|\s*,\s*|\s+and\s+|\s+then\s+/g, separator);
    const commandQueue = commandString.split(separator).filter(c => c.trim());

    let lastVerb = null;
    for (const subCommandStr of commandQueue) {
      const parsed = _parseSingleCommand(subCommandStr, lastVerb);
      if (parsed.verb) {
        commands.push(parsed);
        const firstWord = subCommandStr.split(/\s+/)[0];
        if (_resolveVerb(firstWord)) {
          lastVerb = parsed.verb;
        }
      } else {
        commands.push({ error: parsed.error || `I don't understand "${subCommandStr}".` });
        break;
      }
    }
    return commands;
  }

  function _executeDaemonAction(action) {
    switch (action.type) {
      case 'message':
        TextAdventureModal.appendOutput(`\n[${action.text}]`, 'system');
        break;
    }
  }

  function _processDaemons() {
    for (const daemonId in adventure.daemons) {
      const daemon = adventure.daemons[daemonId];
      if (!daemon.active) continue;

      let triggered = false;
      const trigger = daemon.trigger;

      if (trigger.type === 'on_turn' && player.moves === trigger.value) {
        triggered = true;
      } else if (trigger.type === 'every_x_turns' && player.moves > 0 && player.moves % trigger.value === 0) {
        triggered = true;
      }

      if (triggered) {
        _executeDaemonAction(daemon.action);
        if (!daemon.repeatable) {
          daemon.active = false;
        }
      }
    }
  }

  async function processCommand(command) {
    if (!command) return;

    if (disambiguationContext) {
      _handleDisambiguation(command.toLowerCase().trim());
      return;
    }

    let commandToProcess = command.toLowerCase().trim();

    if (commandToProcess === 'again' || commandToProcess === 'g') {
      if (!lastPlayerCommand) {
        TextAdventureModal.appendOutput("You haven't entered a command to repeat yet.", 'error');
        return;
      }
      TextAdventureModal.appendOutput(`(repeating: ${lastPlayerCommand})`, 'system');
      commandToProcess = lastPlayerCommand;
    } else {
      lastPlayerCommand = commandToProcess;
    }
    player.moves++;
    const parsedCommands = _parseMultiCommand(commandToProcess);
    let stopProcessing = false;

    for (const cmd of parsedCommands) {
      if (stopProcessing) break;

      if (cmd.error) {
        TextAdventureModal.appendOutput(cmd.error, 'error');
        break;
      }

      const { verb, directObject, indirectObject } = cmd;
      const onDisambiguation = () => { stopProcessing = true; };

      switch (verb.action) {
        case 'look': _handleLook(directObject, onDisambiguation); break;
        case 'go': _handleGo(directObject); break;
        case 'take': _handleTake(directObject, onDisambiguation); break;
        case 'drop': _handleDrop(directObject, onDisambiguation); break;
        case 'use': _handleUse(directObject, indirectObject, onDisambiguation); break;
        case 'open': _handleOpen(directObject, onDisambiguation); break;
        case 'close': _handleClose(directObject, onDisambiguation); break;
        case 'unlock': _handleUnlock(directObject, indirectObject, onDisambiguation); break;
        case 'inventory': _handleInventory(); break;
        case 'help': _handleHelp(); break;
        case 'quit': TextAdventureModal.hide(); stopProcessing = true; break;
        case 'save': await _handleSave(directObject); break;
        case 'load': await _handleLoad(directObject); break;
        case 'talk': _handleTalk(directObject, onDisambiguation); break;
        case 'ask': _handleAsk(directObject, indirectObject, onDisambiguation); break;
        case 'give': _handleGive(directObject, indirectObject, onDisambiguation); break;
        case 'show': _handleShow(directObject, indirectObject, onDisambiguation); break;
        case 'score': _handleScore(); break;
        case 'read': _handleRead(directObject, onDisambiguation); break;
        case 'eat': _handleEatDrink('eat', directObject, onDisambiguation); break;
        case 'drink': _handleEatDrink('drink', directObject, onDisambiguation); break;
        case 'push': _handlePushPullTurn('push', directObject, onDisambiguation); break;
        case 'pull': _handlePushPullTurn('pull', directObject, onDisambiguation); break;
        case 'turn': _handlePushPullTurn('turn', directObject, onDisambiguation); break;
        case 'wear': _handleWearRemove('wear', directObject, onDisambiguation); break;
        case 'remove': _handleWearRemove('remove', directObject, onDisambiguation); break;
        case 'listen': _handleSensoryVerb('listen', directObject, onDisambiguation); break;
        case 'smell': _handleSensoryVerb('smell', directObject, onDisambiguation); break;
        case 'touch': _handleSensoryVerb('touch', directObject, onDisambiguation); break;
        case 'wait': _handleWait(); break;
        case 'dance': TextAdventureModal.appendOutput("You do a little jig. You feel refreshed.", 'system'); break;
        case 'sing': TextAdventureModal.appendOutput("You belt out a sea shanty. A nearby bird looks annoyed.", 'system'); break;
        case 'jump': TextAdventureModal.appendOutput("You jump on the spot. Whee!", 'system'); break;
        case 'light': _handleLight(directObject, onDisambiguation); break;
        default:
          TextAdventureModal.appendOutput(`I don't know how to "${verb.action}".`, 'error');
          stopProcessing = true;
      }

      if (!stopProcessing) {
        _processDaemons();
        _checkWinConditions();
        if (parsedCommands.length > 1) {
          await new Promise(resolve => setTimeout(resolve, 350));
        }
      }
    }
  }

  async function _handleSave(filename) {
    if (!filename) {
      TextAdventureModal.appendOutput("You need to specify a filename to save to. (e.g., save mygame.json)", 'error');
      return;
    }

    const saveState = {
      saveVersion: "1.1",
      playerState: JSON.parse(JSON.stringify(player)),
      itemsState: JSON.parse(JSON.stringify(adventure.items)),
      roomsState: JSON.parse(JSON.stringify(adventure.rooms))
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

    let saveData;
    try {
      saveData = JSON.parse(pathInfo.node.content);
    } catch (e) {
      TextAdventureModal.appendOutput(`Error loading game: The save file is corrupted or not valid JSON.`, 'error');
      return;
    }

    if (!saveData || !saveData.playerState || !saveData.itemsState || !saveData.roomsState) {
      TextAdventureModal.appendOutput("Error loading game: Invalid or outdated save file format.", 'error');
      return;
    }

    player = JSON.parse(JSON.stringify(saveData.playerState));
    adventure.items = JSON.parse(JSON.stringify(saveData.itemsState));
    adventure.rooms = JSON.parse(JSON.stringify(saveData.roomsState));

    TextAdventureModal.appendOutput(`Game loaded successfully from '${filename}'.\n`, 'system');
    _displayCurrentRoom();
  }

  function _handleLight(target, onDisambiguation) {
    const scope = player.inventory.map(id => adventure.items[id]);
    const result = _findItem(target, scope);

    if (result.found.length === 0) {
      TextAdventureModal.appendOutput(`You don't have a "${target}" to light.`, 'error');
      return;
    }

    if (result.found.length > 1) {
      disambiguationContext = { found: result.found, context: { callback: _performLight } };
      const itemNames = result.found.map(item => item.name).join(' or the ');
      TextAdventureModal.appendOutput(`Which do you want to light, the ${itemNames}?`, 'info');
      onDisambiguation();
      return;
    }
    _performLight(result.found[0]);
  }

  function _performLight(item) {
    if (!item.isLightSource) {
      TextAdventureModal.appendOutput(`You can't light the ${item.name}.`, 'error');
      return;
    }
    if (item.isLit) {
      TextAdventureModal.appendOutput(`The ${item.name} is already lit.`, 'info');
      return;
    }
    item.isLit = true;
    TextAdventureModal.appendOutput(`You light the ${item.name}. It glows brightly.`, 'info');
    lastReferencedItemId = item.id;
    // If we just lit a lamp in a dark room, re-describe the room.
    if (adventure.rooms[player.currentLocation].isDark) {
      _displayCurrentRoom();
    }
  }

  function _handleUse(directObjectStr, indirectObjectStr, onDisambiguation) {
    if (!directObjectStr || !indirectObjectStr) {
      TextAdventureModal.appendOutput("What do you want to use, and what do you want to use it on?", 'error');
      return;
    }

    const itemToUseResult = _findItem(directObjectStr, player.inventory.map(id => adventure.items[id]));
    if (itemToUseResult.found.length === 0) {
      TextAdventureModal.appendOutput(`You don't have a "${directObjectStr}".`, 'error');
      return;
    }
    const itemToUse = itemToUseResult.found[0];

    const targetScope = [..._getItemsInLocation(player.currentLocation), ..._getNpcsInLocation(player.currentLocation)];
    const targetItemResult = _findItem(indirectObjectStr, targetScope);

    if (targetItemResult.found.length === 0) {
      TextAdventureModal.appendOutput(`You don't see a "${indirectObjectStr}" here.`, 'error');
      return;
    }
    const targetItem = targetItemResult.found[0];

    if (targetItem.onUse && targetItem.onUse[itemToUse.id]) {
      const useAction = targetItem.onUse[itemToUse.id];

      let conditionsMet = true;
      if (useAction.conditions) {
        for (const cond of useAction.conditions) {
          const itemToCheck = adventure.items[cond.itemId];
          if (!itemToCheck || itemToCheck.state !== cond.requiredState) {
            conditionsMet = false;
            break;
          }
        }
      }

      if (conditionsMet) {
        if (useAction.message) {
          TextAdventureModal.appendOutput(useAction.message, 'info');
        }

        if (adventure.winCondition.type === 'itemUsedOn' &&
            adventure.winCondition.itemId === itemToUse.id &&
            adventure.winCondition.targetId === targetItem.id) {
          adventure.winCondition.triggered = true;
        }

        if (useAction.destroyItem) {
          player.inventory = player.inventory.filter(id => id !== itemToUse.id);
        }
      } else {
        TextAdventureModal.appendOutput(useAction.failureMessage || `You can't seem to use the ${itemToUse.name} on the ${targetItem.name} right now.`, 'info');
      }
    } else {
      TextAdventureModal.appendOutput(`Nothing interesting happens when you use the ${itemToUse.name} on the ${targetItem.name}.`, 'info');
    }
  }

  function _handleOpen(target, onDisambiguation) {
    const scope = [..._getItemsInLocation(player.currentLocation), ...player.inventory.map(id => adventure.items[id])];
    const result = _findItem(target, scope);

    if (result.found.length === 0) {
      TextAdventureModal.appendOutput(`You don't see any "${target}" here.`, 'error');
      return;
    }

    if (result.found.length > 1) {
      disambiguationContext = { found: result.found, context: { callback: _performOpen } };
      const itemNames = result.found.map(item => item.name).join(' or the ');
      TextAdventureModal.appendOutput(`Which do you mean, the ${itemNames}?`, 'info');
      onDisambiguation();
      return;
    }
    _performOpen(result.found[0]);
  }

  function _performOpen(item) {
    if (!item.isOpenable) {
      TextAdventureModal.appendOutput("You can't open that.", 'error');
      return;
    }
    if (item.isLocked) {
      TextAdventureModal.appendOutput(`The ${item.name} is locked.`, 'info');
      return;
    }
    if (item.isOpen) {
      TextAdventureModal.appendOutput(`The ${item.name} is already open.`, 'info');
      return;
    }
    item.isOpen = true;
    TextAdventureModal.appendOutput(`You open the ${item.name}.`, 'info');
    lastReferencedItemId = item.id;
    if (item.isContainer && item.contains.length > 0) {
      const contents = item.contains.map(id => adventure.items[id].name).join(', ');
      TextAdventureModal.appendOutput(`Inside, you see: ${contents}.`, 'items');
    } else if (item.isContainer) {
      TextAdventureModal.appendOutput(`The ${item.name} is empty.`, 'info');
    }
  }

  function _handleClose(target, onDisambiguation) {
    const scope = [..._getItemsInLocation(player.currentLocation), ...player.inventory.map(id => adventure.items[id])];
    const result = _findItem(target, scope);

    if (result.found.length === 0) {
      TextAdventureModal.appendOutput(`You don't see any "${target}" here.`, 'error');
      return;
    }

    if (result.found.length > 1) {
      disambiguationContext = { found: result.found, context: { callback: _performClose } };
      const itemNames = result.found.map(item => item.name).join(' or the ');
      TextAdventureModal.appendOutput(`Which do you mean, the ${itemNames}?`, 'info');
      onDisambiguation();
      return;
    }
    _performClose(result.found[0]);
  }

  function _performClose(item) {
    if (!item.isOpenable) {
      TextAdventureModal.appendOutput("You can't close that.", 'error');
      return;
    }
    if (!item.isOpen) {
      TextAdventureModal.appendOutput(`The ${item.name} is already closed.`, 'info');
      return;
    }
    item.isOpen = false;
    TextAdventureModal.appendOutput(`You close the ${item.name}.`, 'info');
    lastReferencedItemId = item.id;
  }

  function _handleUnlock(target, key, onDisambiguation) {
    if (!key) {
      TextAdventureModal.appendOutput("What do you want to unlock that with?", 'error');
      return;
    }
    const scope = [..._getItemsInLocation(player.currentLocation), ...player.inventory.map(id => adventure.items[id])];
    const targetResult = _findItem(target, scope);
    if (targetResult.found.length === 0) {
      TextAdventureModal.appendOutput(`You don't see any "${target}" here.`, 'error');
      return;
    }
    if (targetResult.found.length > 1) {
      disambiguationContext = {
        found: targetResult.found,
        context: {
          callback: (item) => _handleUnlock(item.noun, key, onDisambiguation)
        }
      };
      const itemNames = targetResult.found.map(i => i.name).join(' or the ');
      TextAdventureModal.appendOutput(`Which ${target} do you want to unlock, the ${itemNames}?`, 'info');
      onDisambiguation();
      return;
    }
    const keyResult = _findItem(key, player.inventory.map(id => adventure.items[id]));
    if (keyResult.found.length === 0) {
      TextAdventureModal.appendOutput(`You don't have a "${key}".`, 'error');
      return;
    }
    const targetItem = targetResult.found[0];
    const keyItem = keyResult.found[0];
    if (!targetItem.isLocked) {
      TextAdventureModal.appendOutput(`The ${targetItem.name} is not locked.`, 'info');
      return;
    }
    if (keyItem.unlocks === targetItem.id) {
      targetItem.isLocked = false;
      TextAdventureModal.appendOutput(`You unlock the ${targetItem.name} with the ${keyItem.name}.`, 'info');
      lastReferencedItemId = targetItem.id;
    } else {
      TextAdventureModal.appendOutput(`The ${keyItem.name} doesn't seem to fit the lock.`, 'error');
    }
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
    const foundItems = potentialItems.filter(p => p.score === topScore).map(p => p.item);
    const exactMatch = foundItems.length === 1 && targetString === foundItems[0].noun;

    return { found: foundItems, exactMatch };
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

  function _getTakableItems() {
    const takable = [];
    const roomItems = _getItemsInLocation(player.currentLocation);
    const queue = [...roomItems];
    const visitedContainers = new Set();

    while(queue.length > 0) {
      const item = queue.shift();
      takable.push(item);
      if (item.isContainer && item.isOpen && !visitedContainers.has(item.id)) {
        visitedContainers.add(item.id);
        if (item.contains && item.contains.length > 0) {
          item.contains.forEach(itemId => {
            const containedItem = adventure.items[itemId];
            if (containedItem) {
              containedItem.location = item.id;
              queue.push(containedItem);
            }
          });
        }
      }
    }
    return takable.filter(item => item.canTake);
  }


  function _handleLook(target, onDisambiguation) {
    if (!target) {
      _displayCurrentRoom();
      return;
    }

    const itemScope = [..._getItemsInLocation(player.currentLocation), ...player.inventory.map(id => adventure.items[id])];
    const itemResult = _findItem(target, itemScope);

    const npcScope = _getNpcsInLocation(player.currentLocation);
    const npcResult = _findItem(target, npcScope);

    const combined = [...itemResult.found, ...npcResult.found];
    const uniqueCombined = [...new Map(combined.map(item => [item['id'], item])).values()];

    if (uniqueCombined.length === 0) {
      TextAdventureModal.appendOutput(`You don't see any "${target}" here.`, 'error');
    } else if (uniqueCombined.length === 1) {
      _performLook(uniqueCombined[0]);
    } else {
      disambiguationContext = { found: uniqueCombined, context: { callback: _performLook } };
      const names = uniqueCombined.map(e => e.name).join(' or the ');
      TextAdventureModal.appendOutput(`Which do you mean, the ${names}?`, 'info');
      onDisambiguation();
    }
  }

  function _performLook(entity) {
    TextAdventureModal.appendOutput(_getDynamicDescription(entity), 'info');
    if ('canTake' in entity) { // It's an item
      lastReferencedItemId = entity.id;
      if (entity.isContainer && entity.isOpen) {
        const contents = entity.contains?.map(id => adventure.items[id].name).join(', ');
        TextAdventureModal.appendOutput(contents ? `Inside, you see: ${contents}.` : `The ${entity.name} is empty.`, 'items');
      } else if (entity.isContainer && !entity.isOpen) {
        TextAdventureModal.appendOutput(`The ${entity.name} is closed.`, 'info');
      }
    }
  }

  function _handleGo(direction) {
    const room = adventure.rooms[player.currentLocation];
    const exitId = room.exits ? room.exits[direction] : null;

    if (!exitId) {
      TextAdventureModal.appendOutput("You can't go that way.", 'error');
      return;
    }

    const exitBlocker = Object.values(adventure.items).find(item => item.location === player.currentLocation && item.blocksExit && item.blocksExit[direction]);
    if (exitBlocker && (!exitBlocker.isOpenable || !exitBlocker.isOpen)) {
      TextAdventureModal.appendOutput(exitBlocker.lockedMessage || `The way is blocked by the ${exitBlocker.name}.`);
      return;
    }

    if (adventure.rooms[exitId]) {
      player.currentLocation = exitId;
      _displayCurrentRoom();
    } else {
      TextAdventureModal.appendOutput("You can't go that way.", 'error');
    }
  }

  function _handleTake(target, onDisambiguation) {
    const scope = _getTakableItems();
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
      onDisambiguation();
      return;
    }
    _performTake(result.found[0]);
  }

  function _performTake(item) {
    if (item.canTake === false) {
      TextAdventureModal.appendOutput(`You can't take the ${item.name}.`, 'info');
      return;
    }

    const originalLocationId = item.location;
    if (adventure.rooms[originalLocationId]) {
    } else if (adventure.items[originalLocationId] && adventure.items[originalLocationId].isContainer) {
      const container = adventure.items[originalLocationId];
      container.contains = container.contains.filter(id => id !== item.id);
    }

    player.inventory.push(item.id);
    adventure.items[item.id].location = 'player';
    TextAdventureModal.appendOutput(`You take the ${item.name}.`, 'info');
    lastReferencedItemId = item.id;
    if (item.points && !item.hasBeenScored) {
      player.score += item.points;
      item.hasBeenScored = true;
      TextAdventureModal.appendOutput(`[Your score has just gone up by ${item.points} points!]`, 'system');
      TextAdventureModal.updateStatusLine(adventure.rooms[player.currentLocation].name, player.score, player.moves);
    }
  }

  function _handleDrop(target, onDisambiguation) {
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
      onDisambiguation();
      return;
    }
    _performDrop(result.found[0]);
  }

  function _handleTalk(target, onDisambiguation) {
    const scope = _getNpcsInLocation(player.currentLocation);
    const result = _findItem(target, scope);

    if (result.found.length === 0) {
      TextAdventureModal.appendOutput(`There is no one here by the name of "${target}".`, 'error');
      return;
    }

    if (result.found.length > 1) {
      disambiguationContext = { found: result.found, context: { callback: _performTalk } };
      const npcNames = result.found.map(npc => npc.name).join(' or the ');
      TextAdventureModal.appendOutput(`Who do you mean, the ${npcNames}?`, 'info');
      onDisambiguation();
      return;
    }

    _performTalk(result.found[0]);
  }

  function _performTalk(npc) {
    const response = npc.dialogue?.default || `The ${npc.name} doesn't seem to have much to say.`;
    TextAdventureModal.appendOutput(response, 'info');
  }

  function _handleAsk(npcTarget, topic, onDisambiguation) {
    if (!npcTarget || !topic) {
      TextAdventureModal.appendOutput("Who do you want to ask, and what about?", 'error');
      return;
    }

    const scope = _getNpcsInLocation(player.currentLocation);
    const result = _findItem(npcTarget, scope);

    if (result.found.length === 0) {
      TextAdventureModal.appendOutput(`There is no one here by the name of "${npcTarget}".`, 'error');
      return;
    }

    if (result.found.length > 1) {
      disambiguationContext = { found: result.found, context: { callback: (npc) => _performAsk(npc, topic) } };
      const npcNames = result.found.map(npc => npc.name).join(' or the ');
      TextAdventureModal.appendOutput(`Which ${npcTarget} do you want to ask, the ${npcNames}?`, 'info');
      onDisambiguation();
      return;
    }

    _performAsk(result.found[0], topic);
  }

  function _performAsk(npc, topic) {
    const dialogue = npc.dialogue;
    let response = dialogue?.default || `The ${npc.name} doesn't seem to have much to say.`;

    if (dialogue) {
      const topicLower = topic.toLowerCase();
      let bestMatch = null;
      for (const keyword in dialogue) {
        if (topicLower.includes(keyword)) {
          bestMatch = dialogue[keyword];
        }
      }
      if (bestMatch) response = bestMatch;
    }
    TextAdventureModal.appendOutput(response, 'info');
  }

  function _handleGive(itemTarget, npcTarget, onDisambiguation) {
    if (!itemTarget || !npcTarget) {
      TextAdventureModal.appendOutput("What do you want to give, and to whom?", 'error');
      return;
    }

    const itemResult = _findItem(itemTarget, player.inventory.map(id => adventure.items[id]));
    if (itemResult.found.length === 0) {
      TextAdventureModal.appendOutput(`You don't have a "${itemTarget}".`, 'error');
      return;
    }

    if (itemResult.found.length > 1) {
      disambiguationContext = { found: itemResult.found, context: { callback: (item) => _handleGive(item.name, npcTarget, onDisambiguation) } };
      const itemNames = itemResult.found.map(i => i.name).join(' or the ');
      TextAdventureModal.appendOutput(`Which ${itemTarget} do you want to give, the ${itemNames}?`, 'info');
      onDisambiguation();
      return;
    }
    const itemToGive = itemResult.found[0];


    const npcResult = _findItem(npcTarget, _getNpcsInLocation(player.currentLocation));
    if (npcResult.found.length === 0) {
      TextAdventureModal.appendOutput(`There is no one here by the name of "${npcTarget}".`, 'error');
      return;
    }

    if (npcResult.found.length > 1) {
      disambiguationContext = { found: npcResult.found, context: { callback: (npc) => _performGive(itemToGive, npc) } };
      const npcNames = npcResult.found.map(n => n.name).join(' or the ');
      TextAdventureModal.appendOutput(`Which ${npcTarget} do you want to give it to, the ${npcNames}?`, 'info');
      onDisambiguation();
      return;
    }
    const targetNpc = npcResult.found[0];

    _performGive(itemToGive, targetNpc);
  }

  function _performGive(item, npc) {
    player.inventory = player.inventory.filter(id => id !== item.id);
    npc.inventory.push(item.id);
    item.location = npc.id;
    TextAdventureModal.appendOutput(`You give the ${item.name} to the ${npc.name}.`, 'info');
    TextAdventureModal.appendOutput(`The ${npc.name} takes it graciously. "Thank you," he says.`, 'info');
  }

  function _handleShow(itemTarget, npcTarget, onDisambiguation) {
    if (!itemTarget || !npcTarget) {
      TextAdventureModal.appendOutput("What do you want to show, and to whom?", 'error');
      return;
    }

    const itemResult = _findItem(itemTarget, player.inventory.map(id => adventure.items[id]));
    if (itemResult.found.length === 0) {
      TextAdventureModal.appendOutput(`You don't have a "${itemTarget}".`, 'error');
      return;
    }

    if (itemResult.found.length > 1) {
      disambiguationContext = { found: itemResult.found, context: { callback: (item) => _handleShow(item.name, npcTarget, onDisambiguation) } };
      const itemNames = itemResult.found.map(i => i.name).join(' or the ');
      TextAdventureModal.appendOutput(`Which ${itemTarget} do you want to show, the ${itemNames}?`, 'info');
      onDisambiguation();
      return;
    }
    const itemToShow = itemResult.found[0];

    const npcResult = _findItem(npcTarget, _getNpcsInLocation(player.currentLocation));
    if (npcResult.found.length === 0) {
      TextAdventureModal.appendOutput(`There is no one here by the name of "${npcTarget}".`, 'error');
      return;
    }

    if (npcResult.found.length > 1) {
      disambiguationContext = { found: npcResult.found, context: { callback: (npc) => _performShow(itemToShow, npc) } };
      const npcNames = npcResult.found.map(n => n.name).join(' or the ');
      TextAdventureModal.appendOutput(`Which ${npcTarget} do you want to show it to, the ${npcNames}?`, 'info');
      onDisambiguation();
      return;
    }
    const targetNpc = npcResult.found[0];

    _performShow(itemToShow, targetNpc);
  }

  function _performShow(item, npc) {
    let response = npc.onShow?.default || `The ${npc.name} looks at the ${item.name} but doesn't react.`;
    if (npc.onShow && npc.onShow[item.id]) {
      response = npc.onShow[item.id];
    }
    TextAdventureModal.appendOutput(`You show the ${item.name} to the ${npc.name}.`, 'info');
    TextAdventureModal.appendOutput(response, 'info');
  }

  function _performDrop(item) {
    adventure.items[item.id].location = player.currentLocation;
    player.inventory = player.inventory.filter(id => id !== item.id);
    TextAdventureModal.appendOutput(`You drop the ${item.name}.`, 'info');
    lastReferencedItemId = item.id;
  }

  function _handleRead(target, onDisambiguation) {
    const scope = [..._getItemsInLocation(player.currentLocation), ...player.inventory.map(id => adventure.items[id])];
    const result = _findItem(target, scope);

    if (result.found.length === 0) {
      TextAdventureModal.appendOutput(`You don't see any "${target}" to read here.`, 'error');
      return;
    }

    if (result.found.length > 1) {
      disambiguationContext = { found: result.found, context: { callback: _performRead } };
      const itemNames = result.found.map(item => item.name).join(' or the ');
      TextAdventureModal.appendOutput(`Which do you want to read, the ${itemNames}?`, 'info');
      onDisambiguation();
      return;
    }
    _performRead(result.found[0]);
  }

  function _performRead(item) {
    if (item.readDescription) {
      TextAdventureModal.appendOutput(`It reads:\n\n${item.readDescription}`, 'info');
      lastReferencedItemId = item.id;
    } else {
      TextAdventureModal.appendOutput(`There is nothing to read on the ${item.name}.`, 'error');
    }
  }

  function _handleEatDrink(verb, target, onDisambiguation) {
    const scope = player.inventory.map(id => adventure.items[id]);
    const result = _findItem(target, scope);

    if (result.found.length === 0) {
      TextAdventureModal.appendOutput(`You don't have a "${target}" to ${verb}.`, 'error');
      return;
    }

    if (result.found.length > 1) {
      disambiguationContext = { found: result.found, context: { callback: (item) => _performEatDrink(verb, item) } };
      const itemNames = result.found.map(item => item.name).join(' or the ');
      TextAdventureModal.appendOutput(`Which do you want to ${verb}, the ${itemNames}?`, 'info');
      onDisambiguation();
      return;
    }
    _performEatDrink(verb, result.found[0]);
  }

  function _performEatDrink(verb, item) {
    const itemProperty = (verb === 'eat') ? 'isEdible' : 'isDrinkable';
    if (item[itemProperty]) {
      TextAdventureModal.appendOutput(`You ${verb} the ${item.name}.`, 'info');
      // Remove item from inventory
      player.inventory = player.inventory.filter(id => id !== item.id);
    } else {
      TextAdventureModal.appendOutput(`You can't ${verb} that!`, 'error');
    }
  }

  function _handlePushPullTurn(verb, target, onDisambiguation) {
    const scope = _getItemsInLocation(player.currentLocation);
    const result = _findItem(target, scope);

    if (result.found.length === 0) {
      TextAdventureModal.appendOutput(`You don't see a "${target}" to ${verb} here.`, 'error');
      return;
    }

    if (result.found.length > 1) {
      disambiguationContext = { found: result.found, context: { callback: (item) => _performPushPullTurn(verb, item) } };
      const itemNames = result.found.map(item => item.name).join(' or the ');
      TextAdventureModal.appendOutput(`Which do you want to ${verb}, the ${itemNames}?`, 'info');
      onDisambiguation();
      return;
    }
    _performPushPullTurn(verb, result.found[0]);
  }

  function _performPushPullTurn(verb, item) {
    const effectProperty = `on${verb.charAt(0).toUpperCase() + verb.slice(1)}`;
    if (item[effectProperty]) {
      const effect = item[effectProperty];
      if (typeof effect === 'object' && effect.newState) {
        if(item.state === effect.newState) {
          TextAdventureModal.appendOutput(`It is already in that state.`, 'info');
          return;
        }
        item.state = effect.newState;
        TextAdventureModal.appendOutput(effect.message, 'info');

        if (effect.effects) {
          effect.effects.forEach(e => {
            if (adventure.items[e.targetId]) {
              adventure.items[e.targetId].state = e.newState;
            }
          });
        }
      } else if (typeof effect === 'string') {
        TextAdventureModal.appendOutput(effect, 'info');
      }
      lastReferencedItemId = item.id;
    } else {
      TextAdventureModal.appendOutput(`Pushing, pulling, or turning the ${item.name} does nothing.`, 'info');
    }
  }

  function _handleWearRemove(verb, target, onDisambiguation) {
    const isWearing = (verb === 'wear');
    const scope = isWearing ? player.inventory.map(id => adventure.items[id]) : player.inventory.map(id => adventure.items[id]).filter(item => item.isWorn);
    const result = _findItem(target, scope);

    if (result.found.length === 0) {
      TextAdventureModal.appendOutput(isWearing ? `You don't have a "${target}".` : `You are not wearing a "${target}".`, 'error');
      return;
    }

    if (result.found.length > 1) {
      disambiguationContext = { found: result.found, context: { callback: (item) => _performWearRemove(verb, item) } };
      const itemNames = result.found.map(item => item.name).join(' or the ');
      TextAdventureModal.appendOutput(`Which ${target} do you mean, the ${itemNames}?`, 'info');
      onDisambiguation();
      return;
    }
    _performWearRemove(verb, result.found[0]);
  }

  function _performWearRemove(verb, item) {
    if (!item.isWearable) {
      TextAdventureModal.appendOutput(`You can't wear the ${item.name}.`, 'error');
      return;
    }

    if (verb === 'wear') {
      if (item.isWorn) {
        TextAdventureModal.appendOutput(`You are already wearing the ${item.name}.`, 'info');
      } else {
        item.isWorn = true;
        TextAdventureModal.appendOutput(`You put on the ${item.name}.`, 'info');
      }
    } else { // verb is 'remove'
      if (!item.isWorn) {
        TextAdventureModal.appendOutput(`You are not wearing the ${item.name}.`, 'info');
      } else {
        item.isWorn = false;
        TextAdventureModal.appendOutput(`You take off the ${item.name}.`, 'info');
      }
    }
  }

  function _handleSensoryVerb(verb, target, onDisambiguation) {
    if (!target) {
      const room = adventure.rooms[player.currentLocation];
      const property = `on${verb.charAt(0).toUpperCase() + verb.slice(1)}`;
      const defaultMessages = {
        listen: "You don't hear anything out of the ordinary.",
        smell: "You don't smell anything unusual.",
        touch: "You feel the air around you. It feels like... air."
      };

      const message = room[property] || defaultMessages[verb];
      TextAdventureModal.appendOutput(message, 'info');
      return;
    }

    const scope = [..._getItemsInLocation(player.currentLocation), ...player.inventory.map(id => adventure.items[id])];
    const result = _findItem(target, scope);

    if (result.found.length === 0) {
      TextAdventureModal.appendOutput(`You don't see any "${target}" to ${verb} here.`, 'error');
      return;
    }

    if (result.found.length > 1) {
      disambiguationContext = { found: result.found, context: { callback: (item) => _performSensoryVerb(verb, item) } };
      const itemNames = result.found.map(item => item.name).join(' or the ');
      TextAdventureModal.appendOutput(`Which ${target} do you want to ${verb}, the ${itemNames}?`, 'info');
      onDisambiguation();
      return;
    }

    _performSensoryVerb(verb, result.found[0]);
  }

  function _performSensoryVerb(verb, item) {
    const property = `on${verb.charAt(0).toUpperCase() + verb.slice(1)}`;
    const defaultMessages = {
      listen: `The ${item.name} is silent.`,
      smell: `The ${item.name} doesn't smell like anything in particular.`,
      touch: `You touch the ${item.name}.`
    };

    const message = item[property] || defaultMessages[verb];
    TextAdventureModal.appendOutput(message, 'info');
    lastReferencedItemId = item.id;
  }

  function _handleScore() {
    TextAdventureModal.appendOutput(`Your score is ${player.score} out of a possible ${adventure.maxScore || 100}, in ${player.moves} moves.`, 'system');
  }

  function _handleWait() {
    TextAdventureModal.appendOutput("Time passes...", 'system');
  }


  function _checkWinConditions() {
    const wc = adventure.winCondition;
    if (!wc) return;

    let won = false;
    if (wc.type === "itemInRoom" && adventure.items[wc.itemId]?.location === wc.roomId) {
      won = true;
    } else if (wc.type === "playerHasItem" && player.inventory.includes(wc.itemId)) {
      won = true;
    } else if (wc.type === "itemUsedOn" && wc.triggered) {
      won = true;
    }

    if (won) {
      TextAdventureModal.appendOutput(`\n${adventure.winMessage}`, 'adv-success');
      if(document.getElementById('adventure-input')) {
        document.getElementById('adventure-input').disabled = true;
      }
      state.inputCallback = null;
    }
  }

  return {
    startAdventure,
    processCommand,
    getScriptingContext,
  };
})();