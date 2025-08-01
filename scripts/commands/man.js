// scripts/commands/man.js

function formatManPage(commandName, commandData) {
  if (!commandData) {
    return `No manual entry for ${commandName}`;
  }

  const description = commandData.description || "No description available.";
  const helpText = commandData.helpText || "";
  const output = [];

  output.push("NAME");
  output.push(`       ${commandName} - ${description}`);
  output.push("");

  const helpLines = helpText.split("\n");
  const synopsisLine = helpLines.find((line) =>
      line.trim().toLowerCase().startsWith("usage:")
  );
  const synopsis = synopsisLine || `       Usage: ${commandName} [options]`;
  output.push("SYNOPSIS");
  output.push(`       ${synopsis.replace("Usage: ", "")}`);
  output.push("");

  const descriptionText = helpLines
      .slice(synopsisLine ? 1 : 0)
      .join("\n")
      .trim();
  if (descriptionText) {
    output.push("DESCRIPTION");
    descriptionText.split("\n").forEach((line) => {
      output.push(`       ${line}`);
    });
    output.push("");
  }

  if (commandData.flagDefinitions && commandData.flagDefinitions.length > 0) {
    output.push("OPTIONS");
    commandData.flagDefinitions.forEach((flag) => {
      let flagLine = "       ";
      const short = flag.short;
      const long = flag.long;
      let flagIdentifiers = [];
      if (short) flagIdentifiers.push(short);
      if (long) flagIdentifiers.push(long);
      flagLine += flagIdentifiers.join(", ");
      if (flag.takesValue) {
        flagLine += " <value>";
      }
      output.push(flagLine);
    });
    output.push("");
  }

  return output.join("\n");
}

window.ManCommand = class ManCommand extends Command {
  constructor() {
    super({
      commandName: "man",
      description: "Formats and displays the manual page for a command.",
      helpText: `Usage: man <command>
      Displays the manual page for a given command.
      DESCRIPTION
      The man command formats and displays the manual page for a specified
      command. Manual pages include a command's synopsis, a detailed
      description of its function, and a list of its available options.
      EXAMPLES
      man ls
      Displays the comprehensive manual page for the 'ls' command.`,
      completionType: "commands",
      validations: {
        args: {
          exact: 1,
          error: "what manual page do you want?"
        }
      },
    });
  }

  async coreLogic(context) {
    const { args, dependencies } = context;
    const { CommandExecutor, ErrorHandler } = dependencies;
    const commandName = args[0];

    const commandInstance = await CommandExecutor._ensureCommandLoaded(commandName);

    if (!commandInstance) {
      return ErrorHandler.createError(`No manual entry for ${commandName}`);
    }

    const commandData = commandInstance.definition;

    if (!commandData) {
      return ErrorHandler.createError(`No manual entry for ${commandName}`);
    }

    const manPage = formatManPage(commandName, commandData);

    return ErrorHandler.createSuccess(manPage);
  }
}

window.CommandRegistry.register(new ManCommand());
