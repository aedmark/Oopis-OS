// scripts/commands/rm.js

(() => {
    "use strict";
    const rmCommandDefinition = {
        commandName: "rm",
        flagDefinitions: [
            {
                name: "recursive",
                short: "-r",
                long: "--recursive",
                aliases: ["-R"],
            },
            {
                name: "force",
                short: "-f",
                long: "--force",
            },
            {
                name: "interactive",
                short: "-i",
                long: "--interactive",
            },
        ],
        argValidation: {
            min: 1,
            error: "missing operand",
        },
        coreLogic: async (context) => {
            const { args, flags, currentUser, options } = context;
            let allSuccess = true;
            let anyChangeMade = false;
            const messages = [];

            for (const pathArg of args) {
                const pathValidation = FileSystemManager.validatePath("rm", pathArg, {
                    disallowRoot: true,
                });

                if (flags.force && !pathValidation.node) continue;

                if (pathValidation.error) {
                    messages.push(pathValidation.error);
                    allSuccess = false;
                    continue;
                }

                const node = pathValidation.node;
                if (
                    node.type === Config.FILESYSTEM.DEFAULT_DIRECTORY_TYPE &&
                    !flags.recursive
                ) {
                    messages.push(
                        `rm: cannot remove '${pathArg}': Is a directory (use -r or -R)`
                    );
                    allSuccess = false;
                    continue;
                }

                // --- NEW, SIMPLIFIED CONFIRMATION LOGIC ---
                let confirmed = false;

                if (flags.force) {
                    confirmed = true;
                } else if (flags.interactive) {
                    // Explicit -i flag always forces a prompt
                    const promptMsg =
                        node.type === Config.FILESYSTEM.DEFAULT_DIRECTORY_TYPE
                            ? `Recursively remove directory '${pathArg}'?`
                            : `Remove file '${pathArg}'?`;
                    confirmed = await new Promise((resolve) => {
                        ModalManager.request({
                            context: "terminal",
                            messageLines: [promptMsg],
                            onConfirm: () => resolve(true),
                            onCancel: () => resolve(false),
                            options, // Pass context for scripted prompts
                        });
                    });
                } else if (options.isInteractive) {
                    // Interactive shell without -f or -i defaults to prompting
                    const promptMsg = `Remove ${node.type === Config.FILESYSTEM.DEFAULT_DIRECTORY_TYPE ? "directory" : "file"} '${pathArg}'?`;
                    confirmed = await new Promise((resolve) => {
                        ModalManager.request({
                            context: "terminal",
                            messageLines: [promptMsg],
                            onConfirm: () => resolve(true),
                            onCancel: () => resolve(false),
                            options,
                        });
                    });
                } else {
                    // Non-interactive (script) without -f or -i defaults to no prompt
                    confirmed = true;
                }


                if (confirmed) {
                    const deleteResult = await FileSystemManager.deleteNodeRecursive(
                        pathArg,
                        {
                            force: true, // Internal call is always forced after confirmation
                            currentUser,
                        }
                    );
                    if (deleteResult.success) {
                        if (deleteResult.anyChangeMade) anyChangeMade = true;
                    } else {
                        allSuccess = false;
                        messages.push(...deleteResult.messages);
                    }
                } else {
                    messages.push(
                        `${Config.MESSAGES.REMOVAL_CANCELLED_PREFIX}'${pathArg}'${Config.MESSAGES.REMOVAL_CANCELLED_SUFFIX}`
                    );
                }
            }
            if (anyChangeMade) await FileSystemManager.save();

            const finalOutput = messages.filter((m) => m).join("\n");
            return {
                success: allSuccess,
                output: finalOutput,
                error: allSuccess
                    ? null
                    : finalOutput || "Unknown error during rm operation.",
            };
        },
    };

    const rmDescription = "Removes files or directories.";

    const rmHelpText = `Usage: rm [OPTION]... [FILE]...

Remove files or directories.

DESCRIPTION
       The rm command removes each specified file. By default, it does not
       remove directories.

       In an interactive session, rm will prompt for confirmation before
       removing a file. This behavior can be controlled with the -f and
       -i flags.

OPTIONS
       -f, --force
              Attempt to remove the files without prompting for
              confirmation, regardless of the file's permissions.

       -i, --interactive
              Prompt for confirmation before every removal.

       -r, -R, --recursive
              Remove directories and their contents recursively.

WARNING
       Use this command with caution. Deleted files and directories
       cannot be recovered.`;

    CommandRegistry.register("rm", rmCommandDefinition, rmDescription, rmHelpText);
})();