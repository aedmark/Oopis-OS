(() => {
    "use strict";
    const lessCommandDefinition = {
        commandName: "less",
        argValidation: { max: 1 },
        pathValidation: [{ argIndex: 0, options: { expectedType: 'file' }, optional: true }],
        permissionChecks: [{ pathArgIndex: 0, permissions: ["read"] }],
        coreLogic: async (context) => {
            const { args, options, validatedPaths } = context;
            const content = args.length > 0
                ? validatedPaths[0].node.content
                : options.stdinContent;

            if (content === null || content === undefined) {
                return { success: true, output: "" };
            }

            await PagerManager.enter(content, { mode: 'less' });

            return { success: true, output: "" };
        },
    };

    const lessDescription = "An improved pager for displaying content.";
    const lessHelpText = `Usage: less [file]

Displays file content or standard input one screen at a time.

DESCRIPTION
        less is a program similar to 'more', but it allows backward
        movement in the file as well as forward movement.

CONTROLS
        SPACE / f:   Page forward.
        b / ArrowUp:   Page backward.
        ArrowDown:   Scroll down one line.
        q:           Quit.

EXAMPLES
        less very_long_document.txt
               Displays the document and allows scrolling in both directions.`;

    CommandRegistry.register("less", lessCommandDefinition, lessHelpText, lessDescription);
})();