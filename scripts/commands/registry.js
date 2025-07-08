const CommandRegistry = (() => {
    "use strict";

    const commandDefinitions = {};

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

    function getDefinitions() {
        return { ...commandDefinitions };
    }

    return {
        register,
        getDefinitions,
    };
})();