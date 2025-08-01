// scripts/terminal_ui.js

class TerminalUI {
  constructor() {
    this.isNavigatingHistory = false;
    this._isObscuredInputMode = false;
    this.elements = {};
    this.originalInputForObscure = "";
    this.dependencies = {};
  }

  initialize(dom) {
    this.elements = dom;
  }

  setDependencies(injectedDependencies) {
    this.dependencies = injectedDependencies;
  }

  updatePrompt() {
    const { UserManager, FileSystemManager, EnvironmentManager, Config } = this.dependencies;
    const user = UserManager.getCurrentUser() || {
      name: Config.USER.DEFAULT_NAME,
    };
    const ps1 = EnvironmentManager.get("PS1");

    if (!this.elements.promptContainer) return;

    if (ps1) {
      const host =
          EnvironmentManager.get("HOST") || Config.OS.DEFAULT_HOST_NAME;
      const path = FileSystemManager.getCurrentPath() || Config.FILESYSTEM.ROOT_PATH;
      const homeDir = `/home/${user.name}`;
      const displayPath = path.startsWith(homeDir)
          ? `~${path.substring(homeDir.length)}`
          : path;

      let parsedPrompt = ps1
          .replace(/\\u/g, user.name)
          .replace(/\\h/g, host)
          .replace(/\\w/g, displayPath)
          .replace(/\\W/g, path.substring(path.lastIndexOf("/") + 1) || "/")
          .replace(/\\$/g, user.name === "root" ? "#" : "$")
          .replace(/\\s/g, "OopisOS")
          .replace(/\\\\/g, "\\");

      this.elements.promptContainer.textContent = parsedPrompt;
    } else {
      const path = FileSystemManager.getCurrentPath();
      const promptChar =
          user.name === "root" ? "#" : Config.TERMINAL.PROMPT_CHAR;
      this.elements.promptContainer.textContent = `${user.name}${Config.TERMINAL.PROMPT_AT}${Config.OS.DEFAULT_HOST_NAME}${Config.TERMINAL.PROMPT_SEPARATOR}${path}${promptChar} `;
    }
  }

  getPromptText() {
    return this.elements.promptContainer ? this.elements.promptContainer.textContent : "";
  }

  focusInput() {
    if (
        this.elements.editableInputDiv &&
        this.elements.editableInputDiv.contentEditable === "true"
    ) {
      this.elements.editableInputDiv.focus();
      if (this.elements.editableInputDiv.textContent.length === 0)
        this.setCaretToEnd(this.elements.editableInputDiv);
    }
  }

  clearInput() {
    if (this.elements.editableInputDiv) this.elements.editableInputDiv.textContent = "";
    this.originalInputForObscure = "";
  }

  getCurrentInputValue() {
    return this._isObscuredInputMode
        ? this.originalInputForObscure
        : this.elements.editableInputDiv
            ? this.elements.editableInputDiv.textContent
            : "";
  }

  setCurrentInputValue(value, setAtEnd = true) {
    if (this.elements.editableInputDiv) {
      if (this._isObscuredInputMode) {
        this.originalInputForObscure = value;
        this.elements.editableInputDiv.textContent = "*".repeat(value.length);
      } else {
        this.elements.editableInputDiv.textContent = value;
      }
      if (setAtEnd) this.setCaretToEnd(this.elements.editableInputDiv);
    }
  }
  updateInputForObscure(key) {
    const selection = this.getSelection();
    let { start, end } = selection;

    if (key === "Backspace") {
      if (start === end && start > 0) {
        this.originalInputForObscure =
            this.originalInputForObscure.slice(0, start - 1) +
            this.originalInputForObscure.slice(start);
        start--;
      } else if (start !== end) {
        this.originalInputForObscure =
            this.originalInputForObscure.slice(0, start) +
            this.originalInputForObscure.slice(end);
      }
    } else if (key === "Delete") {
      if (start === end && start < this.originalInputForObscure.length) {
        this.originalInputForObscure =
            this.originalInputForObscure.slice(0, start) +
            this.originalInputForObscure.slice(start + 1);
      } else if (start !== end) {
        this.originalInputForObscure =
            this.originalInputForObscure.slice(0, start) +
            this.originalInputForObscure.slice(end);
      }
    } else if (key.length === 1) {
      this.originalInputForObscure =
          this.originalInputForObscure.slice(0, start) +
          key +
          this.originalInputForObscure.slice(end);
      start += key.length;
    }

    this.elements.editableInputDiv.textContent = "*".repeat(
        this.originalInputForObscure.length
    );
    this.setCaretPosition(this.elements.editableInputDiv, start);
  }

  setCaretToEnd(element) {
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

  setCaretPosition(element, position) {
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
    } else this.setCaretToEnd(element);
    element.focus();
  }

  setInputState(isEditable, obscured = false) {
    if (this.elements.editableInputDiv) {
      this.elements.editableInputDiv.contentEditable = isEditable ? "true" : "false";
      this.elements.editableInputDiv.style.opacity = isEditable ? "1" : "0.5";
      this._isObscuredInputMode = obscured;
      if (isEditable && obscured) {
        this.originalInputForObscure = "";
        this.elements.editableInputDiv.textContent = "";
      }
      if (!isEditable) this.elements.editableInputDiv.blur();
    }
  }

  isObscured() {
    return this._isObscuredInputMode;
  }

  setIsNavigatingHistory(status) {
    this.isNavigatingHistory = status;
  }

  getIsNavigatingHistory() {
    return this.isNavigatingHistory;
  }

  getSelection() {
    const sel = window.getSelection();
    let start, end;
    if (sel && sel.rangeCount > 0) {
      const range = sel.getRangeAt(0);
      if (
          this.elements.editableInputDiv &&
          this.elements.editableInputDiv.contains(range.commonAncestorContainer)
      ) {
        const preSelectionRange = range.cloneRange();
        preSelectionRange.selectNodeContents(this.elements.editableInputDiv);
        preSelectionRange.setEnd(range.startContainer, range.startOffset);
        start = preSelectionRange.toString().length;
        end = start + range.toString().length;
      } else {
        start = end = this.getCurrentInputValue().length;
      }
    } else {
      start = end = this.getCurrentInputValue().length;
    }
    return { start, end };
  }

  showInputLine() {
    if (this.elements.inputLineContainerDiv) {
      this.elements.inputLineContainerDiv.classList.remove(
          this.dependencies.Config.CSS_CLASSES.HIDDEN
      );
    }
  }

  hideInputLine() {
    if (this.elements.inputLineContainerDiv) {
      this.elements.inputLineContainerDiv.classList.add(
          this.dependencies.Config.CSS_CLASSES.HIDDEN
      );
    }
  }

  scrollOutputToEnd() {
    if (this.elements.outputDiv) {
      this.elements.outputDiv.scrollTop = this.elements.outputDiv.scrollHeight;
    }
  }
  handlePaste(pastedText) {
    if (this.isObscured()) {
      const selection = this.getSelection();
      let { start, end } = selection;
      this.originalInputForObscure =
          this.originalInputForObscure.slice(0, start) +
          pastedText +
          this.originalInputForObscure.slice(end);
      this.elements.editableInputDiv.textContent = "*".repeat(
          this.originalInputForObscure.length
      );
      this.setCaretPosition(this.elements.editableInputDiv, start + pastedText.length);
    } else {
      const selection = window.getSelection();
      if (!selection.rangeCount) return;
      const range = selection.getRangeAt(0);
      range.deleteContents();
      const textNode = document.createTextNode(pastedText);
      range.insertNode(textNode);
      range.setStartAfter(textNode);
      range.collapse(true);
      selection.removeAllRanges();
      selection.addRange(range);
    }
  }
}

class TabCompletionManager {
  constructor() {
    this.suggestionsCache = [];
    this.cycleIndex = -1;
    this.lastCompletionInput = null;
    this.dependencies = {};
  }

  setDependencies(injectedDependencies) {
    this.dependencies = injectedDependencies;
  }

  resetCycle() {
    this.suggestionsCache = [];
    this.cycleIndex = -1;
    this.lastCompletionInput = null;
  }

  findLongestCommonPrefix(strs) {
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

  _getCompletionContext(fullInput, cursorPos) {
    const tokens = fullInput.match(/(?:[^\s"']+|"[^"]*"|'[^']*')+/g) || [];
    const commandName = tokens.length > 0 ? tokens[0].replace(/["']/g, "") : "";
    const textBeforeCursor = fullInput.substring(0, cursorPos);
    let startOfWordIndex = 0;
    let inQuote = null;
    for (let i = 0; i < textBeforeCursor.length; i++) {
      const char = textBeforeCursor[i];
      if (inQuote && char === inQuote && textBeforeCursor[i - 1] !== "\\") {
        inQuote = null;
      } else if (
          !inQuote &&
          (char === '"' || char === "'") &&
          (i === 0 ||
              textBeforeCursor[i - 1] === " " ||
              textBeforeCursor[i - 1] === undefined)
      ) {
        inQuote = char;
      }
      if (char === " " && !inQuote) {
        startOfWordIndex = i + 1;
      }
    }
    const currentWordWithQuotes = fullInput.substring(
        startOfWordIndex,
        cursorPos
    );
    const quoteChar = currentWordWithQuotes.startsWith("'")
        ? "'"
        : currentWordWithQuotes.startsWith('"')
            ? '"'
            : null;
    const currentWordPrefix = quoteChar
        ? currentWordWithQuotes.substring(1)
        : currentWordWithQuotes;
    const isQuoted = !!quoteChar;
    const isCompletingCommand =
        tokens.length === 0 ||
        (tokens.length === 1 &&
            !fullInput.substring(0, tokens[0].length).includes(" "));
    return {
      commandName,
      isCompletingCommand,
      currentWordPrefix,
      startOfWordIndex,
      currentWordLength: currentWordWithQuotes.length,
      isQuoted,
      quoteChar,
    };
  }

  async _getSuggestionsFromProvider(context) {
    const { currentWordPrefix, isCompletingCommand, commandName } = context;
    let suggestions = [];

    const { CommandExecutor, Config, StorageManager, FileSystemManager, UserManager } = this.dependencies;

    if (isCompletingCommand) {
      suggestions = Config.COMMANDS_MANIFEST.filter((cmd) =>
          cmd.toLowerCase().startsWith(currentWordPrefix.toLowerCase())
      ).sort();
    } else {

      const commandDefinition = await CommandExecutor._ensureCommandLoaded(commandName);
      if (!commandDefinition) return [];

      if (commandDefinition.definition.completionType === "commands") {
        suggestions = Config.COMMANDS_MANIFEST.filter((cmd) =>
            cmd.toLowerCase().startsWith(currentWordPrefix.toLowerCase())
        ).sort();
      } else if (commandDefinition.definition.completionType === "users") {
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
      } else if (
          commandDefinition.definition.completionType === "paths" ||
          commandDefinition.definition.pathValidation
      ) {
        const lastSlashIndex = currentWordPrefix.lastIndexOf(
            Config.FILESYSTEM.PATH_SEPARATOR
        );
        const pathPrefixForFS =
            lastSlashIndex !== -1
                ? currentWordPrefix.substring(0, lastSlashIndex + 1)
                : "";
        const segmentToMatchForFS =
            lastSlashIndex !== -1
                ? currentWordPrefix.substring(lastSlashIndex + 1)
                : currentWordPrefix;

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
              .map((name) => pathPrefixForFS + name)
              .sort();
        }
      }
    }
    return suggestions;
  }

  async handleTab(fullInput, cursorPos) {
    const { FileSystemManager, OutputManager, TerminalUI } = this.dependencies;

    if (fullInput !== this.lastCompletionInput) {
      this.resetCycle();
    }

    const context = this._getCompletionContext(fullInput, cursorPos);

    const quoteIfNecessary = (text) => {
      if (/\s/.test(text)) {
        return `'${text}'`;
      }
      return text;
    };

    if (this.suggestionsCache.length === 0) {
      const suggestions = await this._getSuggestionsFromProvider(context);
      if (!suggestions || suggestions.length === 0) {
        this.resetCycle();
        return { textToInsert: null };
      }
      if (suggestions.length === 1) {
        const completion = suggestions[0];
        const completedNode = FileSystemManager.getNodeByPath(
            FileSystemManager.getAbsolutePath(completion)
        );
        const isDirectory =
            completedNode &&
            completedNode.type ===
            FileSystemManager.config.FILESYSTEM.DEFAULT_DIRECTORY_TYPE;

        let finalCompletion = quoteIfNecessary(completion);
        finalCompletion += (isDirectory ? "/" : " ");

        const textBefore = fullInput.substring(0, context.startOfWordIndex);
        const textAfter = fullInput.substring(cursorPos);

        let newText = textBefore + finalCompletion + textAfter;

        this.resetCycle();
        return {
          textToInsert: newText,
          newCursorPos: (textBefore + finalCompletion).length,
        };
      }

      const lcp = this.findLongestCommonPrefix(suggestions);
      if (lcp && lcp.length > context.currentWordPrefix.length) {
        const textBefore = fullInput.substring(0, context.startOfWordIndex);
        const textAfter = fullInput.substring(cursorPos);
        let newText = textBefore + lcp + textAfter;

        this.lastCompletionInput = newText;
        return {
          textToInsert: newText,
          newCursorPos: (textBefore + lcp).length,
        };
      } else {
        this.suggestionsCache = suggestions;
        const promptText = `${TerminalUI.getPromptText()} `;
        void OutputManager.appendToOutput(`${promptText}${fullInput}`, {
          isCompletionSuggestion: true,
        });
        void OutputManager.appendToOutput(this.suggestionsCache.join("    "), {
          typeClass: "text-subtle",
          isCompletionSuggestion: true,
        });
        TerminalUI.scrollOutputToEnd();

        this.cycleIndex = 0;
        const firstSuggestion = this.suggestionsCache[this.cycleIndex];
        const completedNode = FileSystemManager.getNodeByPath(
            FileSystemManager.getAbsolutePath(firstSuggestion)
        );
        const isDirectory =
            completedNode &&
            completedNode.type ===
            FileSystemManager.config.FILESYSTEM.DEFAULT_DIRECTORY_TYPE;

        const textBefore = fullInput.substring(0, context.startOfWordIndex);
        const textAfter = fullInput.substring(cursorPos);
        let completionText = quoteIfNecessary(firstSuggestion);
        completionText += (isDirectory ? "/" : " ");
        let newText = textBefore + completionText + textAfter;

        this.lastCompletionInput = newText;
        return {
          textToInsert: newText,
          newCursorPos: (textBefore + completionText).length,
        };
      }
    } else {
      this.cycleIndex = (this.cycleIndex + 1) % this.suggestionsCache.length;
      const nextSuggestion = this.suggestionsCache[this.cycleIndex];
      const completedNode = FileSystemManager.getNodeByPath(
          FileSystemManager.getAbsolutePath(nextSuggestion)
      );
      const isDirectory =
          completedNode &&
          completedNode.type ===
          FileSystemManager.config.FILESYSTEM.DEFAULT_DIRECTORY_TYPE;

      const textBefore = fullInput.substring(0, context.startOfWordIndex);
      const textAfter = fullInput.substring(cursorPos);
      let completionText = quoteIfNecessary(nextSuggestion);
      completionText += (isDirectory ? "/" : " ");
      let newText = textBefore + completionText + textAfter;

      this.lastCompletionInput = newText;
      return {
        textToInsert: newText,
        newCursorPos: (textBefore + completionText).length,
      };
    }
  }
}

class AppLayerManager {
  constructor() {
    this.cachedAppLayer = null;
    this.activeApp = null;
    this.dependencies = {};
    this._boundHandleGlobalKeyDown = this._handleGlobalKeyDown.bind(this);
  }

  initialize(dom) {
    this.cachedAppLayer = dom.appLayer;
  }

  setDependencies(injectedDependencies) {
    this.dependencies = injectedDependencies;
  }

  _handleGlobalKeyDown(event) {
    if (this.activeApp && typeof this.activeApp.handleKeyDown === "function") {
      this.activeApp.handleKeyDown(event);
    }
  }

  show(appInstance, options = {}) {
    const { TerminalUI, OutputManager } = this.dependencies;
    if (!(appInstance instanceof App)) {
      console.error(
          "AppLayerManager: Attempted to show an object that is not an instance of App."
      );
      return;
    }

    if (this.activeApp) {
      this.activeApp.exit();
    }

    this.activeApp = appInstance;

    appInstance.enter(this.cachedAppLayer, options);

    this.cachedAppLayer.classList.remove("hidden");
    document.addEventListener("keydown", this._boundHandleGlobalKeyDown, true);

    TerminalUI.setInputState(false);
    OutputManager.setEditorActive(true);

    if (
        appInstance.container &&
        typeof appInstance.container.focus === "function"
    ) {
      appInstance.container.focus();
    }
  }

  hide(appInstance) {
    const { TerminalUI, OutputManager } = this.dependencies;
    if (this.activeApp !== appInstance) {
      return;
    }

    if (
        appInstance.container &&
        appInstance.container.parentNode === this.cachedAppLayer
    ) {
      this.cachedAppLayer.removeChild(appInstance.container);
    }
    this.cachedAppLayer.classList.add("hidden");
    document.removeEventListener("keydown", this._boundHandleGlobalKeyDown, true);

    this.activeApp = null;

    TerminalUI.showInputLine();
    TerminalUI.setInputState(true);
    OutputManager.setEditorActive(false);
    TerminalUI.focusInput();
  }

  isActive() {
    return !!this.activeApp;
  }
}