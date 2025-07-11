(() => {
    "use strict";
    const moreCommandDefinition = {
        commandName: "more",
        isInputStream: true,
        coreLogic: async (context) => {
            const {options, inputItems, inputError} = context;

            if (inputError) {
                return {success: false, error: "more: Could not read one or more sources."};
            }

            // The inputItems array now correctly provides the content from all sources (stdin or files).
            const content = inputItems.map(item => item.content).join('\n');

            if (content === null || content === undefined) {
                return {success: true, output: ""}; // Handle no input gracefully
            }

            if (!options.isInteractive) {
                // In a pipe or script, just pass the content through
                return { success: true, output: content };
            }

            // In interactive mode, launch the pager UI
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