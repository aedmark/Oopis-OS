// scripts/apps/adventure/adventure_ui.js

/**
 * Text Adventure UI Modal - Handles the user interface for text adventure games
 * @class TextAdventureModal
 */
window.TextAdventureModal = class TextAdventureModal {
  /**
   * Create a text adventure modal
   * @param {Object} callbacks - Callback functions for game interaction
   * @param {Object} dependencies - Required dependencies
   * @param {Object} [scriptingContext] - Scripting context for automated play
   */
  constructor(callbacks, dependencies, scriptingContext) {
    /** @type {Object} DOM elements cache */
    this.elements = {};
    /** @type {Object} Callback functions */
    this.callbacks = callbacks;
    /** @type {Object} Injected dependencies */
    this.dependencies = dependencies;

    /** @type {Function} Bound input handler */
    this._boundHandleInput = this._handleInput.bind(this);

    this._buildLayout(scriptingContext);
  }

  /**
   * Get the main container element
   * @returns {HTMLElement} Container DOM element
   */
  getContainer() {
    return this.elements.container;
  }

  /**
   * Build the UI layout
   * @private
   * @param {Object} [scriptingContext] - Scripting context
   */
  _buildLayout(scriptingContext) {
    const { Utils } = this.dependencies;
    this._createElements();

    this.elements.input.addEventListener("keydown", this._boundHandleInput);

    if (scriptingContext?.isScripting) {
      this.elements.input.style.display = "none";
    }

    setTimeout(() => this.elements.input.focus(), 0);
  }

  /**
   * Hide the modal and clean up resources
   */
  hideAndReset() {
    if (this.elements.input) {
      this.elements.input.removeEventListener("keydown", this._boundHandleInput);
    }
    if (this.elements.container) {
      this.elements.container.remove();
    }
    this.elements = {};
    this.callbacks = {};
    this.dependencies = {};
  }

  /**
   * Create all DOM elements for the adventure UI
   * @private
   */
  _createElements() {
    const { Utils } = this.dependencies;
    const roomNameSpan = Utils.createElement("span", { id: "adventure-room-name" });
    const scoreSpan = Utils.createElement("span", { id: "adventure-score" });
    const headerLeft = Utils.createElement("div", {}, roomNameSpan);
    const headerRight = Utils.createElement("div", {}, scoreSpan);
    const header = Utils.createElement("header", { id: "adventure-header" }, headerLeft, headerRight);
    const output = Utils.createElement("div", { id: "adventure-output" });
    const inputPrompt = Utils.createElement("span", { id: "adventure-prompt", textContent: ">" });
    const input = Utils.createElement("input", {
      id: "adventure-input",
      type: "text",
      spellcheck: "false",
      autocapitalize: "none",
    });
    const inputContainer = Utils.createElement("div", { id: "adventure-input-container" }, inputPrompt, input);
    const container = Utils.createElement("div", { id: "adventure-container" }, header, output, inputContainer);

    this.elements = { container, header, output, input, roomNameSpan, scoreSpan };
  }

  /**
   * Handle input events from the text input field
   * @private
   * @param {KeyboardEvent} e - Keyboard event
   */
  _handleInput(e) {
    if (e.key !== "Enter" || !this.callbacks.processCommand) return;
    e.preventDefault();
    const command = this.elements.input.value;
    this.elements.input.value = "";
    this.appendOutput(`> ${command}`, "system");
    this.callbacks.processCommand(command);
  }

  /**
   * Append text output to the game display
   * @param {string} text - Text to display
   * @param {string} [styleClass] - CSS class for styling
   */
  appendOutput(text, styleClass = "") {
    if (!this.elements.output) return;
    const { Utils } = this.dependencies;
    const p = Utils.createElement("p", { textContent: text });
    if (styleClass) {
      p.className = `adv-${styleClass}`;
    }
    this.elements.output.appendChild(p);
    this.elements.output.scrollTop = this.elements.output.scrollHeight;
  }

  /**
   * Update the status line with current game info
   * @param {string} roomName - Current room name
   * @param {number} score - Player's score
   * @param {number} moves - Number of moves taken
   */
  updateStatusLine(roomName, score, moves) {
    if (this.elements.roomNameSpan) {
      this.elements.roomNameSpan.textContent = roomName;
    }
    if (this.elements.scoreSpan) {
      this.elements.scoreSpan.textContent = `Score: ${score}  Moves: ${moves}`;
    }
  }

  /**
   * Request input from the player
   * @param {string} _prompt - Input prompt (unused)
   * @returns {Promise<string>} Promise resolving to player input
   */
  requestInput(_prompt) {
    return new Promise((resolve) => {
      if (this.callbacks.onScriptedInput) {
        const command = this.callbacks.onScriptedInput();
        resolve(command);
      } else {
        const handleOneTimeInput = (e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            const command = this.elements.input.value;
            this.elements.input.value = '';
            this.appendOutput(`> ${command}`, 'system');
            this.elements.input.removeEventListener('keydown', handleOneTimeInput);
            this.elements.input.addEventListener('keydown', this._boundHandleInput);
            resolve(command);
          }
        };
        this.elements.input.removeEventListener('keydown', this._boundHandleInput);
        this.elements.input.addEventListener('keydown', handleOneTimeInput);
      }
    });
  }
}
