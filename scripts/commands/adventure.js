// scripts/commands/adventure.js

(() => {
    "use strict";

    // This object is now solely responsible for the UI and input loop of the game modal.
    const TextAdventureModal = (() => {
        let adventureModal, adventureOutput, adventureInput, adventureCloseBtn, adventureTitle;
        let isActive = false;
        let promptResolver = null;
        let sessionCompletionResolver = null; // Promise resolver to signal when the modal closes

        function _initDOM() {
            // ... (rest of _initDOM is unchanged)
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

        function show(adventureData) {
            if (!_initDOM()) return Promise.reject("DOM not ready");
            isActive = true;

            // --- START OF MODIFICATION ---
            // We return a promise that resolves when hide() is called.
            return new Promise(resolve => {
                sessionCompletionResolver = resolve;
                // --- END OF MODIFICATION ---

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
            isActive = false;

            // --- START OF MODIFICATION ---
            // When the modal hides, we resolve the promise we created in show().
            // This un-blocks the 'await' in the command's coreLogic.
            if (sessionCompletionResolver) {
                sessionCompletionResolver();
                sessionCompletionResolver = null;
            }
            // --- END OF MODIFICATION ---

            if (promptResolver) {
                promptResolver(null); // Cancel any pending input request
                promptResolver = null;
            }

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
                // When a command is entered, it's now handled by the TextAdventureEngine
            }
        }

        // This function no longer needs to know about scripting context,
        // because the engine will feed it lines one by one.
        function requestInput(promptText) {
            appendOutput(promptText, 'system');
            return new Promise(resolve => {
                promptResolver = resolve;
                adventureInput.disabled = false;
                adventureInput.focus();
            });

        }
        // ... (rest of TextAdventureModal functions: appendOutput, clearOutput, isActive are unchanged)
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
        return { show, hide, appendOutput, clearOutput, requestInput, isActive: () => isActive };
    })();

    // The Engine now receives script lines from the run command loop via processCommand
    const TextAdventureEngine = (() => {
        let adventure;
        let player;

        function startAdventure(adventureData) {
            adventure = JSON.parse(JSON.stringify(adventureData)); // Deep copy
            player = {
                currentLocation: adventure.startingRoomId,
                inventory: adventure.player?.inventory || [],
            };
            _displayCurrentRoom();
        }

        async function processCommand(command) {
            if (!command) return;
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
                case 'save': await _handleSave(); break; // Now async
                case 'load': await _handleLoad(); break; // Now async
                default: TextAdventureModal.appendOutput("I don't understand that command. Try 'help'.", 'error');
            }
            _checkWinConditions();
        }
        // ... (all other TextAdventureEngine functions like _displayCurrentRoom, _handleGo, etc. are unchanged)
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
            } else {
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
        function _findItemInInventory(name) {
            const itemId = player.inventory.find(id => adventure.items[id].name.toLowerCase() === name.toLowerCase());
            return itemId ? adventure.items[itemId] : null;
        }
        function _getItemsInRoom(roomId) {
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
        return { startAdventure, processCommand };
    })();

    const adventureCommandDefinition = {
        commandName: "adventure",
        argValidation: {
            max: 1,
            error: "Usage: adventure [path_to_adventure_file.json]",
        },
        pathValidation: [
            {
                argIndex: 0,
                optional: true,
                options: {
                    allowMissing: true, // Allow missing to handle default game
                    expectedType: Config.FILESYSTEM.DEFAULT_FILE_TYPE,
                },
            },
        ],
        coreLogic: async (context) => {
            const { args, currentUser, validatedPaths, options } = context;

            if (typeof TextAdventureModal === "undefined" || typeof TextAdventureEngine === "undefined") {
                return { success: false, error: "Adventure module is not properly loaded." };
            }
            if (TextAdventureModal.isActive()) {
                return { success: false, error: "An adventure is already in progress." };
            }

            let adventureToLoad;

            if (args.length > 0) {
                const filePath = args[0];
                const pathInfo = validatedPaths[0];

                if (pathInfo.error) return { success: false, error: pathInfo.error };
                if (!pathInfo.node) return { success: false, error: `adventure: File not found at '${filePath}'.` };
                if (!FileSystemManager.hasPermission(pathInfo.node, currentUser, "read")) {
                    return { success: false, error: `adventure: Cannot read file '${filePath}'${Config.MESSAGES.PERMISSION_DENIED_SUFFIX}` };
                }
                try {
                    adventureToLoad = JSON.parse(pathInfo.node.content);
                    if (!adventureToLoad.rooms || !adventureToLoad.startingRoomId) {
                        return { success: false, error: `adventure: Invalid adventure file format in '${filePath}'.` };
                    }
                    if (!adventureToLoad.title) adventureToLoad.title = filePath;
                } catch (e) {
                    return { success: false, error: `adventure: Error parsing adventure file '${filePath}': ${e.message}` };
                }
            } else {
                if (typeof window.sampleAdventure === "undefined") {
                    return { success: false, error: "adventure: Default game data (window.sampleAdventure) not found." };
                }
                adventureToLoad = window.sampleAdventure;
            }

            // --- START OF MODIFICATION ---
            // The `run` command's loop now waits for this entire block to complete.
            if (options.scriptingContext && options.scriptingContext.isScripting) {
                // In a script, we launch the engine but then loop, feeding it commands from the script.
                const scriptContext = options.scriptingContext;
                TextAdventureEngine.startAdventure(adventureToLoad);

                while (scriptContext.currentLineIndex < scriptContext.lines.length - 1 && TextAdventureModal.isActive()) {
                    scriptContext.currentLineIndex++;
                    const command = scriptContext.lines[scriptContext.currentLineIndex].trim();
                    if (command && !command.startsWith('#')) {
                        await TextAdventureEngine.processCommand(command);
                    }
                }
            } else {
                // In interactive mode, we show the modal and wait for it to close.
                TextAdventureEngine.startAdventure(adventureToLoad);
                await TextAdventureModal.show(adventureToLoad);
            }
            // --- END OF MODIFICATION ---

            return {
                success: true,
                output: `Adventure session for "${adventureToLoad.title || "Untitled Adventure"}" has ended.`,
                messageType: Config.CSS_CLASSES.CONSOLE_LOG_MSG,
            };
        },
    };
    const adventureDescription = "Starts a text adventure.";
    const adventureHelpText = "Usage: adventure [path_to_adventure_file.json]\n\nStarts a text adventure. If no path is specified, the default game will be loaded.";

    CommandRegistry.register("adventure", adventureCommandDefinition, adventureDescription, adventureHelpText);
})();