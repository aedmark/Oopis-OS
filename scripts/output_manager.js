const OutputManager = (() => {
    "use strict";

    let isEditorActive = false;

    const originalConsoleLog = console.log;
    const originalConsoleWarn = console.warn;
    const originalConsoleError = console.error;

    function setEditorActive(status) {
        isEditorActive = status;
    }

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

        if (
            isBackground &&
            DOM.inputLineContainerDiv &&
            !DOM.inputLineContainerDiv.classList.contains(Config.CSS_CLASSES.HIDDEN)
        ) {

            const promptText = DOM.promptContainer ? DOM.promptContainer.textContent : '> ';

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

    function clearOutput() {
        if (!isEditorActive && DOM.outputDiv) DOM.outputDiv.innerHTML = "";
    }

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

    return {
        setEditorActive,
        appendToOutput,
        clearOutput,
        initializeConsoleOverrides,
    };
})();