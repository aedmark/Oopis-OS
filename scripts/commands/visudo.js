(() => {
    "use strict";

    const visudoCommandDefinition = {
        commandName: "visudo",
        argValidation: {
            exact: 0
        },
        coreLogic: async (context) => {
            const { currentUser, options } = context;

            if (currentUser !== 'root') {
                return { success: false, error: "visudo: only root can run this command." };
            }

            if (!options.isInteractive) {
                return { success: false, error: "visudo: can only be run in interactive mode." };
            }

            const sudoersPath = Config.SUDO.SUDOERS_PATH;
            let sudoersNode = FileSystemManager.getNodeByPath(sudoersPath);

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

            const onSudoersSave = async (filePath) => {
                const node = FileSystemManager.getNodeByPath(filePath);
                if (node) {
                    node.mode = 0o440;
                    node.owner = 'root';
                    node.group = 'root';
                    await FileSystemManager.save();
                    SudoManager.invalidateSudoersCache();
                    await OutputManager.appendToOutput("visudo: /etc/sudoers secured and cache invalidated.", {typeClass: Config.CSS_CLASSES.SUCCESS_MSG});
                } else {
                    await OutputManager.appendToOutput("visudo: CRITICAL - Could not find sudoers file after save to apply security.", {typeClass: Config.CSS_CLASSES.ERROR_MSG});
                }
            };

            EditorManager.enter(sudoersPath, sudoersNode.content, onSudoersSave);

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

SYNTAX
       The /etc/sudoers file uses a simple, space-separated format.
       Lines starting with '#' are comments.

       RULE FORMAT:
       <who>    <permission>

       <who>:
           A username (e.g., guest)
           A group name, prefixed with '%' (e.g., %developers)

       <permission>:
           ALL             - The user/group can run all commands.
           (command_name)  - The user/group can only run the specified command.

       EXAMPLES
           # Give the user 'admin' full root privileges
           admin    ALL

           # Allow anyone in the 'testers' group to run the 'reboot' command
           %testers reboot

           # Set the password timeout to 30 minutes (0 to always ask)
           Defaults timestamp_timeout=30

PERMISSIONS
       Only the superuser (root) can run visudo.`;

    CommandRegistry.register("visudo", visudoCommandDefinition, visudoDescription, visudoHelpText);

})();