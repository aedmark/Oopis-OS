/**
 * @file Manages the registration and retrieval of all command definitions for OopisOS.
 * This module acts as a central registry where individual command modules
 * can register themselves, and the CommandExecutor can retrieve their definitions for execution.
 * @module CommandRegistry
 */
const CommandRegistry = (() => {
    "use strict";

    /**
     * @private
     * @type {Object.<string, {definition: object, description: string, helpText: string}>}
     * @description Stores all registered command definitions, keyed by their command name.
     * Each entry contains the full command definition, a short description, and detailed help text.
     */
    const commandDefinitions = {};

    /**
     * Registers a new command with the CommandRegistry.
     * If a command with the same name already exists, a warning is logged.
     * @param {string} commandName - The name of the command to register (e.g., "ls", "cd").
     * @param {object} definition - The full command definition object, typically containing
     * validation rules, flag definitions, and the core logic function.
     * @param {string} description - A brief, one-line description of the command, used by 'help'.
     * @param {string} helpText - Detailed help text for the command, used by 'man'.
     */
    function register(commandName, definition, description, helpText) {
        if (commandDefinitions[commandName]) {
            console.warn(`CommandRegistry: Overwriting command '${commandName}'.`);
        }
        commandDefinitions[commandName] = {
            definition: definition,
            description: description,
            helpText: helpText,
        };
    }

    /**
     * Retrieves all currently registered command definitions.
     * @returns {Object.<string, {definition: object, description: string, helpText: string}>}
     * A copy of the `commandDefinitions` object.
     */
    function getDefinitions() {
        // Return a shallow copy to prevent external modification of the internal registry.
        return { ...commandDefinitions };
    }

    // Public interface of the CommandRegistry module.
    return {
        register,
        getDefinitions,
    };
})();