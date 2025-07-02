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
    disambiguationContext = null; // Ensure context is cleared on new game start
    player = {
      currentLocation: adventure.startingRoomId,
      inventory: adventure.player?.inventory || [],
    };

    // Initial display of the starting room
    _displayCurrentRoom();

    // The modal's show function returns a promise that resolves when the modal is hidden (game ends).
    return TextAdventureModal.show(adventure, {
      processCommand
    }, scriptingContext);
  }

  /**
   * Finds all items located in a specific room or container.
   * @private
   */
  function _getItemsInLocation(locationId) {
    const items = [];
    for (const id in adventure.items) {
      if (adventure.items[id].location === locationId) {
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

  /**
   * Processes a single command from the player.
   * @param {string} command - The command string entered by the player.
   */
  async function processCommand(command) {
    if (!command) return;
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

    // Simplified parsing for now. A more advanced parser would handle prepositions better.
    const directObjectStr = words.slice(1).join(' ');

    switch (verb.action) {
      case 'look':      _handleLook(directObjectStr); break;
      case 'go':        _handleGo(directObjectStr); break;
      case 'take':      _handleTake(directObjectStr); break;
      case 'drop':      _handleDrop(directObjectStr); break;
      case 'inventory': _handleInventory(); break;
      case 'help':      _handleHelp(); break;
      case 'quit':      TextAdventureModal.hide(); break;
      default:
        TextAdventureModal.appendOutput(`I don't know how to "${verb.action}".`, 'error');
    }

    _checkWinConditions();
  }

  /**
   * Resolves a verb word to its action by checking aliases.
   * @private
   */
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

  /**
   * Finds an item by matching its noun and adjectives against a target string.
   * @private
   */
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

  /**
   * Handles user input when the engine is in a state of ambiguity.
   * @private
   */
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
    const helpText = `Try commands like 'look', 'go north', 'take key', 'drop trophy', 'inventory', or 'quit'.\nAvailable verbs: ${verbList}`;
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
      // Disable further input and show exit button clearly
      const inputEl = document.getElementById('adventure-input');
      if (inputEl) inputEl.disabled = true;
      // The modal will be closed by the user or script completion.
    }
  }

  return {
    startAdventure,
    processCommand,
  };
})();