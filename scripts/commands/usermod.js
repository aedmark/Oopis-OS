(() => {
    "use strict";

    const usermodCommandDefinition = {
        commandName: "usermod",
        argValidation: {
            exact: 3, // Requires exactly three arguments: flag, groupname, username.
            error: "Usage: usermod -aG <groupname> <username>",
        },

        coreLogic: async (context) => {
            const { args, currentUser } = context;
            const flag = args[0];
            const groupName = args[1];
            const username = args[2];

            if (currentUser !== "root") {
                return {
                    success: false,
                    error: "usermod: only root can modify user groups.",
                };
            }

            if (flag !== "-aG") {
                return {
                    success: false,
                    error: "usermod: invalid flag. Only '-aG' is supported.",
                };
            }

            if (!GroupManager.groupExists(groupName)) {
                return {
                    success: false,
                    error: `usermod: group '${groupName}' does not exist.`,
                };
            }

            if (!await UserManager.userExists(username) && username !== Config.USER.DEFAULT_NAME) {
                return {
                    success: false,
                    error: `usermod: user '${username}' does not exist.`,
                };
            }

            if (GroupManager.addUserToGroup(username, groupName)) {
                return {
                    success: true,
                    output: `Added user '${username}' to group '${groupName}'.`,
                };
            } else {
                return {
                    success: true,
                    output: `User '${username}' is already in group '${groupName}'.`,
                    messageType: Config.CSS_CLASSES.CONSOLE_LOG_MSG, // Informational message.
                };
            }
        },
    };

    const usermodDescription = "Modifies a user account, primarily for group membership.";

    const usermodHelpText = `Usage: usermod -aG <groupname> <username>

Modify a user account.

DESCRIPTION
       The usermod command modifies the user account specified by
       <username>. Its primary function in OopisOS is to add a user to a
       supplementary group.

OPTIONS
       -aG <groupname>
              Add the user to the supplementary <groupname>. The -a flag
              (append) is important to ensure the user is not removed
              from other groups. The -G flag specifies that we are
              modifying a group membership. In OopisOS, these flags
              must be used together.

PERMISSIONS
       Only the superuser (root) can modify user accounts.

EXAMPLES
       usermod -aG developers newdev
              Adds the user 'newdev' to the 'developers' group.`;

    CommandRegistry.register("usermod", usermodCommandDefinition, usermodDescription, usermodHelpText);
})();