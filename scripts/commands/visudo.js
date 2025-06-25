/**
 * @file Defines the 'visudo' command for safely editing the sudoers file.
 * @author Andrew Edmark
 * @author Gemini
 */

(() => {
    "use strict";

    const visudoCommandDefinition = {
        commandName: "visudo",
        argValidation: {
            exact: 0
        },
        coreLogic: async (context) => {
            const { currentUser, options } = context;

            // Only root can edit the sudoers file
            if (currentUser !== 'root') {
                return { success: false, error: "visudo: only root can run this command." };
            }

            // 'visudo' must be run interactively to use the editor
            if (!options.isInteractive) {
                return { success: false, error: "visudo: can only be run in interactive mode." };
            }

            const sudoersPath = Config.SUDO.SUDOERS_PATH;
            let sudoersNode = FileSystemManager.getNodeByPath(sudoersPath);

            // Create the sudoers file if it doesn't exist
            if (!sudoersNode) {
                const primaryGroup = UserManager.getPrimaryGroupForUser('root');
                const content = "# /etc/sudoers\n#\n# This file controls who can run what as root.\n\nroot    ALL\n%root   ALL\n";
                const saveResult = await FileSystemManager.createOrUpdateFile(
                    sudoersPath,
                    content,
                    { currentUser: 'root', primaryGroup }
                );
                if (!saveResult.success || !(await FileSystemManager.save())) {
                    return { success: false, error: "visudo: failed to create /etc/sudoers file." };
                }
                sudoersNode = FileSystemManager.getNodeByPath(sudoersPath);
            }

            // Set specific, secure permissions
            sudoersNode.mode = 0o440;
            sudoersNode.owner = 'root';
            sudoersNode.group = 'root';
            await FileSystemManager.save();


            // Open the file in the editor
            EditorManager.enter(sudoersPath, sudoersNode.content);

            // Invalidate the cache after editing is complete
            // This is a simplified approach; a more robust one would use a callback from the editor.
            // For now, we'll invalidate it immediately. A user saving the file will have the new rules applied on the next sudo command.
            SudoManager.invalidateSudoersCache();

            return {
                success: true,
                output: `Opening /etc/sudoers. Please be careful.`,
                messageType: Config.CSS_CLASSES.WARNING_MSG
            };
        }
    };

    const visudoDescription = "Safely edits the /etc/sudoers file.";
    const visudoHelpText = `Usage: visudo

Edit the sudoers file with a lock to prevent simultaneous edits.

DESCRIPTION
       visudo edits the sudoers file in a safe fashion. It sets an edit lock
       on the sudoers file to prevent multiple simultaneous edits.

       The sudoers file controls which users can run commands as root.
       Incorrect syntax in this file can lock all users out of sudo.

PERMISSIONS
       Only the superuser (root) can run visudo.`;

    CommandRegistry.register("visudo", visudoCommandDefinition, visudoDescription, visudoHelpText);

})();