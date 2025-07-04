/**
 * @file Manages all output to the OopisOS terminal screen.
 * This module is responsible for appending text, clearing the screen, and overriding
 * the browser's native console methods to display their output within the terminal.
 * @module OutputManager
 */
const OutputManager = (() => {
    "use strict";

    /**
     * A flag to prevent terminal output when a full-screen application (like the editor) is active.
     * @private
     * @type {boolean}
     */
    let isEditorActive = false;

    /**
     * References to the original console methods, preserved before they are overridden.
     * This allows us to still log to the browser's developer console if needed.
     * @private
     */
    const originalConsoleLog = console.log;
    const originalConsoleWarn = console.warn;
    const originalConsoleError = console.error;

    /**
     * Sets the status of whether a full-screen editor is active, which suppresses normal terminal output.
     * @param {boolean} status - True if an editor is active, false otherwise.
     */
    function setEditorActive(status) {
        isEditorActive = status;
    }

    /**
     * Appends text to the terminal's output area.
     * This is the primary function for displaying command results, errors, and system messages.
     * @param {string} text - The text content to display.
     * @param {object} [options={}] - An object containing options for how the text is displayed.
     * @param {string|null} [options.typeClass=null] - A CSS class (or classes) to apply for styling (e.g., for errors, successes).
     * @param {boolean} [options.isBackground=false] - A flag for handling output from background processes.
     * @param {boolean} [options.isCompletionSuggestion=false] - A flag to bypass the editor-active check for tab-completion suggestions.
     * @async
     */
    async function appendToOutput(text, options = {}) {
        if (
            isEditorActive &&
            options.typeClass !== Config.CSS_CLASSES.EDITOR_MSG &&
            !options.isCompletionSuggestion
        )
            return;
        if (!DOM.outputDiv) {
            originalConsoleError(
                "OutputManager.appendToOutput: DOM.outputDiv is not defined. Message:",
                text
            );
            return;
        }
        const { typeClass = null, isBackground = false } = options;

        // If a background message appears while the user is typing, echo the current prompt and input line first
        // to avoid the new message appearing out of context.
        if (
            isBackground &&
            DOM.inputLineContainerDiv &&
            !DOM.inputLineContainerDiv.classList.contains(Config.CSS_CLASSES.HIDDEN)
        ) {
            // --- BUG FIX ---
            // The prompt is a single element (DOM.promptContainer), not composed of sub-spans.
            // This corrects the TypeError by using the actual DOM element that exists.
            const promptText = DOM.promptContainer ? DOM.promptContainer.textContent : '> ';
            // --- END FIX ---

            const currentInputVal = TerminalUI.getCurrentInputValue();
            const echoLine = Utils.createElement("div", {
                className: Config.CSS_CLASSES.OUTPUT_LINE,
                textContent: `${promptText}${currentInputVal}`,
            });
            DOM.outputDiv.appendChild(echoLine);
        }

        const lines = String(text).split("\n");
        const fragment = document.createDocumentFragment();

        for (const line of lines) {
            const lineClasses = Config.CSS_CLASSES.OUTPUT_LINE.split(" ");
            const lineAttributes = {
                classList: [...lineClasses],
                textContent: line,
            };

            if (typeClass) {
                typeClass.split(" ").forEach((cls) => {
                    if (cls) lineAttributes.classList.push(cls);
                });
            }

            fragment.appendChild(Utils.createElement("div", lineAttributes));
        }

        DOM.outputDiv.appendChild(fragment);
        DOM.outputDiv.scrollTop = DOM.outputDiv.scrollHeight;
    }

    /**
     * Clears all content from the terminal's output area.
     */
    function clearOutput() {
        if (!isEditorActive && DOM.outputDiv) DOM.outputDiv.innerHTML = "";
    }

    /**
     * Overrides `console.log` to display its output in the OopisOS terminal.
     * @private
     * @param {...*} args - The arguments passed to console.log.
     */
    function _consoleLogOverride(...args) {
        if (
            DOM.outputDiv &&
            typeof Utils !== "undefined" &&
            typeof Utils.formatConsoleArgs === "function"
        )
            void appendToOutput(`LOG: ${Utils.formatConsoleArgs(args)}`, {
                typeClass: Config.CSS_CLASSES.CONSOLE_LOG_MSG,
            });
        originalConsoleLog.apply(console, args);
    }

    /**
     * Overrides `console.warn` to display its output in the OopisOS terminal.
     * @private
     * @param {...*} args - The arguments passed to console.warn.
     */
    function _consoleWarnOverride(...args) {
        if (
            DOM.outputDiv &&
            typeof Utils !== "undefined" &&
            typeof Utils.formatConsoleArgs === "function"
        )
            void appendToOutput(`WARN: ${Utils.formatConsoleArgs(args)}`, {
                typeClass: Config.CSS_CLASSES.WARNING_MSG,
            });
        originalConsoleWarn.apply(console, args);
    }

    /**
     * Overrides `console.error` to display its output in the OopisOS terminal.
     * @private
     * @param {...*} args - The arguments passed to console.error.
     */
    function _consoleErrorOverride(...args) {
        if (
            DOM.outputDiv &&
            typeof Utils !== "undefined" &&
            typeof Utils.formatConsoleArgs === "function"
        )
            void appendToOutput(`ERROR: ${Utils.formatConsoleArgs(args)}`, {
                typeClass: Config.CSS_CLASSES.ERROR_MSG,
            });
        originalConsoleError.apply(console, args);
    }

    /**
     * Initializes the console overrides. This function should be called once at startup
     * to hijack the global console methods.
     */
    function initializeConsoleOverrides() {
        if (
            typeof Utils === "undefined" ||
            typeof Utils.formatConsoleArgs !== "function"
        ) {
            originalConsoleError(
                "OutputManager: Cannot initialize console overrides, Utils or Utils.formatConsoleArgs is not defined."
            );
            return;
        }
        console.log = _consoleLogOverride;
        console.warn = _consoleWarnOverride;
        console.error = _consoleErrorOverride;
    }

    /**
     * Public interface for the OutputManager module.
     */
    return {
        setEditorActive,
        appendToOutput,
        clearOutput,
        initializeConsoleOverrides,
    };
})();