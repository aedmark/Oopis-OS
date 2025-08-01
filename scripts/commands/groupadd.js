// scripts/commands/groupadd.js

window.GroupaddCommand = class GroupaddCommand extends Command {
    constructor() {
        super({
            commandName: "groupadd",
            description: "Creates a new user group.",
            helpText: `Usage: groupadd <groupname>
      Create a new user group.
      DESCRIPTION
      The groupadd command creates a new group with the specified
      <groupname>. Once a group is created, users can be added to it
      with the 'usermod' command, and file group ownership can be
      changed with the 'chgrp' command to manage permissions for
      shared resources.
      Group names cannot contain spaces.
      EXAMPLES
      groupadd developers
      Creates a new group named 'developers'.
      PERMISSIONS
      Only the superuser (root) can create new groups.`,
            validations: {
                args: {
                    exact: 1,
                    error: "Usage: groupadd <groupname>"
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
                "groupadd: only root can add groups."
            );
        }

        if (GroupManager.groupExists(groupName)) {
            return ErrorHandler.createError(
                `groupadd: group '${groupName}' already exists.`
            );
        }

        GroupManager.createGroup(groupName);

        return ErrorHandler.createSuccess(`Group '${groupName}' created.`);
    }
}

window.CommandRegistry.register(new GroupaddCommand());
