// scripts/commands/more.js

window.MoreCommand = class MoreCommand extends Command {
    constructor() {
        super({
            commandName: "more",
            dependencies: ["utils.js", "pager.js"],
            description: "A simple pager for displaying content.",
            helpText: `Usage: more [file]
      Displays file content or standard input one screen at a time.
      DESCRIPTION
      The more command is a filter for paging through text one screenful
      at a time. It only allows forward movement. For more advanced
      features like backward scrolling, use 'less'.
      When used in a non-interactive script, it prints the entire
      input without pausing.
      CONTROLS
      SPACE / f:   Page forward.
      q:           Quit.
      EXAMPLES
      more long_document.txt
      Displays the document, pausing after each screenful of text.`,
            isInputStream: true,
            completionType: "paths",
        });
    }

    async coreLogic(context) {
        const { options, inputItems, inputError, dependencies } = context;
        const { ErrorHandler, PagerManager } = dependencies;

        if (inputError) {
            return ErrorHandler.createError(
                "more: Could not read one or more sources."
            );
        }

        if (!inputItems || inputItems.length === 0) {
            return ErrorHandler.createSuccess("");
        }

        const content = inputItems.map((item) => item.content).join("\n");

        if (!options.isInteractive) {
            return ErrorHandler.createSuccess(content);
        }

        await PagerManager.enter(content, { mode: "more" });

        return ErrorHandler.createSuccess("");
    }
}

window.CommandRegistry.register(new MoreCommand());
