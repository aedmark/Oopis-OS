(() => {
    "use strict";
    const moreCommandDefinition = {
        commandName: "more",
        argValidation: { max: 1 },
        pathValidation: [{ argIndex: 0, options: { expectedType: 'file' }, optional: true }],
        permissionChecks: [{ pathArgIndex: 0, permissions: ["read"] }],
        coreLogic: async (context) => {
            const { args, options, validatedPaths } = context;
            const content = args.length > 0
                ? (validatedPaths[0] && validatedPaths[0].node ? validatedPaths[0].node.content : null)
                : options.stdinContent;

            if (content === null || content === undefined) {
                return { success: true, output: "" };
            }

            if (!options.isInteractive) {
                return { success: true, output: content };
            }

            PagerManager.enter(content, { mode: 'more' });

            return { success: true, output: "" };
        },
    };

    const moreDescription = "Displays content one screen at a time.";
    const moreHelpText = `Usage: more [file]

Displays file content or standard input one screen at a time.

DESCRIPTION
        more is a filter for paging through text one screenful at a time.
        When used in a non-interactive script, it prints the entire input
        without pausing. In an interactive session, press SPACE to view
        the next page, and 'q' to quit.

EXAMPLES
        more long_document.txt
               Displays the document, pausing after each screen.

        ls -l / | more
               Pages through a long directory listing.`;

    CommandRegistry.register("more", moreCommandDefinition, moreDescription, moreHelpText);
})();