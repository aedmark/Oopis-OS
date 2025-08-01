// scripts/commands/groupdel.js

window.GroupdelCommand = class GroupdelCommand extends Command {
    constructor() {
        super({
            commandName: "groupdel",
            description: "Deletes an existing user group.",
            helpText: `Usage: groupdel <groupname>
      Delete an existing user group.
      DESCRIPTION
      The groupdel command deletes the group specified by <groupname>.
      You cannot remove the primary group of an existing user. You must
      either delete the user first ('removeuser') or change their
      primary group before deleting the group.
      EXAMPLES
      groupdel developers
      Deletes the group named 'developers'.
      PERMISSIONS
      Only the superuser (root) can delete groups.`,
            validations: {
                args: {
                    exact: 1,
                    error: "Usage: groupdel <groupname>"
                }
            },
        });
    }

    async coreLogic(context) {
        const { args, currentUser, dependencies } = context;
        const { GroupManager, ErrorHandler } = dependencies;
        const groupName = args[0];

        if (currentUser !== "root") {
            return ErrorHandler.createError(
                "groupdel: only root can delete groups."
            );
        }

        const result = GroupManager.deleteGroup(groupName);

        if (!result.success) {
            return ErrorHandler.createError(`groupdel: ${result.error}`);
        }

        return ErrorHandler.createSuccess(`Group '${groupName}' deleted.`);
    }
}

window.CommandRegistry.register(new GroupdelCommand());
