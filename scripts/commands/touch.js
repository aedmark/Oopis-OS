// scripts/commands/touch.js
(() => {
    "use strict";

    const touchCommandDefinition = {
        commandName: "touch",
        completionType: "paths", // Preserved for tab completion
        flagDefinitions: [
            { name: "noCreate", short: "-c", long: "--no-create" },
            { name: "dateString", short: "-d", long: "--date", takesValue: true },
            { name: "stamp", short: "-t", takesValue: true },
        ],
        argValidation: { min: 1 },
        coreLogic: async (context) => {
            const { args, flags, currentUser } = context;

            try {
                const timestampResult = TimestampParser.resolveTimestampFromCommandFlags(
                    flags,
                    "touch"
                );
                if (timestampResult.error)
                    return { success: false, error: timestampResult.error };

                const timestampToUse = timestampResult.timestampISO;
                let allSuccess = true;
                const messages = [];
                let changesMade = false;

                const primaryGroup = UserManager.getPrimaryGroupForUser(currentUser);

                for (const pathArg of args) {
                    const resolvedPath = FileSystemManager.getAbsolutePath(pathArg);
                    if (resolvedPath === '/') {
                        messages.push(`touch: cannot touch root directory`);
                        allSuccess = false;
                        continue;
                    }

                    const node = FileSystemManager.getNodeByPath(resolvedPath);

                    if (node) {
                        if (!FileSystemManager.hasPermission(node, currentUser, "write")) {
                            messages.push(`touch: cannot update timestamp of '${pathArg}': Permission denied`);
                            allSuccess = false;
                            continue;
                        }
                        node.mtime = timestampToUse;
                        changesMade = true;
                    } else {
                        if (flags.noCreate) continue;

                        if (pathArg.trim().endsWith(Config.FILESYSTEM.PATH_SEPARATOR)) {
                            messages.push(`touch: cannot touch '${pathArg}': No such file or directory`);
                            allSuccess = false;
                            continue;
                        }

                        const parentPath = resolvedPath.substring(0, resolvedPath.lastIndexOf('/')) || '/';
                        const parentNode = FileSystemManager.getNodeByPath(parentPath);

                        if (!parentNode || parentNode.type !== 'directory') {
                            messages.push(`touch: cannot create '${pathArg}': Parent directory not found or is not a directory.`);
                            allSuccess = false;
                            continue;
                        }

                        if (!FileSystemManager.hasPermission(parentNode, currentUser, "write")) {
                            messages.push(`touch: cannot create '${pathArg}': Permission denied in parent directory.`);
                            allSuccess = false;
                            continue;
                        }

                        if (!primaryGroup) {
                            messages.push(`touch: could not determine primary group for user '${currentUser}'`);
                            allSuccess = false;
                            continue;
                        }

                        const fileName = resolvedPath.substring(resolvedPath.lastIndexOf('/') + 1);
                        const newFileNode = FileSystemManager._createNewFileNode(fileName, "", currentUser, primaryGroup);
                        newFileNode.mtime = timestampToUse;
                        parentNode.children[fileName] = newFileNode;
                        parentNode.mtime = new Date().toISOString();
                        changesMade = true;
                    }
                }

                if (changesMade && !(await FileSystemManager.save())) {
                    messages.push("touch: CRITICAL - Failed to save file system changes.");
                    allSuccess = false;
                }

                if (!allSuccess)
                    return {
                        success: false,
                        error: messages.join("\\n") || "touch: Not all operations were successful.",
                    };

                return { success: true, output: "" };
            } catch (e) {
                return { success: false, error: `touch: An unexpected error occurred: ${e.message}` };
            }
        },
    };

    const touchDescription = "Changes file timestamps or creates empty files.";
    const touchHelpText = `Usage: touch [OPTION]... FILE...

Change file timestamps.

DESCRIPTION
       The touch command updates the modification time of each FILE to
       the current time.

       A FILE argument that does not exist is created empty, unless the
       -c option is supplied.

OPTIONS
       -c, --no-create
              Do not create any files.

       -d, --date=<string>
              Parse <string> and use it instead of the current time.
              Examples: "1 day ago", "2025-01-01"

       -t <stamp>
              Use [[CC]YY]MMDDhhmm[.ss] instead of the current time.

EXAMPLES
       touch newfile.txt
              Creates 'newfile.txt' if it does not exist, or updates its
              modification time if it does.

       touch -c existing_file.txt
              Updates the timestamp of 'existing_file.txt' but will not
              create it if it's missing.`;

    CommandRegistry.register("touch", touchCommandDefinition, touchDescription, touchHelpText);
})();