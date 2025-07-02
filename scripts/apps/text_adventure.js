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

  /**
   * Starts a new adventure game.
   * @param {object} adventureData - The adventure data object.
   * @param {object} [options={}] - Options for the game session.
   * @returns {Promise<void>} A promise that resolves when the game session ends.
   */
  function startAdventure(adventureData, options = {}) {
    adventure = JSON.parse(JSON.stringify(adventureData));
    scriptingContext = options.scriptingContext || null;
    disambiguationContext = null;
    player = {
      currentLocation: adventure.startingRoomId,
      inventory: adventure.player?.inventory || [],
    };

    // Initial display of the starting room
    _displayCurrentRoom();

    // The modal's show function returns a promise that resolves when the modal is hidden (game ends).
    return TextAdventureModal.show(adventure, { processCommand }, scriptingContext);
  }

  /**
   * Finds all items located in a specific room.
   * @private
   * @param {string} roomId - The ID of the room to check.
   * @returns {Array<object>} An array of item objects found in the room.
   */
  function _getItemsInRoom(roomId) {
    const items = [];
    for (const id in adventure.items) {
      if (adventure.items[id].location === roomId) {
        items.push(adventure.items[id]);
      }
    }
    return items;
  }

  /**
   * Displays the name, description, items, and exits of the current room.
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
      TextAdventureModal.appendOutput("You see here: " + roomItems.map(item => item.name).join(", ") + ".", 'items');
    }

    const exitNames = Object.keys(room.exits || {});
    if (exitNames.length > 0) {
      TextAdventureModal.appendOutput("Exits: " + exitNames.join(", ") + ".", 'exits');
    } else {
      TextAdventureModal.appendOutput("There are no obvious exits.", 'exits');
    }
  }


  /**
   * Processes a single command from the player.
   * @param {string} command - The command string entered by the player.
   */
  async function processCommand(command) {
    const commandLower = command.toLowerCase().trim();

    if (disambiguationContext) {
      _handleDisambiguation(commandLower);
      return;
    }

    const words = commandLower.split(/\s+/);
    const verb = _resolveVerb(words[0]);

    if (!verb) {
      TextAdventureModal.appendOutput("I don't understand that verb. Try 'help'.", 'error');
      return;
    }

    const directObjectStr = [];
    const indirectObjectStr = [];
    let preposition = null;
    let currentTarget = directObjectStr;
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

    switch (verb.action) {
      case 'look':      _handleLook(directObject); break;
      case 'go':        _handleGo(directObject); break;
      case 'take':      _handleTake(directObject); break;
      case 'drop':      _handleDrop(directObject); break;
      case 'put':       await _handlePut(directObject, indirectObject); break;
      case 'inventory': _handleInventory(); break;
      case 'help':      _handleHelp(); break;
      case 'quit':      TextAdventureModal.hide(); break;
      default:
        TextAdventureModal.appendOutput("That's not a verb I recognize in this context.", 'error');
    }

    _checkWinConditions();
  }

  /**
   * Resolves a verb word to its action, checking aliases.
   * @private
   */
  function _resolveVerb(verbWord) {
    for (const verbKey in adventure.verbs) {
      const verbDef = adventure.verbs[verbKey];
      if (verbKey === verbWord || verbDef.aliases.includes(verbWord)) {
        return verbDef;
      }
    }
    return null;
  }

  /**
   * Finds an item by matching its noun and adjectives against a target string.
   * @private
   */
  function _findItem(targetString, scope) {
    if (!targetString) return { found: [] };

    const targetWords = new Set(targetString.toLowerCase().split(/\s+/));
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

  /**
   * Handles user input when the engine is in a state of ambiguity.
   * @private
   */
  function _handleDisambiguation(response) {
    const { found, context } = disambiguationContext;
    const result = _findItem(response, found);

    if (result.found.length === 1) {
      const selectedItem = result.found[0];
      disambiguationContext = null;
      context.callback(selectedItem);
    } else {
      TextAdventureModal.appendOutput("That's still not specific enough. Please try again.", 'info');
    }
  }

  /**
   * Logic for the 'inventory' command.
   * @private
   */
  function _handleInventory() {
    if (player.inventory.length === 0) {
      TextAdventureModal.appendOutput("You are not carrying anything.", 'info');
      return;
    }
    const itemNames = player.inventory.map(id => adventure.items[id].name).join('\n');
    TextAdventureModal.appendOutput("You are carrying:\n" + itemNames, 'info');
  }

  /**
   * Logic for the 'help' command.
   * @private
   */
  function _handleHelp() {
    const helpText = `Available verbs: ${Object.keys(adventure.verbs).join(', ')}. Try commands like 'look', 'go north', 'take key', 'drop trophy', 'put key in chest', 'inventory', or 'quit'.`;
    TextAdventureModal.appendOutput(helpText, 'system');
  }

  /**
   * Logic for the 'look' command.
   * @private
   */
  function _handleLook(target) {
    if (!target) {
      _displayCurrentRoom();
      return;
    }
    const scope = [..._getItemsInRoom(player.currentLocation), ...player.inventory.map(id => adventure.items[id])];
    const result = _findItem(target, scope);

    if (result.found.length === 1) {
      TextAdventureModal.appendOutput(result.found[0].description, 'info');
    } else if (result.found.length > 1) {
      TextAdventureModal.appendOutput("You see several of those. Which one do you mean?", 'info');
    } else {
      TextAdventureModal.appendOutput(`You don't see any "${target}" here.`, 'error');
    }
  }

  /**
   * Logic for the 'go' command.
   * @private
   */
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

  /**
   * Logic for the 'take' command, handling ambiguity.
   * @private
   */
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
        context: { verb: 'take', callback: _performTake }
      };
      const itemNames = result.found.map(item => item.name).join(' or the ');
      TextAdventureModal.appendOutput(`Which do you mean, the ${itemNames}?`, 'info');
      return;
    }

    _performTake(result.found[0]);
  }

  /**
   * The core action of taking an item.
   * @private
   */
  function _performTake(item) {
    if (item.canTake === false) {
      TextAdventureModal.appendOutput(`You can't take the ${item.name}.`, 'info');
      return;
    }
    player.inventory.push(item.id);
    adventure.items[item.id].location = 'player';
    TextAdventureModal.appendOutput(`You take the ${item.name}.`, 'info');
  }

  /**
   * Logic for the 'drop' command.
   * @private
   */
  function _handleDrop(target) {
    const result = _findItem(target, player.inventory.map(id => adventure.items[id]));

    if (result.found.length === 0) {
      TextAdventureModal.appendOutput(`You don't have a "${target}".`, 'error');
      return;
    }

    if (result.found.length > 1) {
      TextAdventureModal.appendOutput("You have several of those. Please be more specific.", 'info');
      return;
    }

    const item = result.found[0];
    adventure.items[item.id].location = player.currentLocation;
    player.inventory = player.inventory.filter(id => id !== item.id);
    TextAdventureModal.appendOutput(`You drop the ${item.name}.`, 'info');
  }

  /**
   * Logic for the 'put' command.
   * @private
   */
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

    if (!indirectObject.isContainer) {
      TextAdventureModal.appendOutput(`You can't put things in the ${indirectObject.name}.`, 'info');
      return;
    }

    if (indirectObject.state !== 'open') {
      TextAdventureModal.appendOutput(`The ${indirectObject.name} is closed.`, 'info');
      return;
    }

    adventure.items[directObject.id].location = indirectObject.id;
    player.inventory = player.inventory.filter(id => id !== directObject.id);
    TextAdventureModal.appendOutput(`You put the ${directObject.name} in the ${indirectObject.name}.`, 'info');
  }

  /**
   * Checks if any win conditions have been met.
   * @private
   */
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
      TextAdventureModal.appendOutput(`\n${adventure.winMessage}`, 'success');
      setTimeout(() => TextAdventureModal.hide(), 3000);
    }
  }

  return {
    startAdventure,
    processCommand,
  };
})();