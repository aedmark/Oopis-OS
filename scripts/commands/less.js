// scripts/commands/less.js

window.LessCommand = class LessCommand extends Command {
    constructor() {
        super({
            commandName: "less",
            dependencies: ["utils.js", "pager.js"],
            description: "An improved pager for displaying content.",
            helpText: `Usage: less [file]
      Displays file content or standard input one screen at a time.
      DESCRIPTION
      less is a program similar to 'more', but it allows backward
      movement in the file as well as forward movement. When used in a
      non-interactive script, it prints the entire input without pausing.
      CONTROLS
      SPACE / f:   Page forward.
      b / ArrowUp:   Page backward.
      ArrowDown:   Scroll down one line.
      q:           Quit.
      EXAMPLES
      less very_long_document.txt
      Displays the document and allows scrolling in both directions.`,
            isInputStream: true,
            completionType: "paths",
        });
    }

    async coreLogic(context) {
        const { options, inputItems, inputError, dependencies } = context;
        const { ErrorHandler, PagerManager } = dependencies;

        if (inputError) {
            return ErrorHandler.createError(
                "less: Could not read one or more sources."
            );
        }

        if (!inputItems || inputItems.length === 0) {
            return ErrorHandler.createSuccess("");
        }

        const content = inputItems.map((item) => item.content).join("\\n");

        if (!options.isInteractive) {
            return ErrorHandler.createSuccess(content);
        }

        await PagerManager.enter(content, { mode: "less" });

        return ErrorHandler.createSuccess("");
    }
}

window.CommandRegistry.register(new LessCommand());

