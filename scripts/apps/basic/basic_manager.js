/**
 * BASIC IDE Manager - Provides an integrated development environment for BASIC programming
 * @class BasicManager
 * @extends App
 */
window.BasicManager = class BasicManager extends App {
  /**
   * Create a BASIC IDE manager instance
   */
  constructor() {
    super();
    /** @type {Object} Injected dependencies */
    this.dependencies = {};
    /** @type {Basic_interp|null} BASIC interpreter instance */
    this.interpreter = null;
    /** @type {Map<number, string>} Program line buffer */
    this.programBuffer = new Map();
    /** @type {Function|null} Input promise resolver for program execution */
    this.onInputPromiseResolver = null;
    /** @type {Object} Load options including file path and content */
    this.loadOptions = {};
    /** @type {Object} Callback functions for UI interaction */
    this.callbacks = {};
    /** @type {Object|null} UI instance */
    this.ui = null;
  }

  /**
   * Enter the BASIC IDE
   * @param {HTMLElement} appLayer - DOM element to attach the IDE UI
   * @param {Object} options - Configuration options
   * @param {Object} options.dependencies - Required dependencies
   * @param {string} [options.path] - File path to load
   * @param {string} [options.content] - File content to load
   */
  enter(appLayer, options = {}) {
    this.dependencies = options.dependencies;
    this.interpreter = new this.dependencies.Basic_interp(this.dependencies);
    this.callbacks = this._createCallbacks();

    this.isActive = true;
    this.loadOptions = options;

    this.ui = new this.dependencies.BasicUI(this.callbacks, this.dependencies);
    this.container = this.ui.getContainer();

    appLayer.appendChild(this.container);

    this._init();
  }

  /**
   * Exit the BASIC IDE
   */
  exit() {
    if (!this.isActive) return;
    const { AppLayerManager } = this.dependencies;

    if (this.ui) {
      this.ui.reset();
    }
    AppLayerManager.hide(this);

    this.isActive = false;
    this.interpreter = null;
    this.programBuffer.clear();
    this.onInputPromiseResolver = null;
    this.loadOptions = {};
    this.ui = null;
  }

  /**
   * Initialize the IDE interface
   * @private
   */
  _init() {
    this.ui.writeln("Oopis BASIC [Version 1.0]");
    this.ui.writeln("(c) 2025 Oopis Systems. All rights reserved.");
    this.ui.writeln("");

    if (this.loadOptions.content) {
      this._loadContentIntoBuffer(this.loadOptions.content);
      this.ui.writeln(`Loaded "${this.loadOptions.path}".`);
    }

    this.ui.writeln("READY.");
    setTimeout(() => this.ui.focusInput(), 0);
  }

  /**
   * Create callback functions for UI interaction
   * @private
   * @returns {Object} Callback object
   */
  _createCallbacks() {
    return {
      onInput: this._handleIdeInput.bind(this),
      onExit: this.exit.bind(this),
    };
  }

  /**
   * Load program content into the line buffer
   * @private
   * @param {string} content - Program source code
   */
  _loadContentIntoBuffer(content) {
    this.programBuffer.clear();
    const lines = content.split("\n");
    for (const line of lines) {
      if (line.trim() === "") continue;
      const match = line.match(/^(\d+)\s*(.*)/);
      if (match) {
        const lineNumber = parseInt(match[1], 10);
        const lineContent = match[2].trim();
        if (lineContent) {
          this.programBuffer.set(lineNumber, lineContent);
        }
      }
    }
  }

  /**
   * Handle input from the IDE command line
   * @private
   * @param {string} command - User input command
   */
  async _handleIdeInput(command) {
    command = command.trim();
    this.ui.writeln(`> ${command}`);

    if (this.onInputPromiseResolver) {
      this.onInputPromiseResolver(command);
      this.onInputPromiseResolver = null;
      return;
    }

    if (command === "") {
      this.ui.writeln("READY.");
      return;
    }

    const lineMatch = command.match(/^(\d+)(.*)/);
    if (lineMatch) {
      const lineNumber = parseInt(lineMatch[1], 10);
      const lineContent = lineMatch[2].trim();
      if (lineContent === "") {
        this.programBuffer.delete(lineNumber);
      } else {
        this.programBuffer.set(lineNumber, lineContent);
      }
    } else {
      const firstSpaceIndex = command.indexOf(" ");
      let cmd, argsStr;
      if (firstSpaceIndex === -1) {
        cmd = command.toUpperCase();
        argsStr = "";
      } else {
        cmd = command.substring(0, firstSpaceIndex).toUpperCase();
        argsStr = command.substring(firstSpaceIndex + 1).trim();
      }
      await this._executeIdeCommand(cmd, argsStr);
    }
    if (this.isActive) {
      this.ui.writeln("READY.");
    }
  }

  /**
   * Execute an IDE command
   * @private
   * @param {string} cmd - Command name
   * @param {string} argsStr - Command arguments
   */
  async _executeIdeCommand(cmd, argsStr) {
    switch (cmd) {
      case "RUN":
        await this._runProgram();
        break;
      case "LIST":
        this._listProgram();
        break;
      case "NEW":
        this.programBuffer.clear();
        this.loadOptions = {};
        this.ui.writeln("OK");
        break;
      case "SAVE":
        await this._saveProgram(argsStr);
        break;
      case "LOAD":
        await this._loadProgram(argsStr);
        break;
      case "EXIT":
        this.exit();
        break;
      default:
        this.ui.writeln("SYNTAX ERROR");
        break;
    }
  }

  /**
   * Get the complete program text from the buffer
   * @private
   * @returns {string} Complete program source code
   */
  _getProgramText() {
    const sortedLines = Array.from(this.programBuffer.keys()).sort(
        (a, b) => a - b
    );
    return sortedLines
        .map((lineNum) => `${lineNum} ${this.programBuffer.get(lineNum)}`)
        .join("\n");
  }

  /**
   * List the current program in the buffer
   * @private
   */
  _listProgram() {
    const sortedLines = Array.from(this.programBuffer.keys()).sort(
        (a, b) => a - b
    );
    sortedLines.forEach((lineNum) => {
      this.ui.writeln(`${lineNum} ${this.programBuffer.get(lineNum)}`);
    });
    this.ui.writeln("OK");
  }

  /**
   * Run the current program
   * @private
   */
  async _runProgram() {
    const programText = this._getProgramText();
    if (programText.length === 0) {
      this.ui.writeln("OK");
      return;
    }
    try {
      await this.interpreter.run(programText, {
        outputCallback: (text, withNewline = true) => {
          withNewline ? this.ui.writeln(text) : this.ui.write(text);
        },
        inputCallback: async () =>
            new Promise((resolve) => {
              this.onInputPromiseResolver = resolve;
            }),
        pokeCallback: (_x, _y, _char, _color) => {
        },
      });
    } catch (error) {
      this.ui.writeln(`\nRUNTIME ERROR: ${error.message}`);
    }
    this.ui.writeln("");
  }

  /**
   * Save the current program to a file
   * @private
   * @param {string} filePathArg - File path argument
   */
  async _saveProgram(filePathArg) {
    const { FileSystemManager, UserManager } = this.dependencies;
    let savePath = filePathArg
        ? filePathArg.replace(/["']/g, "")
        : this.loadOptions.path;
    if (!savePath) {
      this.ui.writeln("?NO FILENAME SPECIFIED");
      return;
    }
    if (!savePath.endsWith(".bas")) savePath += ".bas";

    const content = this._getProgramText();
    const absPath = FileSystemManager.getAbsolutePath(savePath);
    const currentUser = UserManager.getCurrentUser().name;
    const primaryGroup = UserManager.getPrimaryGroupForUser(currentUser);
    const saveResult = await FileSystemManager.createOrUpdateFile(
        absPath,
        content,
        { currentUser, primaryGroup }
    );

    if (saveResult.success && (await FileSystemManager.save())) {
      this.loadOptions.path = savePath;
      this.ui.writeln("OK");
    } else {
      this.ui.writeln(
          `?ERROR SAVING FILE: ${saveResult.error || "Filesystem error"}`
      );
    }
  }

  /**
   * Load a program from a file
   * @private
   * @param {string} filePathArg - File path argument
   */
  async _loadProgram(filePathArg) {
    const { FileSystemManager } = this.dependencies;
    if (!filePathArg) {
      this.ui.writeln("?FILENAME REQUIRED");
      return;
    }
    const path = filePathArg.replace(/["']/g, "");
    const pathValidation = FileSystemManager.validatePath(path, {
      expectedType: "file",
      permissions: ["read"],
    });
    if (!pathValidation.success) {
      this.ui.writeln(`?ERROR: ${pathValidation.error}`);
      return;
    }
    this._loadContentIntoBuffer(pathValidation.data.node.content);
    this.loadOptions = { path: path, content: pathValidation.data.node.content };
    this.ui.writeln("OK");
  }
}
