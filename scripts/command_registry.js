// scripts/command_registry.js

class CommandRegistry {
    constructor() {
        this.commandDefinitions = {};
        this.dependencies = {};
    }

    setDependencies(dependencies) {
        this.dependencies = dependencies;
    }

    register(commandInstance) {
        if (commandInstance && commandInstance.commandName) {
            this.commandDefinitions[commandInstance.commandName] = commandInstance;
        } else {
            console.error(
                "Attempted to register an invalid command instance:",
                commandInstance
            );
        }
    }

    addCommandToManifest(commandName) {
        const { Config } = this.dependencies;
        if (!Config.COMMANDS_MANIFEST.includes(commandName)) {
            Config.COMMANDS_MANIFEST.push(commandName);
            Config.COMMANDS_MANIFEST.sort(); // Keep it tidy!
        }
    }

    removeCommandFromManifest(commandName) {
        const { Config } = this.dependencies;
        const index = Config.COMMANDS_MANIFEST.indexOf(commandName);
        if (index > -1) {
            Config.COMMANDS_MANIFEST.splice(index, 1);
        }
    }

    unregisterCommand(commandName) {
        if (this.commandDefinitions[commandName]) {
            delete this.commandDefinitions[commandName];
            this.removeCommandFromManifest(commandName);
            return true;
        }
        return false;
    }

    getDefinitions() {
        const definitionsOnly = {};
        for (const key in this.commandDefinitions) {
            definitionsOnly[key] = this.commandDefinitions[key].definition;
        }
        return definitionsOnly;
    }

    getCommands() {
        return this.commandDefinitions;
    }
}