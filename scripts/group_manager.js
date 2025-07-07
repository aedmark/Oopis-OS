const GroupManager = (() => {
    "use strict";
    let groups = {};

    function initialize() {
        groups = StorageManager.loadItem(
            Config.STORAGE_KEYS.USER_GROUPS,
            "User Groups",
            {}
        );
        if (!groups["root"]) {
            createGroup("root");
            addUserToGroup("root", "root");
        }
        if (!groups["Guest"]) {
            createGroup("Guest");
            addUserToGroup("Guest", "Guest");
        }
        if (!groups["userDiag"]) {
            createGroup("userDiag");
            addUserToGroup("userDiag", "userDiag");
        }
        console.log("GroupManager initialized.");
    }

    function _save() {
        StorageManager.saveItem(
            Config.STORAGE_KEYS.USER_GROUPS,
            groups,
            "User Groups"
        );
    }

    function groupExists(groupName) {
        return !!groups[groupName];
    }

    function createGroup(groupName) {
        if (groupExists(groupName)) {
            return false;
        }
        groups[groupName] = { members: [] };
        _save();
        return true;
    }

    function addUserToGroup(username, groupName) {
        if (
            groupExists(groupName) &&
            !groups[groupName].members.includes(username)
        ) {
            groups[groupName].members.push(username);
            _save();
            return true;
        }
        return false;
    }

    function getGroupsForUser(username) {
        const userGroups = [];
        const users = StorageManager.loadItem(
            Config.STORAGE_KEYS.USER_CREDENTIALS,
            "User list",
            {}
        );
        const primaryGroup = users[username]?.primaryGroup;

        if (primaryGroup) {
            userGroups.push(primaryGroup);
        }

        for (const groupName in groups) {
            if (
                groups[groupName].members &&
                groups[groupName].members.includes(username)
            ) {
                if (!userGroups.includes(groupName)) {
                    userGroups.push(groupName);
                }
            }
        }
        return userGroups;
    }

    function deleteGroup(groupName) {
        if (!groupExists(groupName)) {
            return { success: false, error: `group '${groupName}' does not exist.` };
        }

        const users = StorageManager.loadItem(Config.STORAGE_KEYS.USER_CREDENTIALS, "User list", {});
        for (const username in users) {
            if (users[username].primaryGroup === groupName) {
                return { success: false, error: `cannot remove group '${groupName}': it is the primary group of user '${username}'.` };
            }
        }

        delete groups[groupName];
        _save();
        return { success: true };
    }

    function removeUserFromAllGroups(username) {
        let changed = false;
        for (const groupName in groups) {
            const index = groups[groupName].members.indexOf(username);
            if (index > -1) {
                groups[groupName].members.splice(index, 1);
                changed = true;
            }
        }
        if (changed) {
            _save();
        }
    }

    return {
        initialize,
        createGroup,
        deleteGroup,
        addUserToGroup,
        removeUserFromAllGroups,
        getGroupsForUser,
        groupExists,
    };
})();