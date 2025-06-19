// scripts/commands/groupdel.js

(() => {
    "use strict";

    const groupdelCommandDefinition = {
    commandName: "groupdel",
    argValidation: { exact: 1, error: "Usage: groupdel <groupname>" },
    coreLogic: async (context) => {
        const { args, currentUser } = context;
        const groupName = args[0];

        if (currentUser !== "root") {
            return { success: false, error: "groupdel: only root can delete groups." };
        }

        const result = GroupManager.deleteGroup(groupName);

        if (!result.success) {
            return { success: false, error: `groupdel: ${result.error}` };
        }

        return { success: true, output: `Group '${groupName}' deleted.`, messageType: Config.CSS_CLASSES.SUCCESS_MSG };
    },
};

    const groupdelDescription = "Deletes a group.";
    const groupdelHelpText = "Usage: groupdel <groupname>\n\nDeletes the specified group.";

    CommandRegistry.register("groupdel", groupdelCommandDefinition, groupdelDescription, groupdelHelpText);
})();