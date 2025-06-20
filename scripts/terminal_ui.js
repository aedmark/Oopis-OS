/**
 * @file Manages all terminal UI components and interactions, including modals,
 * the command prompt, user input, and tab completion.
 * @module TerminalUI-All
 */

/**
 * @module ModalManager
 * @description Handles requests for confirmation dialogs, supporting both graphical modals
 * (for full-screen apps like the editor) and terminal-based (Y/N) prompts.
 * It is also aware of scripting and can automate responses.
 */
const ModalManager = (() => {
    "use strict";
    /** @private @type {boolean} */
    let isAwaitingTerminalInput = false;
    /** @private @type {object|null} */
    let activeModalContext = null;

    /**
     * Renders a graphical modal dialog, typically used by full-screen applications like the editor.
     * @private
     * @param {object} options - Configuration for the modal.
     * @param {string[]} options.messageLines - The lines of text to display in the modal.
     * @param {function} options.onConfirm - Callback to execute when the confirm button is clicked.
     * @param {function} options.onCancel - Callback to execute when the cancel button is clicked.
     * @param {string} [options.confirmText="OK"] - Text for the confirm button.
     * @param {string} [options.cancelText="Cancel"] - Text for the cancel button.
     */
    function _renderGraphicalModal(options) {
        const {
            messageLines,
            onConfirm,
            onCancel,
            confirmText = "OK",
            cancelText = "Cancel",
        } = options;
        const parentContainer = DOM.terminalBezel;
        if (!parentContainer) {
            console.error(
                "ModalManager: Cannot find terminal-bezel to attach modal."
            );
            if (options.onCancel) options.onCancel();
            return;
        }
        const originalParentPosition = parentContainer.style.position;
        if (window.getComputedStyle(parentContainer).position === "static") {
            parentContainer.style.position = "relative";
        }
        const removeModal = () => {
            const modal = document.getElementById("editor-modal-dialog");
            if (modal && modal.parentNode) {
                modal.parentNode.removeChild(modal);
            }
            parentContainer.style.position = originalParentPosition;
        };
        const confirmButton = Utils.createElement("button", {
            className: "btn-editor-modal btn-confirm",
            textContent: confirmText,
            eventListeners: {
                click: () => {
                    removeModal();
                    if (onConfirm) onConfirm();
                },
            },
        });
        const cancelButton = Utils.createElement("button", {
            className: "btn-editor-modal btn-cancel",
            textContent: cancelText,
            eventListeners: {
                click: () => {
                    removeModal();
                    if (onCancel) onCancel();
                },
            },
        });
        const buttonContainer = Utils.createElement(
            "div",
            {
                className: "editor-modal-buttons",
            },
            [confirmButton, cancelButton]
        );
        const messageContainer = Utils.createElement("div");
        messageLines.forEach((line) => {
            messageContainer.appendChild(
                Utils.createElement("p", {
                    textContent: line,
                })
            );
        });
        const modalDialog = Utils.createElement(
            "div",
            {
                id: "editor-modal-dialog",
            },
            [messageContainer, buttonContainer]
        );
        parentContainer.appendChild(modalDialog);
    }

    /**
     * Renders a text-based confirmation prompt in the terminal output.
     * @private
     * @param {object} options - Configuration for the prompt.
     */
    function _renderTerminalPrompt(options) {
        if (isAwaitingTerminalInput) {
            void OutputManager.appendToOutput(
                "ModalManager: Another terminal prompt is already active.",
                {
                    typeClass: Config.CSS_CLASSES.WARNING_MSG,
                }
            );
            if (options.onCancel) options.onCancel();
            return;
        }
        isAwaitingTerminalInput = true;
        activeModalContext = {
            onConfirm: options.onConfirm,
            onCancel: options.onCancel,
            data: options.data || {},
        };
        options.messageLines.forEach((line) => {
            void OutputManager.appendToOutput(line, {
                typeClass: Config.CSS_CLASSES.WARNING_MSG,
            });
        });
        void OutputManager.appendToOutput(Config.MESSAGES.CONFIRMATION_PROMPT, {
            typeClass: Config.CSS_CLASSES.CONSOLE_LOG_MSG,
        });
        if (DOM.inputLineContainerDiv) {
            DOM.inputLineContainerDiv.classList.remove(Config.CSS_CLASSES.HIDDEN);
        }
        TerminalUI.setInputState(true);
        TerminalUI.focusInput();
        TerminalUI.clearInput();
        if (DOM.outputDiv) {
            DOM.outputDiv.scrollTop = DOM.outputDiv.scrollHeight;
        }
    }

    /**
     * The main entry point for requesting a confirmation modal. It intelligently handles
     * scripted, graphical, and terminal-based requests.
     * @param {object} options - The options for the modal request.
     * @param {'graphical'|'terminal'} options.context - The type of modal to display.
     * @param {string[]} options.messageLines - The message to display.
     * @param {function} options.onConfirm - The callback for confirmation.
     * @param {function} options.onCancel - The callback for cancellation.
     * @param {object} [options.data] - Extra data to pass to the callbacks.
     * @param {object} [options.options] - Nested options from the command context, which may contain a `scriptingContext`.
     */
    function request(options) {
        // Handle automated input from a script (`run` command).
        if (options.options && options.options.scriptingContext && options.options.scriptingContext.isScripting) {
            const scriptContext = options.options.scriptingContext;

            let inputLine = null;
            let nextLineIndex = scriptContext.currentLineIndex + 1;
            while (nextLineIndex < scriptContext.lines.length) {
                const line = scriptContext.lines[nextLineIndex].trim();
                if (line && !line.startsWith('#')) {
                    inputLine = line;
                    scriptContext.currentLineIndex = nextLineIndex;
                    break;
                }
                nextLineIndex++;
            }

            if (inputLine !== null) {
                options.messageLines.forEach(line => void OutputManager.appendToOutput(line, { typeClass: Config.CSS_CLASSES.WARNING_MSG }));
                void OutputManager.appendToOutput(Config.MESSAGES.CONFIRMATION_PROMPT, { typeClass: Config.CSS_CLASSES.CONSOLE_LOG_MSG });
                const promptEcho = `${DOM.promptUserSpan.textContent}@${DOM.promptHostSpan.textContent}:${DOM.promptPathSpan.textContent}${DOM.promptCharSpan.textContent} `;
                void OutputManager.appendToOutput(`${promptEcho}${inputLine}`);

                if (inputLine.toUpperCase() === 'YES') {
                    if (options.onConfirm) options.onConfirm(options.data);
                } else {
                    if (options.onCancel) options.onCancel(options.data);
                }
            } else {
                if (options.onCancel) options.onCancel(options.data);
            }
            return;
        }

        // Handle interactive requests from a real user.
        if (options.context === "graphical") {
            _renderGraphicalModal(options);
        } else {
            _renderTerminalPrompt(options);
        }
    }

    /**
     * Handles the user's text input in response to a terminal-based confirmation prompt.
     * @param {string} input - The text entered by the user.
     * @returns {Promise<boolean>} A promise that resolves to true if input was handled.
     * @async
     */
    async function handleTerminalInput(input) {
        if (!isAwaitingTerminalInput) return false;
        const promptString = `${DOM.promptUserSpan.textContent}${Config.TERMINAL.PROMPT_AT}${DOM.promptHostSpan.textContent}${Config.TERMINAL.PROMPT_SEPARATOR}${DOM.promptPathSpan.textContent}${Config.TERMINAL.PROMPT_CHAR} `;
        await OutputManager.appendToOutput(`${promptString}${input.trim()}`);
        if (input.trim() === "YES") {
            await activeModalContext.onConfirm(activeModalContext.data);
        } else {
            if (typeof activeModalContext.onCancel === "function") {
                await activeModalContext.onCancel(activeModalContext.data);
            } else {
                await OutputManager.appendToOutput(
                    Config.MESSAGES.OPERATION_CANCELLED,
                    {
                        typeClass: Config.CSS_CLASSES.CONSOLE_LOG_MSG,
                    }
                );
            }
        }
        isAwaitingTerminalInput = false;
        activeModalContext = null;
        return true;
    }

    /**
     * Checks if the ModalManager is currently waiting for a terminal input.
     * @returns {boolean}
     */
    function isAwaiting() {
        return isAwaitingTerminalInput;
    }
    return {
        request,
        handleTerminalInput,
        isAwaiting,
    };
})();

/**
 * @module TerminalUI
 * @description Manages the state and appearance of the core terminal UI, including the prompt and the input line.
 */
const TerminalUI = (() => {
    "use strict";
    /** @private @type {boolean} */
    let isNavigatingHistory = false;
    /** @private @type {boolean} */
    let _isObscuredInputMode = false;

    /**
     * Updates the command prompt with the current user, host, and path.
     */
    function updatePrompt() {
        const user =
            typeof UserManager !== "undefined"
                ? UserManager.getCurrentUser()
                : {
                    name: Config.USER.DEFAULT_NAME,
                };
        if (DOM.promptUserSpan) {
            DOM.promptUserSpan.textContent = user
                ? user.name
                : Config.USER.DEFAULT_NAME;
            DOM.promptUserSpan.className = "prompt-user mr-0.5 text-sky-400";
        }
        if (DOM.promptHostSpan)
            DOM.promptHostSpan.textContent = Config.OS.DEFAULT_HOST_NAME;
        const currentPathDisplay =
            typeof FileSystemManager !== "undefined"
                ? FileSystemManager.getCurrentPath()
                : Config.FILESYSTEM.ROOT_PATH;
        if (DOM.promptPathSpan)
            DOM.promptPathSpan.textContent =
                currentPathDisplay === Config.FILESYSTEM.ROOT_PATH &&
                currentPathDisplay.length > 1
                    ? Config.FILESYSTEM.ROOT_PATH
                    : currentPathDisplay;
        if (DOM.promptCharSpan)
            DOM.promptCharSpan.textContent = Config.TERMINAL.PROMPT_CHAR;
    }

    /**
     * Sets focus to the main terminal input element.
     */
    function focusInput() {
        if (
            DOM.editableInputDiv &&
            DOM.editableInputDiv.contentEditable === "true"
        ) {
            DOM.editableInputDiv.focus();
            if (DOM.editableInputDiv.textContent.length === 0)
                setCaretToEnd(DOM.editableInputDiv);
        }
    }

    /**
     * Clears all text from the terminal input element.
     */
    function clearInput() {
        if (DOM.editableInputDiv) DOM.editableInputDiv.textContent = "";
    }

    /**
     * Gets the current text content of the terminal input element.
     * @returns {string}
     */
    function getCurrentInputValue() {
        return DOM.editableInputDiv ? DOM.editableInputDiv.textContent : "";
    }

    /**
     * Sets the text content of the terminal input element.
     * @param {string} value - The text to set.
     * @param {boolean} [setAtEnd=true] - If true, the caret is moved to the end of the new text.
     */
    function setCurrentInputValue(value, setAtEnd = true) {
        if (DOM.editableInputDiv) {
            DOM.editableInputDiv.textContent = value;
            if (setAtEnd) setCaretToEnd(DOM.editableInputDiv);
        }
    }

    /**
     * Utility function to move the caret to the end of a content-editable element.
     * @param {HTMLElement} element - The element to set the caret in.
     */
    function setCaretToEnd(element) {
        if (
            !element ||
            typeof window.getSelection === "undefined" ||
            typeof document.createRange === "undefined"
        )
            return;
        const range = document.createRange();
        const sel = window.getSelection();
        range.selectNodeContents(element);
        range.collapse(false);
        if (sel) {
            sel.removeAllRanges();
            sel.addRange(range);
        }
        element.focus();
    }

    /**
     * Utility function to set the caret to a specific character position within a content-editable element.
     * @param {HTMLElement} element - The element to set the caret in.
     * @param {number} position - The character position to move the caret to.
     */
    function setCaretPosition(element, position) {
        if (
            !element ||
            typeof position !== "number" ||
            typeof window.getSelection === "undefined" ||
            typeof document.createRange === "undefined"
        )
            return;
        const sel = window.getSelection();
        if (!sel) return;
        const range = document.createRange();
        let charCount = 0;
        let foundNode = false;

        function findTextNodeAndSet(node) {
            if (node.nodeType === Node.TEXT_NODE) {
                const nextCharCount = charCount + node.length;
                if (!foundNode && position >= charCount && position <= nextCharCount) {
                    range.setStart(node, position - charCount);
                    range.collapse(true);
                    foundNode = true;
                }
                charCount = nextCharCount;
            } else {
                for (let i = 0; i < node.childNodes.length; i++) {
                    if (findTextNodeAndSet(node.childNodes[i])) return true;
                    if (foundNode) break;
                }
            }
            return foundNode;
        }
        if (element.childNodes.length === 0 && position === 0) {
            range.setStart(element, 0);
            range.collapse(true);
            foundNode = true;
        } else findTextNodeAndSet(element);
        if (foundNode) {
            sel.removeAllRanges();
            sel.addRange(range);
        } else setCaretToEnd(element);
        element.focus();
    }

    /**
     * Enables or disables the terminal input area.
     * @param {boolean} isEditable - True to enable input, false to disable.
     * @param {boolean} [obscured=false] - True if input should be treated as a password (for internal logic).
     */
    function setInputState(isEditable, obscured = false) {
        if (DOM.editableInputDiv) {
            DOM.editableInputDiv.contentEditable = isEditable ? "true" : "false";
            DOM.editableInputDiv.style.opacity = isEditable ? "1" : "0.5";
            _isObscuredInputMode = obscured;
            if (!isEditable) DOM.editableInputDiv.blur();
        }
    }

    /**
     * Sets a flag indicating whether the user is currently navigating the command history.
     * @param {boolean} status - The new status.
     */
    function setIsNavigatingHistory(status) {
        isNavigatingHistory = status;
    }

    /**
     * Gets the status of the history navigation flag.
     * @returns {boolean}
     */
    function getIsNavigatingHistory() {
        return isNavigatingHistory;
    }

    /**
     * Gets the start and end position of the user's selection within the input div.
     * @returns {{start: number, end: number}}
     */
    function getSelection() {
        const sel = window.getSelection();
        let start, end;
        if (sel && sel.rangeCount > 0) {
            const range = sel.getRangeAt(0);
            if (
                DOM.editableInputDiv &&
                DOM.editableInputDiv.contains(range.commonAncestorContainer)
            ) {
                const preSelectionRange = range.cloneRange();
                preSelectionRange.selectNodeContents(DOM.editableInputDiv);
                preSelectionRange.setEnd(range.startContainer, range.startOffset);
                start = preSelectionRange.toString().length;
                end = start + range.toString().length;
            } else {
                start = end = getCurrentInputValue().length;
            }
        } else {
            start = end = getCurrentInputValue().length;
        }
        return {
            start,
            end,
        };
    }

    return {
        updatePrompt,
        focusInput,
        clearInput,
        setCurrentInputValue,
        getCurrentInputValue,
        setIsNavigatingHistory,
        getIsNavigatingHistory,
        setCaretPosition,
        setInputState,
        getSelection,
    };
})();

/**
 * @module ModalInputManager
 * @description Manages requests for single-line, dedicated user input, such as passwords or filenames.
 * This is distinct from general command input and confirmation modals. It also supports automated scripting.
 */
const ModalInputManager = (() => {
    "use strict";
    /** @private @type {boolean} */
    let _isAwaitingInput = false;
    /** @private @type {object|null} */
    let _inputContext = null;

    /**
     * Checks if the manager is currently awaiting input in an obscured (password) mode.
     * @returns {boolean}
     */
    function isObscured() {
        return _isAwaitingInput && _inputContext && _inputContext.isObscured;
    }

    /**
     * Requests a single line of input from the user, handling both interactive and scripted scenarios.
     * @param {string} promptMessage - The message to display to the user.
     * @param {function(string): void} onInputReceivedCallback - Callback executed with the user's input.
     * @param {function(): void} onCancelledCallback - Callback executed if the input is cancelled.
     * @param {boolean} [isObscured=false] - If true, the input will be visually obscured (for passwords).
     * @param {object} [options={}] - Options from the command context, potentially containing a `scriptingContext`.
     */
    function requestInput(promptMessage, onInputReceivedCallback, onCancelledCallback, isObscured = false, options = {}) {
        if (options.scriptingContext && options.scriptingContext.isScripting) {
            const scriptContext = options.scriptingContext;

            let inputLine = null;
            while (scriptContext.currentLineIndex < scriptContext.lines.length - 1) {
                scriptContext.currentLineIndex++;
                const line = scriptContext.lines[scriptContext.currentLineIndex].trim();
                if (line && !line.startsWith('#')) {
                    inputLine = line;
                    break;
                }
            }

            if (inputLine !== null) {
                void OutputManager.appendToOutput(promptMessage, { typeClass: Config.CSS_CLASSES.CONSOLE_LOG_MSG });
                const echoInput = isObscured ? '*'.repeat(inputLine.length) : inputLine;
                const promptEcho = `${DOM.promptUserSpan.textContent}@${DOM.promptHostSpan.textContent}:${DOM.promptPathSpan.textContent}${DOM.promptCharSpan.textContent} `;
                void OutputManager.appendToOutput(`${promptEcho}${echoInput}`);

                onInputReceivedCallback(inputLine);
            } else {
                void OutputManager.appendToOutput("Script ended while awaiting input.", { typeClass: Config.CSS_CLASSES.ERROR_MSG });
                if (onCancelledCallback) onCancelledCallback();
            }
            return;
        }

        if (_isAwaitingInput) {
            void OutputManager.appendToOutput(
                "Another modal input prompt is already pending.", {
                    typeClass: Config.CSS_CLASSES.WARNING_MSG,
                }
            );
            if (onCancelledCallback) onCancelledCallback();
            return;
        }
        _isAwaitingInput = true;
        _inputContext = {
            onInputReceived: onInputReceivedCallback,
            onCancelled: onCancelledCallback,
            isObscured: isObscured,
            currentInput: "",
        };
        if (DOM.inputLineContainerDiv) {
            DOM.inputLineContainerDiv.classList.remove(Config.CSS_CLASSES.HIDDEN);
        }
        void OutputManager.appendToOutput(promptMessage, {
            typeClass: Config.CSS_CLASSES.CONSOLE_LOG_MSG,
        });
        TerminalUI.clearInput();
        TerminalUI.setInputState(true, false);
        TerminalUI.focusInput();
        if (DOM.outputDiv) DOM.outputDiv.scrollTop = DOM.outputDiv.scrollHeight;
    }

    /**
     * Handles the final input submission when the user presses Enter.
     * @returns {Promise<boolean>} A promise that resolves to true if input was successfully handled.
     * @async
     */
    async function handleInput() {
        if (!_isAwaitingInput || !_inputContext) return false;
        const finalInput = _inputContext.isObscured
            ? _inputContext.currentInput
            : TerminalUI.getCurrentInputValue();
        const callback = _inputContext.onInputReceived;
        _isAwaitingInput = false;
        _inputContext = null;
        TerminalUI.clearInput();
        if (typeof callback === "function") {
            await callback(finalInput.trim());
        }
        return true;
    }

    /**
     * Manually updates the input state when in obscured (password) mode.
     * This is needed because the visual input is just asterisks, while the actual input is stored internally.
     * @param {string} key - The `key` property from the KeyboardEvent (e.g., 'Backspace').
     * @param {string|null} rawChar - The character to add, or null for non-character keys.
     */
    function updateInput(key, rawChar) {
        if (!_isAwaitingInput) return;
        let inputArray = Array.from(_inputContext.currentInput);
        const selection = TerminalUI.getSelection();
        let { start, end } = selection;
        if (key === "Backspace") {
            if (start === end && start > 0) {
                inputArray.splice(start - 1, 1);
                start--;
            } else if (start !== end) {
                inputArray.splice(start, end - start);
            }
        } else if (key === "Delete") {
            if (start === end && start < inputArray.length) {
                inputArray.splice(start, 1);
            } else if (start !== end) {
                inputArray.splice(start, end - start);
            }
        } else if (rawChar) {
            inputArray.splice(start, end - start, rawChar);
            start += rawChar.length;
        }
        _inputContext.currentInput = inputArray.join("");
        const displayText = _inputContext.isObscured
            ? "*".repeat(_inputContext.currentInput.length)
            : _inputContext.currentInput;
        TerminalUI.setCurrentInputValue(displayText, false);
        TerminalUI.setCaretPosition(DOM.editableInputDiv, start);
    }

    return {
        requestInput,
        handleInput,
        updateInput,
        isAwaiting: () => _isAwaitingInput,
        isObscured,
    };
})();

/**
 * @module TabCompletionManager
 * @description Manages all logic for command and file path tab completion.
 */
const TabCompletionManager = (() => {
    "use strict";
    /** @private @type {string[]} */
    let suggestionsCache = [];
    /** @private @type {number} */
    let cycleIndex = -1;
    /** @private @type {string|null} */
    let lastCompletionInput = null;

    /**
     * Resets the tab completion cycle, clearing the cache.
     */
    function resetCycle() {
        suggestionsCache = [];
        cycleIndex = -1;
        lastCompletionInput = null;
    }

    /**
     * Finds the longest common starting substring from an array of strings.
     * @private
     * @param {string[]} strs - The array of strings to compare.
     * @returns {string} The longest common prefix.
     */
    function findLongestCommonPrefix(strs) {
        if (!strs || strs.length === 0) return "";
        if (strs.length === 1) return strs[0];
        let prefix = strs[0];
        for (let i = 1; i < strs.length; i++) {
            while (strs[i].indexOf(prefix) !== 0) {
                prefix = prefix.substring(0, prefix.length - 1);
                if (prefix === "") return "";
            }
        }
        return prefix;
    }

    /**
     * Applies a completion suggestion to the input field.
     * @private
     * @param {string} fullInput - The entire current input string.
     * @param {number} startOfWordIndex - The index where the word being completed begins.
     * @param {number} currentWordPrefixLength - The length of the partial word being completed.
     * @param {string} completion - The suggestion to insert.
     * @returns {{textToInsert: string, newCursorPos: number}} The new input text and cursor position.
     */
    function _applyCompletion(
        fullInput,
        startOfWordIndex,
        currentWordPrefixLength,
        completion
    ) {
        const textBeforeWord = fullInput.substring(0, startOfWordIndex);
        const textAfterWord = fullInput.substring(
            startOfWordIndex + currentWordPrefixLength
        );
        const newText = textBeforeWord + completion + textAfterWord;
        const newCursorPos = textBeforeWord.length + completion.length;
        return {
            textToInsert: newText,
            newCursorPos,
        };
    }

    /**
     * Analyzes the input string to determine the context for completion.
     * @private
     * @param {string} fullInput - The entire current input string.
     * @param {number} cursorPos - The current cursor position.
     * @returns {{currentWordPrefix: string, startOfWordIndex: number, isCompletingCommand: boolean, commandName: string}}
     */
    function _getCompletionContext(fullInput, cursorPos) {
        const textBeforeCursor = fullInput.substring(0, cursorPos);
        const lastSpaceIndex = textBeforeCursor.lastIndexOf(" ");
        let startOfWordIndex = lastSpaceIndex === -1 ? 0 : lastSpaceIndex + 1;
        if (/\s$/.test(textBeforeCursor)) {
            startOfWordIndex = cursorPos;
        }
        const currentWordPrefix = textBeforeCursor.substring(startOfWordIndex);
        const tokens = fullInput.trimStart().split(/\s+/).filter(Boolean);
        const isCompletingCommand =
            tokens.length === 0 || (tokens.length === 1 && !/\s$/.test(fullInput));
        const commandName = isCompletingCommand ? "" : tokens[0].toLowerCase();
        return {
            currentWordPrefix,
            startOfWordIndex,
            isCompletingCommand,
            commandName,
        };
    }

    /**
     * Gets a list of potential suggestions based on the completion context.
     * @private
     * @param {object} context - The completion context from `_getCompletionContext`.
     * @returns {string[]} An array of sorted suggestion strings.
     */
    function _getSuggestionsFromProvider(context) {
        const { currentWordPrefix, isCompletingCommand, commandName } = context;
        const allCommands = CommandExecutor.getCommands();
        let suggestions = [];

        if (isCompletingCommand) {
            suggestions = Object.keys(allCommands)
                .filter((cmd) =>
                    cmd.toLowerCase().startsWith(currentWordPrefix.toLowerCase())
                )
                .sort();
        } else {
            const commandDefinition = allCommands[commandName]?.handler.definition;

            if (!commandDefinition) return [];

            if (commandName === "help" || commandName === "man") {
                suggestions = Object.keys(allCommands)
                    .filter((cmd) =>
                        cmd.toLowerCase().startsWith(currentWordPrefix.toLowerCase())
                    )
                    .sort();
            } else if (commandDefinition.completionType === "users") {
                const users = StorageManager.loadItem(
                    Config.STORAGE_KEYS.USER_CREDENTIALS,
                    "User list",
                    {}
                );
                const userNames = Object.keys(users);
                if (!userNames.includes(Config.USER.DEFAULT_NAME))
                    userNames.push(Config.USER.DEFAULT_NAME);
                suggestions = userNames
                    .filter((name) =>
                        name.toLowerCase().startsWith(currentWordPrefix.toLowerCase())
                    )
                    .sort();
            } else if (commandDefinition.pathValidation) {
                let pathPrefixForFS = "";
                let segmentToMatchForFS = "";
                const lastSlashIndex = currentWordPrefix.lastIndexOf(
                    Config.FILESYSTEM.PATH_SEPARATOR
                );

                if (lastSlashIndex !== -1) {
                    pathPrefixForFS = currentWordPrefix.substring(0, lastSlashIndex + 1);
                    segmentToMatchForFS = currentWordPrefix.substring(lastSlashIndex + 1);
                } else {
                    segmentToMatchForFS = currentWordPrefix;
                }

                const effectiveBasePathForFS = FileSystemManager.getAbsolutePath(
                    pathPrefixForFS,
                    FileSystemManager.getCurrentPath()
                );
                const baseNode = FileSystemManager.getNodeByPath(
                    effectiveBasePathForFS
                );
                const currentUser = UserManager.getCurrentUser().name;

                if (
                    baseNode &&
                    baseNode.type === Config.FILESYSTEM.DEFAULT_DIRECTORY_TYPE &&
                    FileSystemManager.hasPermission(baseNode, currentUser, "read")
                ) {
                    suggestions = Object.keys(baseNode.children)
                        .filter((name) =>
                            name.toLowerCase().startsWith(segmentToMatchForFS.toLowerCase())
                        )
                        .map((name) => {
                            const childNode = baseNode.children[name];
                            const completion = pathPrefixForFS + name;
                            return childNode.type === Config.FILESYSTEM.DEFAULT_DIRECTORY_TYPE
                                ? completion + Config.FILESYSTEM.PATH_SEPARATOR
                                : completion;
                        })
                        .sort();
                }
            }
        }
        return suggestions;
    }

    /**
     * Main handler for the Tab key press. Orchestrates the entire completion logic.
     * @param {string} fullInput - The current input string.
     * @param {number} cursorPos - The current cursor position.
     * @returns {{textToInsert: string|null, newCursorPos?: number}} An object with the text to insert, or null if no action is taken.
     */
    function handleTab(fullInput, cursorPos) {
        if (fullInput !== lastCompletionInput) {
            resetCycle();
        }
        const context = _getCompletionContext(fullInput, cursorPos);
        if (suggestionsCache.length === 0) {
            const suggestions = _getSuggestionsFromProvider(context);
            if (suggestions.length === 0) {
                resetCycle();
                return {
                    textToInsert: null,
                };
            }
            if (suggestions.length === 1) {
                const isDir = suggestions[0].endsWith(Config.FILESYSTEM.PATH_SEPARATOR);
                const completion = suggestions[0] + (isDir ? "" : " ");
                const result = _applyCompletion(
                    fullInput,
                    context.startOfWordIndex,
                    context.currentWordPrefix.length,
                    completion
                );
                resetCycle();
                return result;
            }
            const lcp = findLongestCommonPrefix(suggestions);
            if (lcp && lcp.length > context.currentWordPrefix.length) {
                const result = _applyCompletion(
                    fullInput,
                    context.startOfWordIndex,
                    context.currentWordPrefix.length,
                    lcp
                );
                lastCompletionInput = result.textToInsert;
                return result;
            } else {
                suggestionsCache = suggestions;
                cycleIndex = -1;
                lastCompletionInput = fullInput;
                const promptText = `${DOM.promptUserSpan.textContent}${Config.TERMINAL.PROMPT_AT}${DOM.promptHostSpan.textContent}${Config.TERMINAL.PROMPT_SEPARATOR}${DOM.promptPathSpan.textContent}${Config.TERMINAL.PROMPT_CHAR} `;
                void OutputManager.appendToOutput(`${promptText}${fullInput}`, {
                    isCompletionSuggestion: true,
                });
                void OutputManager.appendToOutput(suggestionsCache.join("    "), {
                    typeClass: Config.CSS_CLASSES.CONSOLE_LOG_MSG,
                    isCompletionSuggestion: true,
                });
                if (DOM.outputDiv) DOM.outputDiv.scrollTop = DOM.outputDiv.scrollHeight;
                return {
                    textToInsert: null,
                };
            }
        } else {
            cycleIndex = (cycleIndex + 1) % suggestionsCache.length;
            const nextSuggestion = suggestionsCache[cycleIndex];
            const result = _applyCompletion(
                fullInput,
                context.startOfWordIndex,
                context.currentWordPrefix.length,
                nextSuggestion
            );
            lastCompletionInput = result.textToInsert;
            return result;
        }
    }
    return {
        handleTab,
        resetCycle,
    };
})();