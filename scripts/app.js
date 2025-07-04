/**
 * The base class for all applications running within OopisOS.
 * DECLARED IN GLOBAL SCOPE. This script must be loaded first
 * before any file that uses 'extends App'.
 * @class App
 */
class App {
    /**
     * @param {object} term - The terminal UI instance.
     * @param {object} context - A context object containing system-wide managers and event emitters.
     */
    constructor(term, context) {
        this.term = term;
        this.context = context;
        this._init();
    }

    /**
     * Private initializer called by the constructor.
     * @private
     */
    _init() {
        // Base applications can add their welcome messages here.
    }

    /**
     * The primary input handler for the application.
     * This method is expected to be overridden by child classes.
     * @param {string} command - The user's input string.
     * @private
     */
    _handleInput(command) {
        this.term.writeln(`'${command}' not recognized.`);
    }

    /**
     * Signals to the OS that the application wishes to terminate.
     * The command executor listens for this event to reclaim control.
     */
    exit() {
        if (this.context && this.context.events) {
            this.context.events.emit('app-exit');
        }
    }
}