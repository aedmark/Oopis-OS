// scripts/output_manager.js

class OutputManager {
  constructor() {
    this.isEditorActive = false;
    this.cachedOutputDiv = null;
    this.cachedInputLineContainerDiv = null;
    this.dependencies = {};
    this.originalConsoleLog = console.log;
    this.originalConsoleWarn = console.warn;
    this.originalConsoleError = console.error;
  }

  initialize(dom) {
    this.cachedOutputDiv = dom.outputDiv;
    this.cachedInputLineContainerDiv = dom.inputLineContainerDiv;
  }

  setDependencies(injectedDependencies) {
    this.dependencies = injectedDependencies;
  }

  setEditorActive(status) {
    this.isEditorActive = status;
  }

  async appendToOutput(text, options = {}) {
    const { Config, TerminalUI, Utils } = this.dependencies;
    if (
        this.isEditorActive &&
        options.typeClass !== Config.CSS_CLASSES.EDITOR_MSG &&
        !options.isCompletionSuggestion
    )
      return;
    if (!this.cachedOutputDiv) {
      this.originalConsoleError(
          "OutputManager.appendToOutput: cachedOutputDiv is not defined. Message:",
          text
      );
      return;
    }
    const { typeClass = options.messageType || null, isBackground = false, asBlock = false } = options;

    if (
        isBackground &&
        this.cachedInputLineContainerDiv &&
        !this.cachedInputLineContainerDiv.classList.contains(Config.CSS_CLASSES.HIDDEN)
    ) {
      const promptText = TerminalUI.getPromptText() || "> ";
      const currentInputVal = TerminalUI.getCurrentInputValue();
      const echoLine = Utils.createElement("div", {
        className: Config.CSS_CLASSES.OUTPUT_LINE,
        textContent: `${promptText}${currentInputVal}`,
      });
      this.cachedOutputDiv.appendChild(echoLine);
    }

    if (asBlock) {
      const blockWrapper = Utils.createElement("div", {
        className: typeClass || "",
        innerHTML: text,
      });
      this.cachedOutputDiv.appendChild(blockWrapper);
      this.cachedOutputDiv.scrollTop = this.cachedOutputDiv.scrollHeight;
      return;
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

    this.cachedOutputDiv.appendChild(fragment);
    this.cachedOutputDiv.scrollTop = this.cachedOutputDiv.scrollHeight;
  }

  clearOutput() {
    if (!this.isEditorActive && this.cachedOutputDiv) {
      while (this.cachedOutputDiv.firstChild) {
        this.cachedOutputDiv.removeChild(this.cachedOutputDiv.firstChild);
      }
    }
  }

  _consoleLogOverride(...args) {
    const { Config, Utils } = this.dependencies;
    if (
        this.cachedOutputDiv &&
        typeof Utils !== "undefined" &&
        typeof Utils.formatConsoleArgs === "function"
    )
      void this.appendToOutput(`LOG: ${Utils.formatConsoleArgs(args)}`, {
        typeClass: Config.CSS_CLASSES.CONSOLE_LOG_MSG,
      });
    this.originalConsoleLog.apply(console, args);
  }

  _consoleWarnOverride(...args) {
    const { Config, Utils } = this.dependencies;
    if (
        this.cachedOutputDiv &&
        typeof Utils !== "undefined" &&
        typeof Utils.formatConsoleArgs === "function"
    )
      void this.appendToOutput(`WARN: ${Utils.formatConsoleArgs(args)}`, {
        typeClass: Config.CSS_CLASSES.WARNING_MSG,
      });
    this.originalConsoleWarn.apply(console, args);
  }

  _consoleErrorOverride(...args) {
    const { Config, Utils } = this.dependencies;
    if (
        this.cachedOutputDiv &&
        typeof Utils !== "undefined" &&
        typeof Utils.formatConsoleArgs === "function"
    )
      void this.appendToOutput(`ERROR: ${Utils.formatConsoleArgs(args)}`, {
        typeClass: Config.CSS_CLASSES.ERROR_MSG,
      });
    this.originalConsoleError.apply(console, args);
  }

  initializeConsoleOverrides() {
    if (
        typeof this.dependencies.Utils === "undefined" ||
        typeof this.dependencies.Utils.formatConsoleArgs !== "function"
    ) {
      this.originalConsoleError(
          "OutputManager: Cannot initialize console overrides, Utils or Utils.formatConsoleArgs is not defined."
      );
      return;
    }
    console.log = this._consoleLogOverride.bind(this);
    console.warn = this._consoleWarnOverride.bind(this);
    console.error = this._consoleErrorOverride.bind(this);
  }
}