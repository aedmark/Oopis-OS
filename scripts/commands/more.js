// scripts/commands/more.js
(() => {
    "use strict";
    const moreCommandDefinition = {
        commandName: "more",
        isInputStream: true,
        completionType: "paths", // Preserved for tab completion
        coreLogic: async (context) => {
            const { options, inputItems, inputError } = context;

            try {
                if (inputError) {
                    return { success: false, error: "more: Could not read one or more sources." };
                }

                if (!inputItems || inputItems.length === 0) {
                    return { success: true, output: "" };
                }

                const content = inputItems.map(item => item.content).join('\\n');

                if (!options.isInteractive) {
                    return { success: true, output: content };
                }

                await PagerManager.enter(content, { mode: 'more' });

                return { success: true, output: "" };
            } catch (e) {
                return { success: false, error: `more: An unexpected error occurred: ${e.message}` };
            }
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