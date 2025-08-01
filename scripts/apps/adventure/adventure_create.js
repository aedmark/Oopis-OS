// scripts/apps/adventure/adventure_create.js

"use strict";

/**
 * Adventure Creator - Interactive tool for creating and editing text adventure games
 * @namespace Adventure_create
 */
window.Adventure_create = {
  /**
   * Application state
   * @type {Object}
   * @property {boolean} isActive - Whether the creator is currently running
   * @property {Object} adventureData - The adventure game data being edited
   * @property {string} targetFilename - File to save the adventure to
   * @property {boolean} isDirty - Whether there are unsaved changes
   * @property {Object} commandContext - Command execution context
   * @property {Object|null} editContext - Current entity being edited {type, id, name}
   * @property {Object|null} dialogueEditContext - Current dialogue node being edited {npcId, nodeId}
   */
  state: {
    isActive: false,
    adventureData: {},
    targetFilename: "",
    isDirty: false,
    commandContext: null,
    editContext: null,
    dialogueEditContext: null,
  },

  /** @type {Object} Dependencies injected from command context */
  dependencies: {},

  /**
   * Enter the adventure creator
   * @param {string} filename - Target filename for saving
   * @param {Object} initialData - Initial adventure data
   * @param {Object} commandContext - Command execution context
   */
  enter(filename, initialData, commandContext) {
    if (this.state.isActive) return;

    this.dependencies = commandContext.dependencies;

    this.state = {
      isActive: true,
      adventureData: initialData,
      targetFilename: filename,
      isDirty: false,
      commandContext: commandContext,
      editContext: null,
      dialogueEditContext: null, // NEW
    };

    this.dependencies.OutputManager.appendToOutput(
        "Entering Adventure Creator. Type 'help' for commands, 'exit' to quit.",
        { typeClass: "text-success" }
    );

    this._requestNextCommand();
  },

  /**
   * Request the next command from the user
   * @private
   */
  _requestNextCommand() {
    if (!this.state.isActive) return;

    let prompt = `(creator)> `;
    if (this.state.dialogueEditContext) {
      const npcName = this.state.adventureData.npcs[this.state.dialogueEditContext.npcId].name;
      prompt = `(dialogue for '${npcName}' | node '${this.state.dialogueEditContext.nodeId}')> `;
    } else if (this.state.editContext) {
      prompt = `(editing ${this.state.editContext.type} '${this.state.editContext.name}')> `;
    }

    this.dependencies.ModalManager.request({
      context: "terminal",
      type: "input",
      messageLines: [prompt],
      onConfirm: async (input) => {
        if (this.state.dialogueEditContext) {
          await this._processDialogueCreatorCommand(input);
        } else {
          await this._processCreatorCommand(input);
        }
        if (this.state.isActive) {
          this._requestNextCommand();
        }
      },
      onCancel: () => {
        if (this.state.isActive) this._requestNextCommand();
      },
      options: this.state.commandContext.options,
    });
  },

  /**
   * Process a main creator command
   * @private
   * @param {string} input - User input command
   */
  async _processCreatorCommand(input) {
    const [command, ...args] = input.trim().split(/\s+/);
    const joinedArgs = args.join(" ");

    if (this.state.editContext && this.state.editContext.type === 'npc' && command.toLowerCase() === 'dialogue') {
      await this._enterDialogueEditMode();
      return;
    }

    switch (command.toLowerCase()) {
      case "create":
        await this._handleCreate(args);
        break;
      case "edit":
        await this._handleEdit(joinedArgs);
        break;
      case "set":
        await this._handleSet(joinedArgs);
        break;
      case "link":
        await this._handleLink(args);
        break;
      case "status":
        await this._handleStatus();
        break;
      case "save":
        await this._handleSave();
        break;
      case "exit":
        await this.exit();
        break;
      case "help":
        await this._handleHelp();
        break;
      case "":
        break;
      default:
        await this.dependencies.OutputManager.appendToOutput(
            `Unknown command: '${command}'. Type 'help'.`,
            { typeClass: "text-error" }
        );
    }
  },

  /**
   * Process a dialogue editing command
   * @private
   * @param {string} input - User input command
   */
  async _processDialogueCreatorCommand(input) {
    const [command, ...args] = input.trim().split(/\s+/);
    const joinedArgs = args.join(" ");

    switch (command.toLowerCase()) {
      case "node":
        await this._handleNodeCommand(args);
        break;
      case "choice":
        await this._handleChoiceCommand(args);
        break;
      case "set":
        await this._handleSetDialogueProperty(joinedArgs);
        break;
      case "exit":
        this.state.dialogueEditContext = null;
        await this.dependencies.OutputManager.appendToOutput("Exited dialogue editing mode.", { typeClass: 'text-info' });
        break;
      case "help":
        await this._handleDialogueHelp();
        break;
      default:
        await this.dependencies.OutputManager.appendToOutput(`Unknown dialogue command: '${command}'. Type 'help'.`, { typeClass: "text-error" });
    }
  },

  /**
   * Generate a valid ID from a name
   * @private
   * @param {string} name - Name to convert to ID
   * @returns {string} Generated ID
   */
  _generateId(name) {
    return name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "_")
        .replace(/^_|_$/g, "");
  },

  /**
   * Handle the 'create' command
   * @private
   * @param {string[]} args - Command arguments
   */
  async _handleCreate(args) {
    const { OutputManager } = this.dependencies;
    const type = args.shift()?.toLowerCase();
    const name = args.join(" ").replace(/["']/g, "");

    if (!["room", "item", "npc"].includes(type)) {
      await OutputManager.appendToOutput(
          "Error: Must specify type: 'room', 'item', or 'npc'.",
          { typeClass: "text-error" }
      );
      return;
    }
    if (!name) {
      await OutputManager.appendToOutput(
          "Error: You must provide a name in quotes.",
          { typeClass: "text-error" }
      );
      return;
    }

    let id = this._generateId(name);
    let counter = 1;
    const collectionName = type + "s";
    this.state.adventureData[collectionName] = this.state.adventureData[collectionName] || {};

    while (this.state.adventureData[collectionName][id]) {
      id = `${this._generateId(name)}_${counter++}`;
    }

    const newEntity = { id, name, description: `A brand new ${name}.` };

    if (type === "room") {
      this.state.adventureData.rooms[id] = { ...newEntity, exits: {} };
    } else if (type === "item") {
      this.state.adventureData.items[id] = {
        ...newEntity,
        noun: name.split(" ").pop().toLowerCase(),
        location: "void",
        canTake: true,
      };
    } else if (type === "npc") {
      this.state.adventureData.npcs[id] = {
        ...newEntity,
        noun: name.split(" ").pop().toLowerCase(),
        location: "void",
        dialogue: {
          startNode: "start",
          nodes: {
            "start": {
              "npcResponse": "They have nothing to say.",
              "playerChoices": []
            }
          }
        }
      };
    }

    this.state.isDirty = true;
    await OutputManager.appendToOutput(
        `Created ${type} '${name}' with ID '${id}'.`,
        { typeClass: "text-success" }
    );
    await this._handleEdit(`${type} "${name}"`);
  },

  /**
   * Find an entity by type and name
   * @private
   * @param {string} type - Entity type (room, item, npc)
   * @param {string} name - Entity name or ID
   * @returns {Object|null} Found entity or null
   */
  _findEntity(type, name) {
    const collection = this.state.adventureData[type + "s"];
    if (!collection) return null;
    let entity = Object.values(collection).find(
        (e) => e.name.toLowerCase() === name.toLowerCase()
    );
    if (entity) return entity;
    entity = collection[name];
    if (entity) return entity;

    return null;
  },

  /**
   * Handle the 'edit' command
   * @private
   * @param {string} argString - Command arguments as string
   */
  async _handleEdit(argString) {
    const { OutputManager } = this.dependencies;
    if (!argString) {
      this.state.editContext = null;
      return;
    }
    const typeMatch = argString.match(/^(room|item|npc)\s+/i);
    if (!typeMatch) {
      this.state.editContext = null;
      return;
    }
    const type = typeMatch[1].toLowerCase();
    const name = argString.substring(type.length).trim().replace(/["']/g, "");

    const entity = this._findEntity(type, name);

    if (entity) {
      this.state.editContext = { type, id: entity.id, name: entity.name };
      let editMessage = `Now editing ${type} '${entity.name}'. Use 'set <prop> "<value>"'. Type 'edit' to stop editing.`;
      if (type === 'npc') {
        editMessage += "\nType 'dialogue' to edit their conversation tree.";
      }
      await OutputManager.appendToOutput(editMessage, { typeClass: "text-info" });
    } else {
      await OutputManager.appendToOutput(
          `Error: Cannot find ${type} with name '${name}'.`,
          { typeClass: "text-error" }
      );
    }
  },

  /**
   * Enter dialogue editing mode for an NPC
   * @private
   */
  async _enterDialogueEditMode() {
    const { OutputManager } = this.dependencies;
    const npc = this.state.adventureData.npcs[this.state.editContext.id];
    if (!npc.dialogue) {
      npc.dialogue = { startNode: 'start', nodes: { 'start': { npcResponse: '...', playerChoices: [] }}};
      this.state.isDirty = true;
    }
    this.state.dialogueEditContext = { npcId: npc.id, nodeId: npc.dialogue.startNode };
    await OutputManager.appendToOutput(`Entering dialogue editor for '${npc.name}'. Type 'help' for dialogue commands.`, { typeClass: 'text-success'});
    await this._handleNodeCommand(['view', npc.dialogue.startNode]);
  },

  /**
   * Handle dialogue node commands
   * @private
   * @param {string[]} args - Command arguments
   */
  async _handleNodeCommand(args) {
    const { OutputManager } = this.dependencies;
    const subCommand = args.shift()?.toLowerCase();
    const name = args.join(" ").replace(/["']/g, "");

    const npc = this.state.adventureData.npcs[this.state.dialogueEditContext.npcId];

    switch(subCommand) {
      case 'create':
        if (!name) { await OutputManager.appendToOutput("Error: Node needs a name.", {typeClass: 'text-error'}); return; }
        const nodeId = this._generateId(name);
        if (npc.dialogue.nodes[nodeId]) { await OutputManager.appendToOutput(`Error: Node '${nodeId}' already exists.`, {typeClass: 'text-error'}); return; }
        npc.dialogue.nodes[nodeId] = { npcResponse: `Response for ${name}`, playerChoices: [] };
        this.state.dialogueEditContext.nodeId = nodeId;
        this.state.isDirty = true;
        await OutputManager.appendToOutput(`Created and switched to new node '${nodeId}'.`, {typeClass: 'text-success'});
        break;
      case 'goto':
        if (!name || !npc.dialogue.nodes[name]) { await OutputManager.appendToOutput(`Error: Node '${name}' not found.`, {typeClass: 'text-error'}); return; }
        this.state.dialogueEditContext.nodeId = name;
        await this._handleNodeCommand(['view', name]);
        break;
      case 'view':
        const nodeToViewId = name || this.state.dialogueEditContext.nodeId;
        const node = npc.dialogue.nodes[nodeToViewId];
        if (!node) { await OutputManager.appendToOutput(`Error: Node '${nodeToViewId}' not found.`, {typeClass: 'text-error'}); return; }
        let output = `--- Node: ${nodeToViewId} ---\nResponse: ${node.npcResponse}\nChoices:\n`;
        if (node.playerChoices.length > 0) {
          node.playerChoices.forEach(c => {
            output += `  - Keywords: [${c.keywords.join(', ')}] -> Go to node: '${c.nextNode}'\n    Prompt: ${c.prompt}\n`;
          });
        } else {
          output += "  (No choices, conversation ends here)";
        }
        await OutputManager.appendToOutput(output);
        break;
      case 'list':
        const nodeList = Object.keys(npc.dialogue.nodes).join('\n');
        await OutputManager.appendToOutput(`Available nodes for '${npc.name}':\n${nodeList}`);
        break;
      default:
        await OutputManager.appendToOutput("Unknown node command. Use 'list', 'view', 'create', or 'goto'.", {typeClass: 'text-error'});
    }
  },

  /**
   * Handle dialogue choice commands
   * @private
   * @param {string[]} args - Command arguments
   */
  async _handleChoiceCommand(args) {
    const { OutputManager } = this.dependencies;
    const subCommand = args.shift()?.toLowerCase();
    const npc = this.state.adventureData.npcs[this.state.dialogueEditContext.npcId];
    const node = npc.dialogue.nodes[this.state.dialogueEditContext.nodeId];

    if (subCommand === 'add') {
      const joinedArgs = args.join(' ');
      const match = joinedArgs.match(/^(.+?)\s*->\s*(\S+)\s+"(.+)"$/);
      if (!match) { await OutputManager.appendToOutput("Error: Invalid format. Use: choice add <keywords> -> <nodeId> \"<prompt>\"", {typeClass: 'text-error'}); return; }
      const keywords = match[1].split(',').map(k => k.trim());
      const nextNodeId = match[2];
      const prompt = match[3];

      if (!npc.dialogue.nodes[nextNodeId]) { await OutputManager.appendToOutput(`Error: Target node '${nextNodeId}' does not exist.`, {typeClass: 'text-error'}); return; }

      node.playerChoices.push({ keywords, nextNode: nextNodeId, prompt });
      this.state.isDirty = true;
      await OutputManager.appendToOutput("Choice added.", {typeClass: 'text-success'});
    } else if (subCommand === 'remove') {
      const keywordToRemove = args[0];
      const initialLength = node.playerChoices.length;
      node.playerChoices = node.playerChoices.filter(c => !c.keywords.includes(keywordToRemove));
      if (node.playerChoices.length < initialLength) {
        this.state.isDirty = true;
        await OutputManager.appendToOutput(`Removed choice(s) associated with keyword '${keywordToRemove}'.`, {typeClass: 'text-success'});
      } else {
        await OutputManager.appendToOutput("No choice found with that keyword.", {typeClass: 'text-error'});
      }
    } else {
      await OutputManager.appendToOutput("Unknown choice command. Use 'add' or 'remove'.", {typeClass: 'text-error'});
    }
  },

  /**
   * Handle setting dialogue properties
   * @private
   * @param {string} argString - Property and value string
   */
  async _handleSetDialogueProperty(argString) {
    const { OutputManager } = this.dependencies;
    const match = argString.match(/^(\w+)\s+(.*)/);
    if (!match) { await OutputManager.appendToOutput("Invalid format. Use: set <property> \"<value>\"", {typeClass: 'text-error'}); return; }

    const prop = match[1].toLowerCase();
    const value = match[2].replace(/["']/g, "");

    const npc = this.state.adventureData.npcs[this.state.dialogueEditContext.npcId];
    const node = npc.dialogue.nodes[this.state.dialogueEditContext.nodeId];

    if (prop === 'response') {
      node.npcResponse = value;
      this.state.isDirty = true;
      await OutputManager.appendToOutput(`Set response for node '${this.state.dialogueEditContext.nodeId}'.`, {typeClass: 'text-success'});
    } else if (prop === 'startnode') {
      if (!npc.dialogue.nodes[value]) { await OutputManager.appendToOutput(`Error: Node '${value}' does not exist.`, {typeClass: 'text-error'}); return; }
      npc.dialogue.startNode = value;
      this.state.isDirty = true;
      await OutputManager.appendToOutput(`Set start node to '${value}'.`, {typeClass: 'text-success'});
    }
    else {
      await OutputManager.appendToOutput("Invalid property. Use 'response' or 'startnode'.", {typeClass: 'text-error'});
    }
  },


  /**
   * Handle the 'set' command for entity properties
   * @private
   * @param {string} argString - Property and value string
   */
  async _handleSet(argString) {
    const { OutputManager } = this.dependencies;
    if (!this.state.editContext) {
      await OutputManager.appendToOutput(
          "Error: You must 'edit' an entity before you can 'set' its properties.",
          { typeClass: "text-error" }
      );
      return;
    }

    const match = argString.match(/^(\w+)\s+(.*)/);
    if (!match) {
      await OutputManager.appendToOutput(
          'Error: Invalid format. Use: set <property> "<value>"',
          { typeClass: "text-error" }
      );
      return;
    }

    const prop = match[1].toLowerCase();
    const value = match[2].replace(/["']/g, "");

    const entity =
        this.state.adventureData[this.state.editContext.type + "s"][this.state.editContext.id];
    if (!entity) {
      await OutputManager.appendToOutput(
          "Error: Current entity context is invalid. Exiting edit mode.",
          { typeClass: "text-error" }
      );
      this.state.editContext = null;
      return;
    }

    if (Object.keys(entity).includes(prop)) {
      if (value.toLowerCase() === "true") {
        entity[prop] = true;
      } else if (value.toLowerCase() === "false") {
        entity[prop] = false;
      } else {
        entity[prop] = value;
      }
      this.state.isDirty = true;
      await OutputManager.appendToOutput(
          `Set ${prop} to "${entity[prop]}" for ${entity.name}.`,
          { typeClass: "text-success" }
      );
    } else {
      await OutputManager.appendToOutput(
          `Error: '${prop}' is not a valid property for type '${this.state.editContext.type}'.`,
          { typeClass: "text-error" }
      );
    }
  },

  /**
   * Handle the 'link' command for connecting rooms
   * @private
   * @param {string[]} args - Command arguments
   */
  async _handleLink(args) {
    const { OutputManager } = this.dependencies;
    if (args.length < 3) {
      await OutputManager.appendToOutput(
          'Error: Invalid format. Use: link "<room1>" <direction> "<room2>"',
          { typeClass: "text-error" }
      );
      return;
    }

    const [room1Name, direction, room2Name] = args.map((arg) =>
        arg.replace(/["']/g, "")
    );

    const room1 = this._findEntity("room", room1Name);
    const room2 = this._findEntity("room", room2Name);

    if (!room1 || !room2) {
      await OutputManager.appendToOutput(
          "Error: One or both rooms not found.",
          { typeClass: "text-error" }
      );
      return;
    }

    const oppositeDirection = {
      north: "south",
      south: "north",
      east: "west",
      west: "east",
      up: "down",
      down: "up",
    }[direction];
    if (!oppositeDirection) {
      await OutputManager.appendToOutput(
          `Error: Invalid direction '${direction}'.`,
          { typeClass: "text-error" }
      );
      return;
    }

    room1.exits[direction] = room2.id;
    room2.exits[oppositeDirection] = room1.id;

    this.state.isDirty = true;
    await OutputManager.appendToOutput(
        `Linked ${room1.name} (${direction}) <-> ${room2.name} (${oppositeDirection}).`,
        { typeClass: "text-success" }
    );
  },

  /**
   * Handle the 'status' command
   * @private
   */
  async _handleStatus() {
    const rooms = Object.keys(this.state.adventureData.rooms || {}).length;
    const items = Object.keys(this.state.adventureData.items || {}).length;
    const npcs = Object.keys(this.state.adventureData.npcs || {}).length;
    let status = `Adventure: ${this.state.adventureData.title || "Untitled"}
File: ${this.state.targetFilename} (${this.state.isDirty ? "UNSAVED CHANGES" : "saved"})
- Rooms: ${rooms}
- Items: ${items}
- NPCs: ${npcs}`;
    await this.dependencies.OutputManager.appendToOutput(status);
  },

  /**
   * Handle the 'save' command
   * @private
   */
  async _handleSave() {
    const { OutputManager, UserManager, FileSystemManager } = this.dependencies;
    const jsonContent = JSON.stringify(this.state.adventureData, null, 2);
    const currentUser = UserManager.getCurrentUser().name;
    const primaryGroup = UserManager.getPrimaryGroupForUser(currentUser);

    if (!primaryGroup) {
      await OutputManager.appendToOutput(
          "Critical Error: Cannot determine primary group. Save failed.",
          { typeClass: "text-error" }
      );
      return;
    }

    const saveResult = await FileSystemManager.createOrUpdateFile(
        FileSystemManager.getAbsolutePath(this.state.targetFilename),
        jsonContent,
        { currentUser, primaryGroup }
    );

    if (!saveResult.success) {
      await OutputManager.appendToOutput(
          `Error saving file: ${saveResult.error}`,
          { typeClass: "text-error" }
      );
      return;
    }

    if (await FileSystemManager.save()) {
      this.state.isDirty = false;
      await OutputManager.appendToOutput(
          `Adventure saved successfully to '${this.state.targetFilename}'.`,
          { typeClass: "text-success" }
      );
    } else {
      await OutputManager.appendToOutput(
          "Critical Error: Failed to persist file system changes.",
          { typeClass: "text-error" }
      );
    }
  },

  /**
   * Handle the 'help' command
   * @private
   */
  async _handleHelp() {
    const helpText = `Adventure Creator Commands:
  create <type> "<name>"   - Create a new room, item, or npc.
  edit <type> "<name>"     - Select an entity to modify. While editing an npc, type 'dialogue' to edit their conversation.
  edit                     - Stop editing the current entity.
  set <prop> "<value>"     - Set a property on the currently edited entity.
  link "rm1" <dir> "rm2"   - Create a two-way exit between rooms.
  status                   - Show a summary of the current adventure data.
  save                     - Save your work to the file.
  exit                     - Exit the creator (will prompt if unsaved).`;
    await this.dependencies.OutputManager.appendToOutput(helpText);
  },

  /**
   * Handle the dialogue 'help' command
   * @private
   */
  async _handleDialogueHelp() {
    const helpText = `Dialogue Editing Commands:
  node list                - List all dialogue nodes for this NPC.
  node view [nodeId]       - View details for a specific node (or the current one).
  node create "<name>"     - Create a new, empty dialogue node and switch to it.
  node goto <nodeId>       - Switch to editing an existing dialogue node.
  set response "<text>"    - Set the NPC's response for the current node.
  set startnode "<nodeId>" - Set which node begins the conversation.
  choice add <k1,k2> -> <nodeId> "<prompt>" - Add a player choice to the current node.
  choice remove <keyword>  - Remove a player choice by its keyword.
  exit                     - Return to the main entity editor.`;
    await this.dependencies.OutputManager.appendToOutput(helpText);
  },

  /**
   * Exit the adventure creator
   */
  async exit() {
    const { ModalManager, OutputManager } = this.dependencies;
    if (this.state.isDirty) {
      const confirmed = await new Promise((resolve) => {
        ModalManager.request({
          context: "terminal",
          messageLines: ["You have unsaved changes. Exit without saving?"],
          onConfirm: () => resolve(true),
          onCancel: () => resolve(false),
          options: this.state.commandContext.options,
        });
      });
      if (!confirmed) {
        await OutputManager.appendToOutput("Exit cancelled.", {
          typeClass: "text-info",
        });
        return;
      }
    }

    this.state.isActive = false;
    ModalManager.request({
      context: "terminal",
      type: "input",
      messageLines: [""],
      onConfirm: () => {},
      onCancel: () => {},
      options: {
        scriptingContext: {
          isScripting: true,
          lines: [],
          currentLineIndex: -1,
        },
      },
    });
    await OutputManager.appendToOutput("Exiting Adventure Creator.", {
      typeClass: "text-success",
    });
  },

  /**
   * Check if the creator is currently active
   * @returns {boolean} True if active
   */
  isActive: () => this.state.isActive,
};
