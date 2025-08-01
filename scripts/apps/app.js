// scripts/apps/app.js

window.App = class App {
  constructor() {
    if (this.constructor === App) {
      throw new TypeError(
          'Abstract class "App" cannot be instantiated directly.'
      );
    }
    this.isActive = false;
    this.container = null;
  }

  /**
   * This method is responsible for building the app's UI,
   * attaching it to the app layer, and setting up initial state.
   * @param {HTMLElement} appLayer - The DOM element to which the app's UI should be appended.
   * @param {object} [options={}] - Optional parameters for initialization.
   */
  enter(appLayer, options = {}) {
    throw new Error('Method "enter()" must be implemented.');
  }

  /**
   * Called by AppLayerManager or the app itself to close and clean up the application.
   */
  exit() {
    throw new Error('Method "exit()" must be implemented.');
  }

  /**
   * Called by AppLayerManager to handle global key presses when the app is active.
   * @param {KeyboardEvent} event - The keyboard event.
   */
  handleKeyDown(event) {
    // Default implementation provides a universal exit hatch.
    if (event.key === "Escape") {
      this.exit();
    }
  }
}
