(() => {
    "use strict";
    const lessCommandDefinition = {
        commandName: "less",
        isInputStream: true,
        coreLogic: async (context) => {
            const {options, inputItems, inputError} = context;

            if (inputError) {
                return {success: false, error: "less: Could not read one or more sources."};
            }

            const content = inputItems.map(item => item.content).join('\n');

            if (content === null || content === undefined) {
                return { success: true, output: "" };
            }

            if (!options.isInteractive) {
                return { success: true, output: content };
            }

            PagerManager.enter(content, { mode: 'less' });

            return { success: true, output: "" };
        },
    };

    const lessDescription = "An improved pager for displaying content.";
    const lessHelpText = `Usage: less [file]

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
               Displays the document and allows scrolling in both directions.`;

    CommandRegistry.register("less", lessCommandDefinition, lessDescription, lessHelpText);
})();