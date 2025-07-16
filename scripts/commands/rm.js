// scripts/commands/rm.js
(() => {
    "use strict";

    const rmCommandDefinition = {
        commandName: "rm",
        completionType: "paths", // Preserved for tab completion
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

            try {
                for (const pathArg of args) {
                    const resolvedPath = FileSystemManager.getAbsolutePath(pathArg);
                    if (resolvedPath === '/') {
                        messages.push(`rm: cannot remove root directory`);
                        allSuccess = false;
                        continue;
                    }

                    const node = FileSystemManager.getNodeByPath(resolvedPath);

                    if (flags.force && !node) continue;

                    if (!node) {
                        messages.push(`rm: cannot remove '${pathArg}': No such file or directory`);
                        allSuccess = false;
                        continue;
                    }

                    if (node.type === 'directory' && !flags.recursive) {
                        messages.push(`rm: cannot remove '${pathArg}': Is a directory (use -r or -R)`);
                        allSuccess = false;
                        continue;
                    }

                    const isPromptRequired = flags.interactive || (options.isInteractive && !flags.force);

                    if (isPromptRequired) {
                        const promptMsg = node.type === 'directory' ? `Recursively remove directory '${pathArg}'?` : `Remove file '${pathArg}'?`;
                        const confirmed = await new Promise((resolve) => {
                            ModalManager.request({
                                context: "terminal",
                                messageLines: [promptMsg],
                                onConfirm: () => resolve(true),
                                onCancel: () => resolve(false),
                                options,
                            });
                        });

                        if (!confirmed) {
                            messages.push(`${Config.MESSAGES.REMOVAL_CANCELLED_PREFIX}'${pathArg}'${Config.MESSAGES.REMOVAL_CANCELLED_SUFFIX}`);
                            continue;
                        }
                    }

                    const deleteResult = await FileSystemManager.deleteNodeRecursive(resolvedPath, { force: true, currentUser });
                    if (deleteResult.success) {
                        if (deleteResult.anyChangeMade) anyChangeMade = true;
                        messages.push(`removed '${pathArg}'`);
                    } else {
                        allSuccess = false;
                        messages.push(...deleteResult.messages);
                    }
                }
                if (anyChangeMade) await FileSystemManager.save();

                const finalOutput = messages.filter((m) => m).join("\\n");
                return {
                    success: allSuccess,
                    output: allSuccess ? finalOutput : null,
                    error: allSuccess ? null : finalOutput || "Unknown error during rm operation.",
                };
            } catch (e) {
                return { success: false, error: `rm: An unexpected error occurred: ${e.message}` };
            }
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