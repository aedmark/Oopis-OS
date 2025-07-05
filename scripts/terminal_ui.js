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
     * Renders a graphical modal dialog for confirmation.
     * @private
     */
    function _renderGraphicalModal(options) {
        const {
            messageLines,
            onConfirm,
            onCancel,
            confirmText = "OK",
            cancelText = "Cancel",
        } = options;
        const parentContainer = document.getElementById('terminal-bezel'); // Use bezel for centering
        if (!parentContainer) {
            console.error("ModalManager: Cannot find terminal-bezel to attach modal.");
            if (options.onCancel) options.onCancel();
            return;
        }

        const removeModal = () => {
            const modal = document.getElementById("dynamic-modal-dialog");
            if (modal && modal.parentNode) {
                modal.parentNode.removeChild(modal);
            }
        };

        const confirmButton = Utils.createElement("button", {
            className: "btn btn--confirm",
            textContent: confirmText,
        });
        const cancelButton = Utils.createElement("button", {
            className: "btn btn--cancel",
            textContent: cancelText,
        });

        const confirmHandler = () => {
            removeModal();
            if (onConfirm) onConfirm();
        };

        const cancelHandler = () => {
            removeModal();
            if (onCancel) onCancel();
        };

        confirmButton.addEventListener('click', confirmHandler);
        cancelButton.addEventListener('click', cancelHandler);

        const buttonContainer = Utils.createElement("div", { className: "modal-dialog__buttons" }, [confirmButton, cancelButton]);
        const messageContainer = Utils.createElement("div");
        messageLines.forEach((line) => {
            messageContainer.appendChild(Utils.createElement("p", { textContent: line }));
        });

        // The modal itself is now wrapped in an overlay
        const modalDialog = Utils.createElement("div", { className: "modal-dialog" }, [messageContainer, buttonContainer]);
        const modalOverlay = Utils.createElement("div", { id: "dynamic-modal-dialog", className: "modal-overlay" }, [modalDialog]);

        parentContainer.appendChild(modalOverlay);
    }

    /**
     * Renders a graphical modal with a text input field.
     * @private
     */
    function _renderGraphicalInputModal(options) {
        const {
            messageLines,
            onConfirm,
            onCancel,
            confirmText = "OK",
            cancelText = "Cancel",
            placeholder = ""
        } = options;

        const parentContainer = document.getElementById('terminal-bezel');
        if (!parentContainer) {
            if (onCancel) onCancel();
            return;
        }

        const removeModal = () => {
            const modal = document.getElementById("dynamic-modal-dialog");
            if (modal && modal.parentNode) {
                modal.parentNode.removeChild(modal);
            }
        };

        const inputField = Utils.createElement('input', {
            type: 'text',
            placeholder: placeholder,
            className: 'modal-dialog__input'
        });

        const confirmButton = Utils.createElement("button", { className: "btn btn--confirm", textContent: confirmText });
        const cancelButton = Utils.createElement("button", { className: "btn btn--cancel", textContent: cancelText });

        const handleConfirm = () => {
            const value = inputField.value;
            if (onConfirm) onConfirm(value);
            removeModal();
        };

        const handleCancel = () => {
            if (onCancel) onCancel();
            removeModal();
        };

        confirmButton.addEventListener('click', handleConfirm);
        cancelButton.addEventListener('click', handleCancel);

        inputField.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                handleConfirm();
            } else if (e.key === 'Escape') {
                handleCancel();
            }
        });

        const buttonContainer = Utils.createElement("div", { className: "modal-dialog__buttons" }, [confirmButton, cancelButton]);
        const messageContainer = Utils.createElement("div");
        messageLines.forEach(line => {
            messageContainer.appendChild(Utils.createElement("p", { textContent: line }));
        });

        const modalDialog = Utils.createElement("div", { className: "modal-dialog" }, [messageContainer, inputField, buttonContainer]);
        const modalOverlay = Utils.createElement("div", { id: "dynamic-modal-dialog", className: "modal-overlay" }, [modalDialog]);

        parentContainer.appendChild(modalOverlay);
        inputField.focus();
    }

    /**
     * Renders a text-based confirmation prompt in the terminal output.
     * @private
     */
    function _renderTerminalPrompt(options) {
        if (isAwaitingTerminalInput) {
            if (options.onCancel) options.onCancel();
            return;
        }
        isAwaitingTerminalInput = true;
        activeModalContext = { onConfirm: options.onConfirm, onCancel: options.onCancel, data: options.data || {} };
        options.messageLines.forEach((line) => void OutputManager.appendToOutput(line, { typeClass: 'text-warning' }));
        void OutputManager.appendToOutput(Config.MESSAGES.CONFIRMATION_PROMPT, { typeClass: 'text-subtle' });

        const inputLineContainer = document.querySelector('.terminal__input-line');
        if (inputLineContainer) inputLineContainer.classList.remove('hidden');

        TerminalUI.setInputState(true);
        TerminalUI.focusInput();
        TerminalUI.clearInput();

        const outputDiv = document.getElementById('output');
        if (outputDiv) outputDiv.scrollTop = outputDiv.scrollHeight;
    }

    /**
     * The main entry point for requesting a modal.
     * @param {object} options - The options for the modal request.
     * @param {'graphical'|'graphical-input'|'terminal'} options.context - The type of modal to display.
     */
    function request(options) {
        if (options.options?.stdinContent) {
            const inputLine = options.options.stdinContent.trim().split('\n')[0];
            const promptEcho = `${document.getElementById('prompt-container').textContent} `;

            // Echo prompt and response to terminal for clarity
            options.messageLines.forEach(line => void OutputManager.appendToOutput(line, { typeClass: 'text-warning' }));
            void OutputManager.appendToOutput(Config.MESSAGES.CONFIRMATION_PROMPT, { typeClass: 'text-subtle' });
            void OutputManager.appendToOutput(`${promptEcho}${inputLine}`);

            if (inputLine.toUpperCase() === 'YES') {
                if (options.onConfirm) options.onConfirm(options.data);
            } else {
                if (options.onCancel) options.onCancel(options.data);
            }
            return; // Important: Exit after handling stdin
        }
        if (options.options?.scriptingContext?.isScripting) {
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
                options.messageLines.forEach(line => void OutputManager.appendToOutput(line, { typeClass: 'text-warning' }));
                void OutputManager.appendToOutput(Config.MESSAGES.CONFIRMATION_PROMPT, { typeClass: 'text-subtle' });
                const promptEcho = `${document.getElementById('prompt-container').textContent} `;
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

        switch (options.context) {
            case 'graphical':
                _renderGraphicalModal(options);
                break;
            case 'graphical-input':
                _renderGraphicalInputModal(options);
                break;
            default:
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
        const promptString = `${document.getElementById('prompt-container').textContent} `;
        await OutputManager.appendToOutput(`${promptString}${input.trim()}`);
        if (input.trim() === "YES") {
            await activeModalContext.onConfirm(activeModalContext.data);
        } else {
            if (typeof activeModalContext.onCancel === "function") {
                await activeModalContext.onCancel(activeModalContext.data);
            } else {
                await OutputManager.appendToOutput(Config.MESSAGES.OPERATION_CANCELLED, { typeClass: 'text-subtle' });
            }
        }
        isAwaitingTerminalInput = false;
        activeModalContext = null;
        return true;
    }

    return { request, handleTerminalInput, isAwaiting: () => isAwaitingTerminalInput };
})();

// ... (The rest of terminal_ui.js remains unchanged) ...
const TerminalUI = (() => {
    "use strict";
    /** @private @type {boolean} */
    let isNavigatingHistory = false;
    /** @private @type {boolean} */
    let _isObscuredInputMode = false;

    /**
     * Updates the command prompt based on the PS1 environment variable or default settings.
     */
    function updatePrompt() {
        const user = UserManager.getCurrentUser() || { name: Config.USER.DEFAULT_NAME };
        const ps1 = EnvironmentManager.get('PS1');
        const promptContainer = document.getElementById('prompt-container');
        if (!promptContainer) return;

        if (ps1) {
            const host = EnvironmentManager.get('HOST') || Config.OS.DEFAULT_HOST_NAME;
            const path = FileSystemManager.getCurrentPath() || Config.FILESYSTEM.ROOT_PATH;
            const homeDir = `/home/${user.name}`;
            const displayPath = path.startsWith(homeDir) ? `~${path.substring(homeDir.length)}` : path;

            let parsedPrompt = ps1.replace(/\\u/g, user.name)
                .replace(/\\h/g, host)
                .replace(/\\w/g, displayPath)
                .replace(/\\W/g, path.substring(path.lastIndexOf('/') + 1) || '/')
                .replace(/\\$/g, user.name === 'root' ? '#' : '$')
                .replace(/\\s/g, "OopisOS")
                .replace(/\\\\/g, '\\');

            promptContainer.textContent = parsedPrompt;
        } else {
            const path = FileSystemManager.getCurrentPath();
            const promptChar = user.name === 'root' ? '#' : Config.TERMINAL.PROMPT_CHAR;
            promptContainer.textContent = `${user.name}${Config.TERMINAL.PROMPT_AT}${Config.OS.DEFAULT_HOST_NAME}${Config.TERMINAL.PROMPT_SEPARATOR}${path}${promptChar} `;
        }
    }


    /**
     * Sets focus to the main terminal input element.
     */
    function focusInput() {
        const editableInputDiv = document.getElementById('editable-input');
        if (editableInputDiv && editableInputDiv.contentEditable === "true") {
            editableInputDiv.focus();
            if (editableInputDiv.textContent.length === 0)
                setCaretToEnd(editableInputDiv);
        }
    }

    /**
     * Clears all text from the terminal input element.
     */
    function clearInput() {
        const editableInputDiv = document.getElementById('editable-input');
        if (editableInputDiv) editableInputDiv.textContent = "";
    }

    /**
     * Gets the current text content of the terminal input element.
     * @returns {string}
     */
    function getCurrentInputValue() {
        const editableInputDiv = document.getElementById('editable-input');
        return editableInputDiv ? editableInputDiv.textContent : "";
    }

    /**
     * Sets the text content of the terminal input element.
     * @param {string} value - The text to set.
     * @param {boolean} [setAtEnd=true] - If true, the caret is moved to the end of the new text.
     */
    function setCurrentInputValue(value, setAtEnd = true) {
        const editableInputDiv = document.getElementById('editable-input');
        if (editableInputDiv) {
            editableInputDiv.textContent = value;
            if (setAtEnd) setCaretToEnd(editableInputDiv);
        }
    }

    /**
     * Utility function to move the caret to the end of a content-editable element.
     * @param {HTMLElement} element - The element to set the caret in.
     */
    function setCaretToEnd(element) {
        if (!element || typeof window.getSelection === "undefined" || typeof document.createRange === "undefined") return;
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
        if (!element || typeof position !== "number" || typeof window.getSelection === "undefined" || typeof document.createRange === "undefined") return;
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
        const editableInputDiv = document.getElementById('editable-input');
        if (editableInputDiv) {
            editableInputDiv.contentEditable = isEditable ? "true" : "false";
            editableInputDiv.style.opacity = isEditable ? "1" : "0.5";
            _isObscuredInputMode = obscured;
            if (!isEditable) editableInputDiv.blur();
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
        const editableInputDiv = document.getElementById('editable-input');
        let start, end;
        if (sel && sel.rangeCount > 0) {
            const range = sel.getRangeAt(0);
            if (editableInputDiv && editableInputDiv.contains(range.commonAncestorContainer)) {
                const preSelectionRange = range.cloneRange();
                preSelectionRange.selectNodeContents(editableInputDiv);
                preSelectionRange.setEnd(range.startContainer, range.startOffset);
                start = preSelectionRange.toString().length;
                end = start + range.toString().length;
            } else {
                start = end = getCurrentInputValue().length;
            }
        } else {
            start = end = getCurrentInputValue().length;
        }
        return { start, end };
    }
    /**
     * Handles pasted text when an obscured input is active.
     * @param {string} pastedText - The text copied from the clipboard.
     */
    function handlePaste(pastedText) {
        if (!_isAwaitingInput || !_inputContext) return;

        // Determine current cursor position to insert text correctly
        const selection = TerminalUI.getSelection();
        let { start, end } = selection;

        let inputArray = Array.from(_inputContext.currentInput);
        inputArray.splice(start, end - start, pastedText); // Replace selected text with pasted text

        _inputContext.currentInput = inputArray.join("");
        const displayText = _inputContext.isObscured ? "*".repeat(_inputContext.currentInput.length) : _inputContext.currentInput;

        TerminalUI.setCurrentInputValue(displayText, false); // Set display value without moving caret
        TerminalUI.setCaretPosition(document.getElementById('editable-input'), start + pastedText.length); // Reposition caret
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
        handlePaste,
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
        if (options.stdinContent) {
            const inputLine = options.stdinContent.trim().split('\n')[0];
            if (promptMessage) {
                void OutputManager.appendToOutput(promptMessage, { typeClass: 'text-subtle' });
            }
            const echoInput = isObscured ? '*'.repeat(inputLine.length) : inputLine;
            const promptEcho = `${document.getElementById('prompt-container').textContent} `;
            void OutputManager.appendToOutput(`${promptEcho}${echoInput}`);
            onInputReceivedCallback(inputLine);
            return;
        }
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
                if (promptMessage) {
                    void OutputManager.appendToOutput(promptMessage, { typeClass: 'text-subtle' });
                }
                const echoInput = isObscured ? '*'.repeat(inputLine.length) : inputLine;
                const promptEcho = `${document.getElementById('prompt-container').textContent} `;
                void OutputManager.appendToOutput(`${promptEcho}${echoInput}`);
                onInputReceivedCallback(inputLine);
            } else {
                void OutputManager.appendToOutput("Script ended while awaiting input.", { typeClass: 'text-error' });
                if (onCancelledCallback) onCancelledCallback();
            }
            return;
        }
        if (_isAwaitingInput) {
            void OutputManager.appendToOutput("Another modal input prompt is already pending.", { typeClass: 'text-warning' });
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
        const inputLineContainer = document.querySelector('.terminal__input-line');
        if (inputLineContainer) inputLineContainer.classList.remove('hidden');

        if (promptMessage) {
            void OutputManager.appendToOutput(promptMessage, { typeClass: 'text-subtle' });
        }
        TerminalUI.clearInput();
        TerminalUI.setInputState(true, isObscured); // --- Pass obscured status to setInputState ---
        TerminalUI.focusInput();

        const outputDiv = document.getElementById('output');
        if (outputDiv) outputDiv.scrollTop = outputDiv.scrollHeight;
    }

    /**
     * Handles the final input submission when the user presses Enter.
     * @returns {Promise<boolean>} A promise that resolves to true if input was successfully handled.
     * @async
     */
    async function handleInput() {
        if (!_isAwaitingInput || !_inputContext) return false;
        const finalInput = _inputContext.isObscured ? _inputContext.currentInput : TerminalUI.getCurrentInputValue();
        const callback = _inputContext.onInputReceived;
        _isAwaitingInput = false;
        _inputContext = null;
        TerminalUI.setInputState(true, false); // --- REVERT STATE ON COMPLETION ---
        TerminalUI.clearInput();
        if (typeof callback === "function") {
            await callback(finalInput.trim());
        }
        return true;
    }

    /**
     * Manually updates the input state when in obscured (password) mode.
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
        const displayText = _inputContext.isObscured ? "*".repeat(_inputContext.currentInput.length) : _inputContext.currentInput;
        TerminalUI.setCurrentInputValue(displayText, false);
        TerminalUI.setCaretPosition(document.getElementById('editable-input'), start);
    }

    // --- NEW FUNCTION TO HANDLE PASTING ---
    function handlePaste(pastedText) {
        if (!_isAwaitingInput || !_inputContext) return;

        // This function is now called directly from the paste event listener in main.js
        const selection = TerminalUI.getSelection();
        let { start, end } = selection;

        let inputArray = Array.from(_inputContext.currentInput);
        inputArray.splice(start, end - start, pastedText);

        _inputContext.currentInput = inputArray.join("");
        const displayText = _inputContext.isObscured ? "*".repeat(_inputContext.currentInput.length) : _inputContext.currentInput;

        TerminalUI.setCurrentInputValue(displayText, false);
        TerminalUI.setCaretPosition(document.getElementById('editable-input'), start + pastedText.length);
    }
    // --- END NEW FUNCTION ---

    return {
        requestInput,
        handleInput,
        updateInput,
        isAwaiting: () => _isAwaitingInput,
        isObscured,
        handlePaste, // --- EXPOSE NEW FUNCTION ---
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
     * Analyzes the input string to determine the context for completion.
     * This version correctly handles single and double quoted arguments.
     * @private
     * @param {string} fullInput - The entire current input string.
     * @param {number} cursorPos - The current cursor position.
     * @returns {{commandName: string, isCompletingCommand: boolean, currentWordPrefix: string, startOfWordIndex: number, currentWordLength: number, isQuoted: boolean, quoteChar: string|null}}
     */
    function _getCompletionContext(fullInput, cursorPos) {
        // Tokenize the input string, respecting quotes.
        const tokens = (fullInput.match(/(?:[^\s"']+|"[^"]*"|'[^']*')+/g) || []);
        const commandName = tokens.length > 0 ? tokens[0].replace(/["']/g, '') : "";

        const textBeforeCursor = fullInput.substring(0, cursorPos);

        let startOfWordIndex = 0;
        let inQuote = null;
        for (let i = 0; i < textBeforeCursor.length; i++) {
            const char = textBeforeCursor[i];
            if (inQuote && char === inQuote && textBeforeCursor[i-1] !== '\\') {
                inQuote = null;
            } else if (!inQuote && (char === '"' || char === "'") && (i === 0 || textBeforeCursor[i-1] === ' ' || textBeforeCursor[i-1] === undefined)) {
                inQuote = char;
            }

            if (char === ' ' && !inQuote) {
                startOfWordIndex = i + 1;
            }
        }

        const currentWordWithQuotes = fullInput.substring(startOfWordIndex, cursorPos);
        const quoteChar = currentWordWithQuotes.startsWith("'") ? "'" : currentWordWithQuotes.startsWith('"') ? '"' : null;
        const currentWordPrefix = quoteChar ? currentWordWithQuotes.substring(1) : currentWordWithQuotes;
        const isQuoted = !!quoteChar;

        const isCompletingCommand = tokens.length === 0 || (tokens.length === 1 && !fullInput.substring(0, tokens[0].length).includes(' '));

        return {
            commandName,
            isCompletingCommand,
            currentWordPrefix,
            startOfWordIndex,
            currentWordLength: currentWordWithQuotes.length,
            isQuoted,
            quoteChar
        };
    }

    /**
     * Gets a list of potential suggestions based on the completion context.
     * @private
     * @param {object} context - The completion context from `_getCompletionContext`.
     * @returns {Promise<string[]>} An array of sorted suggestion strings.
     */
    async function _getSuggestionsFromProvider(context) {
        const { currentWordPrefix, isCompletingCommand, commandName } = context;
        let suggestions = [];

        if (isCompletingCommand) {
            suggestions = Config.COMMANDS_MANIFEST
                .filter((cmd) => cmd.toLowerCase().startsWith(currentWordPrefix.toLowerCase()))
                .sort();
        } else {
            const commandLoaded = await CommandExecutor._ensureCommandLoaded(commandName);
            if (!commandLoaded) return [];

            const commandDefinition = CommandExecutor.getCommands()[commandName]?.handler.definition;
            if (!commandDefinition) return [];

            if (commandDefinition.completionType === "commands") {
                suggestions = Config.COMMANDS_MANIFEST
                    .filter((cmd) => cmd.toLowerCase().startsWith(currentWordPrefix.toLowerCase()))
                    .sort();
            } else if (commandDefinition.completionType === "users") {
                const users = StorageManager.loadItem(Config.STORAGE_KEYS.USER_CREDENTIALS, "User list", {});
                const userNames = Object.keys(users);
                if (!userNames.includes(Config.USER.DEFAULT_NAME)) userNames.push(Config.USER.DEFAULT_NAME);
                suggestions = userNames
                    .filter((name) => name.toLowerCase().startsWith(currentWordPrefix.toLowerCase()))
                    .sort();
            }
            else if (commandDefinition.pathValidation) {
                const lastSlashIndex = currentWordPrefix.lastIndexOf(Config.FILESYSTEM.PATH_SEPARATOR);
                const pathPrefixForFS = lastSlashIndex !== -1 ? currentWordPrefix.substring(0, lastSlashIndex + 1) : "";
                const segmentToMatchForFS = lastSlashIndex !== -1 ? currentWordPrefix.substring(lastSlashIndex + 1) : currentWordPrefix;

                const effectiveBasePathForFS = FileSystemManager.getAbsolutePath(pathPrefixForFS, FileSystemManager.getCurrentPath());
                const baseNode = FileSystemManager.getNodeByPath(effectiveBasePathForFS);
                const currentUser = UserManager.getCurrentUser().name;

                if (baseNode && baseNode.type === Config.FILESYSTEM.DEFAULT_DIRECTORY_TYPE && FileSystemManager.hasPermission(baseNode, currentUser, "read")) {
                    suggestions = Object.keys(baseNode.children)
                        .filter((name) => name.toLowerCase().startsWith(segmentToMatchForFS.toLowerCase()))
                        .map((name) => pathPrefixForFS + name)
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
     * @returns {Promise<{textToInsert: string|null, newCursorPos?: number}>} An object with the text to insert, or null if no action is taken.
     */
    async function handleTab(fullInput, cursorPos) {
        if (fullInput !== lastCompletionInput) {
            resetCycle();
        }

        const context = _getCompletionContext(fullInput, cursorPos);

        if (suggestionsCache.length === 0) {
            const suggestions = await _getSuggestionsFromProvider(context);
            if (!suggestions || suggestions.length === 0) {
                resetCycle();
                return { textToInsert: null };
            }
            if (suggestions.length === 1) {
                const completion = suggestions[0];
                const completedNode = FileSystemManager.getNodeByPath(FileSystemManager.getAbsolutePath(completion));
                const isDirectory = completedNode && completedNode.type === Config.FILESYSTEM.DEFAULT_DIRECTORY_TYPE;

                const finalCompletion = completion + (isDirectory ? '/' : ' ');
                const textBefore = fullInput.substring(0, context.startOfWordIndex);
                const textAfter = fullInput.substring(cursorPos);

                let newText = textBefore + finalCompletion + textAfter;

                resetCycle();
                return { textToInsert: newText, newCursorPos: (textBefore + finalCompletion).length };
            }

            const lcp = findLongestCommonPrefix(suggestions);
            if (lcp && lcp.length > context.currentWordPrefix.length) {
                const textBefore = fullInput.substring(0, context.startOfWordIndex);
                const textAfter = fullInput.substring(cursorPos);
                let newText = textBefore + lcp + textAfter;

                lastCompletionInput = newText;
                return { textToInsert: newText, newCursorPos: (textBefore + lcp).length };
            } else {
                suggestionsCache = suggestions;
                cycleIndex = -1;
                lastCompletionInput = fullInput;
                const promptText = `${document.getElementById('prompt-container').textContent} `;
                void OutputManager.appendToOutput(`${promptText}${fullInput}`, { isCompletionSuggestion: true });
                void OutputManager.appendToOutput(suggestionsCache.join("    "), { typeClass: 'text-subtle', isCompletionSuggestion: true });
                const outputDiv = document.getElementById('output');
                if (outputDiv) outputDiv.scrollTop = outputDiv.scrollHeight;
                return { textToInsert: null };
            }
        } else {
            cycleIndex = (cycleIndex + 1) % suggestionsCache.length;
            const nextSuggestion = suggestionsCache[cycleIndex];
            const completedNode = FileSystemManager.getNodeByPath(FileSystemManager.getAbsolutePath(nextSuggestion));
            const isDirectory = completedNode && completedNode.type === Config.FILESYSTEM.DEFAULT_DIRECTORY_TYPE;

            const textBefore = fullInput.substring(0, context.startOfWordIndex);
            const textAfter = fullInput.substring(cursorPos);
            const completionText = nextSuggestion + (isDirectory ? '/' : ' ');
            let newText = textBefore + completionText + textAfter;

            lastCompletionInput = newText;
            return { textToInsert: newText, newCursorPos: (textBefore + completionText).length };
        }
    }
    return {
        handleTab,
        resetCycle,
    };
})();

/**
 * @module AppLayerManager
 * @description Manages the display layer for full-screen applications like edit, paint, and chidi.
 * It ensures only one app is active at a time and handles showing/hiding the terminal UI.
 */
const AppLayerManager = (() => {
    "use strict";
    let appLayer = null;
    let terminalOutput = null;
    let terminalInputContainer = null;
    let isActive = false;
    let currentAppContainer = null;

    // Cache DOM elements on first use
    function _cacheDOM() {
        if (!appLayer) appLayer = document.getElementById('app-layer');
        if (!terminalOutput) terminalOutput = document.getElementById('output');
        if (!terminalInputContainer) terminalInputContainer = document.querySelector('.terminal__input-line');
    }

    /**
     * Displays a full-screen application, hiding the standard terminal UI.
     * @param {HTMLElement} appContainerElement - The main container element of the application to display.
     */
    function show(appContainerElement) {
        _cacheDOM();
        if (isActive || !appLayer || !appContainerElement) {
            console.warn("AppLayerManager: Cannot show new app, one is already active or elements are missing.");
            return;
        }

        TerminalUI.setInputState(false);
        OutputManager.setEditorActive(true);

        if (terminalOutput) terminalOutput.classList.add('hidden');
        if (terminalInputContainer) terminalInputContainer.classList.add('hidden');

        currentAppContainer = appContainerElement;
        if (!currentAppContainer.parentNode) {
            appLayer.appendChild(currentAppContainer);
        }
        currentAppContainer.classList.remove('hidden');
        appLayer.classList.remove('hidden');
        isActive = true;
    }

    /**
     * Hides the currently active full-screen application and restores the terminal UI.
     */
    function hide() {
        _cacheDOM();
        if (!isActive || !appLayer) return;

        appLayer.classList.add('hidden');
        if (currentAppContainer && appLayer.contains(currentAppContainer)) {
            // Instead of removing, just hide it so it can be re-shown
            currentAppContainer.remove();
        }

        currentAppContainer = null;

        if (terminalOutput) terminalOutput.classList.remove('hidden');
        if (terminalInputContainer) terminalInputContainer.classList.remove('hidden');

        TerminalUI.clearInput();
        TerminalUI.setInputState(true);
        OutputManager.setEditorActive(false);
        TerminalUI.focusInput();

        isActive = false;
    }

    return {
        show,
        hide,
        isActive: () => isActive,
    };
})();