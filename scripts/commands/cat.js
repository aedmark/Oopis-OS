// scripts/commands/cat.js

(() => {
    "use strict";
    const catCommandDefinition = {
        commandName: "cat",
        coreLogic: async (context) => {
            const { args, options, currentUser } = context;
            if (
                args.length === 0 &&
                (options.stdinContent === null || options.stdinContent === undefined)
            ) {
                return {
                    success: true,
                    output: "",
                };
            }
            let outputContent = "";
            let firstFile = true;
            if (options.stdinContent !== null && options.stdinContent !== undefined) {
                outputContent += options.stdinContent;
                firstFile = false;
            }
            for (const pathArg of args) {
                const pathValidation = FileSystemManager.validatePath("cat", pathArg, {
                    expectedType: Config.FILESYSTEM.DEFAULT_FILE_TYPE,
                });
                if (pathValidation.error)
                    return {
                        success: false,
                        error: pathValidation.error,
                    };
                if (
                    !FileSystemManager.hasPermission(
                        pathValidation.node,
                        currentUser,
                        "read"
                    )
                )
                    return {
                        success: false,
                        error: `cat: '${pathArg}'${Config.MESSAGES.PERMISSION_DENIED_SUFFIX}`,
                    };
                if (!firstFile && outputContent && !outputContent.endsWith("\n"))
                    outputContent += "\n";
                outputContent += pathValidation.node.content || "";
                firstFile = false;
            }
            return {
                success: true,
                output: outputContent,
            };
        },
    };
    const catDescription = "Displays the contents of one or more files.";
    const catHelpText = "Usage: cat [options] [path...]\n\nDisplays the contents of one or more files.";
    CommandRegistry.register("cat", catCommandDefinition, catDescription, catHelpText);
})();