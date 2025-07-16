// scripts/commands/chown.js
(() => {
    "use strict";

    const chownCommandDefinition = {
        commandName: "chown",
        completionType: "users", // Preserved for tab completion
        argValidation: {
            exact: 2,
            error: "Usage: chown <new_owner> <path>",
        },
        coreLogic: async (context) => {
            const { args, currentUser } = context;
            const newOwnerArg = args[0];
            const pathArg = args[1];
            const nowISO = new Date().toISOString();

            try {
                if (!await UserManager.userExists(newOwnerArg) && newOwnerArg !== Config.USER.DEFAULT_NAME) {
                    return {
                        success: false,
                        error: `chown: user '${newOwnerArg}' does not exist.`,
                    };
                }

                const pathValidation = FileSystemManager.validatePath(pathArg);
                if (pathValidation.error) {
                    return { success: false, error: `chown: cannot access '${pathArg}': ${pathValidation.error}` };
                }
                const node = pathValidation.node;

                if (!FileSystemManager.canUserModifyNode(node, currentUser)) {
                    return {
                        success: false,
                        error: `chown: changing ownership of '${pathArg}': Operation not permitted`,
                    };
                }

                node.owner = newOwnerArg;
                node.mtime = nowISO;

                if (!(await FileSystemManager.save(currentUser))) {
                    return {
                        success: false,
                        error: "chown: Failed to save file system changes.",
                    };
                }
                return {
                    success: true,
                    output: "", // No output on success
                };
            } catch (e) {
                return { success: false, error: `chown: An unexpected error occurred: ${e.message}` };
            }
        },
    };

    const chownDescription = "Changes the user ownership of a file or directory.";
    const chownHelpText = `Usage: chown <owner> <path>

Change the user ownership of a file or directory.

DESCRIPTION
       The chown command changes the user ownership of the file or
       directory specified by <path> to <owner>. The <owner> must be a
       valid, existing user on the system.

       Use the 'ls -l' command to view the current owner of a file.

EXAMPLES
       chown Guest /home/root/somefile
              Changes the owner of 'somefile' from 'root' to 'Guest'.

PERMISSIONS
       Only the superuser (root) can change the ownership of a file.`;

    CommandRegistry.register("chown", chownCommandDefinition, chownDescription, chownHelpText);
})();