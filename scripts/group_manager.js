/**
 * @file Manages all group-related logic for OopisOS.
 * @module GroupManager
 */
const GroupManager = (() => {
    "use strict";
    let groups = {};

    /**
     * Initializes the GroupManager by loading groups from storage and creating defaults.
     * @returns {void}
     */
    function initialize() {
        groups = StorageManager.loadItem(
            Config.STORAGE_KEYS.USER_GROUPS,
            "User Groups",
            {}
        );
        // Ensure default groups exist.
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

    /**
     * Saves the current group data to local storage.
     * @private
     * @returns {void}
     */
    function _save() {
        StorageManager.saveItem(
            Config.STORAGE_KEYS.USER_GROUPS,
            groups,
            "User Groups"
        );
    }

    /**
     * Checks if a group exists.
     * @param {string} groupName - The name of the group to check.
     * @returns {boolean} True if the group exists, false otherwise.
     */
    function groupExists(groupName) {
        return !!groups[groupName];
    }

    /**
     * Creates a new, empty group.
     * @param {string} groupName - The name for the new group.
     * @returns {boolean} True if the group was created, false if it already existed.
     */
    function createGroup(groupName) {
        if (groupExists(groupName)) {
            return false;
        }
        groups[groupName] = { members: [] };
        _save();
        return true;
    }

    /**
     * Adds a user to a supplementary group.
     * @param {string} username - The user to add.
     * @param {string} groupName - The group to add the user to.
     * @returns {boolean} True if the user was added, false if they were already a member or the group doesn't exist.
     */
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

    /**
     * Gets all groups a user belongs to (primary and supplementary).
     * @param {string} username - The user to query.
     * @returns {string[]} An array of group names.
     */
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

    /**
     * Deletes a group, unless it is a primary group for any user.
     * @param {string} groupName - The group to delete.
     * @returns {{success: boolean, error?: string}} An object indicating the result of the operation.
     */
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

    /**
     * Removes a user from all supplementary groups they are a member of.
     * @param {string} username - The username to remove from groups.
     * @returns {void}
     */
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

    /**
     * Public interface for GroupManager.
     */
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