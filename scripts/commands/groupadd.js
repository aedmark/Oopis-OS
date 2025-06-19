// scripts/commands/groupadd.js

(() => {
    "use strict";
    const groupaddCommandDefinition = {
        commandName: "groupadd",
        argValidation: { exact: 1, error: "Usage: groupadd <groupname>" },
        coreLogic: async (context) => {
            const { args, currentUser } = context;
            const groupName = args[0];

            if (currentUser !== "root") {
                return { success: false, error: "groupadd: only root can add groups." };
            }
            if (GroupManager.groupExists(groupName)) {
                return {
                    success: false,
                    error: `groupadd: group '${groupName}' already exists.`,
                };
            }

            GroupManager.createGroup(groupName);
            return { success: true, output: `Group '${groupName}' created.` };
        },
    };
    const groupaddDescription = "Creates a new group.";
    const groupaddHelpText = "Usage: groupadd <groupname>\n\nCreates a new group with the specified name.";
    CommandRegistry.register("groupadd", groupaddCommandDefinition, groupaddDescription, groupaddHelpText);
})();