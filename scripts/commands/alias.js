// scripts/commands/alias.js

window.AliasCommand = class AliasCommand extends Command {
  constructor() {
    super({
      commandName: "alias",
      description: "Create, remove, and display command aliases.",
      helpText: `Usage: alias [name='command']...

Define or display command aliases.

DESCRIPTION
       The alias command allows you to create shortcuts for longer or more
       complex commands. Aliases are saved and persist across sessions.

       Running \`alias\` with no arguments lists all currently defined
       aliases in a reusable format.

       To create or redefine an alias, use the \`name='command'\` format.
       The command string should be quoted if it contains spaces or
       special characters.

       To display a specific alias, run \`alias <name>\`.

EXAMPLES
       alias ll='ls -la'
              Creates a shortcut 'll' for a long directory listing.

       alias mypath='echo $PATH'
              Creates an alias to display the current PATH variable.
       
       alias
              Lists all defined aliases.
       
       alias ll
              Displays the definition for the 'll' alias.`,
    });
  }

  async coreLogic(context) {
    const { args, dependencies } = context;
    const { AliasManager, ErrorHandler, Utils } = dependencies;

    if (args.length === 0) {
      const allAliases = AliasManager.getAllAliases();
      if (Object.keys(allAliases).length === 0) {
        return ErrorHandler.createSuccess("");
      }
      const outputLines = [];
      for (const name in allAliases) {
        const value = allAliases[name];
        outputLines.push(`alias ${name}='${value}'`);
      }
      return ErrorHandler.createSuccess(outputLines.sort().join("\n"));
    }

    const { name, value } = Utils.parseKeyValue(args);

    if (value !== null) {
      if (!name) {
        return ErrorHandler.createError(
            "alias: invalid format. Missing name."
        );
      }
      if (AliasManager.setAlias(name, value)) {
        return ErrorHandler.createSuccess("", { stateModified: true });
      }
      return ErrorHandler.createError("alias: failed to set alias.");
    } else {
      const aliasValue = AliasManager.getAlias(name);
      if (aliasValue) {
        return ErrorHandler.createSuccess(`alias ${name}='${aliasValue}'`);
      } else {
        return ErrorHandler.createError(`alias: ${name}: not found`);
      }
    }
  }
}

window.CommandRegistry.register(new AliasCommand());
