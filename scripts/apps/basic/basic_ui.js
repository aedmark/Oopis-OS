// scripts/apps/basic/basic_ui.js

/**
 * BASIC IDE User Interface - Handles the visual interface for the BASIC development environment
 * @class BasicUI
 */
window.BasicUI = class BasicUI {
  /**
   * Create a BASIC UI instance
   * @param {Object} callbacks - Callback functions for user interaction
   * @param {Object} dependencies - Required dependencies
   */
  constructor(callbacks, dependencies) {
    /** @type {Object} DOM elements cache */
    this.elements = {};
    /** @type {Object} Callback functions */
    this.callbacks = callbacks;
    /** @type {Object} Injected dependencies */
    this.dependencies = dependencies;
    this._buildLayout();
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
   */
  _buildLayout() {
    const { Utils, UIComponents } = this.dependencies;

    const appWindow = UIComponents.createAppWindow('Oopis BASIC v1.0', this.callbacks.onExit);
    this.elements.container = appWindow.container;
    this.elements.main = appWindow.main;

    this.elements.container.classList.add("basic-app__container");

    this.elements.output = Utils.createElement("div", {
      id: "basic-app-output",
      className: "basic-app__output",
    });

    this.elements.input = Utils.createElement("input", {
      id: "basic-app-input",
      className: "basic-app__input",
      type: "text",
      spellcheck: "false",
      autocapitalize: "none",
    });

    const inputContainer = Utils.createElement(
        "div",
        { className: "basic-app__input-line" },
        Utils.createElement("span", { textContent: ">" }),
        this.elements.input
    );

    this.elements.main.append(this.elements.output, inputContainer);

    this.elements.input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        const command = this.elements.input.value;
        this.elements.input.value = "";
        this.callbacks.onInput(command);
      }
    });
  }

  /**
   * Write text to the output without a newline
   * @param {string} text - Text to write
   */
  write(text) {
    if (this.elements.output) {
      this.elements.output.textContent += text;
      this.elements.output.scrollTop = this.elements.output.scrollHeight;
    }
  }

  /**
   * Write text to the output with a newline
   * @param {string} text - Text to write
   */
  writeln(text) {
    if (this.elements.output) {
      this.elements.output.textContent += text + "\n";
      this.elements.output.scrollTop = this.elements.output.scrollHeight;
    }
  }

  /**
   * Focus the input field
   */
  focusInput() {
    if (this.elements.input) {
      this.elements.input.focus();
    }
  }

  /**
   * Reset and clean up the UI
   */
  reset() {
    this.elements = {};
    this.callbacks = {};
    this.dependencies = {};
  }
}
