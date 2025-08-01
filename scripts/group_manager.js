// scripts/group_manager.js

class GroupManager {
  constructor() {
    this.groups = {};
    this.dependencies = {};
  }

  setDependencies(dependencies) {
    this.dependencies = dependencies;
  }

  initialize() {
    const { StorageManager, Config } = this.dependencies;
    this.groups = StorageManager.loadItem(
        Config.STORAGE_KEYS.USER_GROUPS,
        "User Groups",
        {}
    );
    if (!this.groups["root"]) {
      this.createGroup("root");
      this.addUserToGroup("root", "root");
    }
    if (!this.groups["Guest"]) {
      this.createGroup("Guest");
      this.addUserToGroup("Guest", "Guest");
    }
    if (!this.groups["userDiag"]) {
      this.createGroup("userDiag");
      this.addUserToGroup("userDiag", "userDiag");
    }
    if (!this.groups["towncrier"]) {
      this.createGroup("towncrier");
    }
    console.log("GroupManager initialized.");
  }

  _save() {
    const { StorageManager, Config } = this.dependencies;
    StorageManager.saveItem(
        Config.STORAGE_KEYS.USER_GROUPS,
        this.groups,
        "User Groups"
    );
  }

  groupExists(groupName) {
    return !!this.groups[groupName];
  }

  createGroup(groupName) {
    if (this.groupExists(groupName)) {
      return false;
    }
    this.groups[groupName] = { members: [] };
    this._save();
    return true;
  }

  addUserToGroup(username, groupName) {
    if (
        this.groupExists(groupName) &&
        !this.groups[groupName].members.includes(username)
    ) {
      this.groups[groupName].members.push(username);
      this._save();
      return true;
    }
    return false;
  }

  getGroupsForUser(username) {
    const { StorageManager, Config } = this.dependencies;
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

    for (const groupName in this.groups) {
      if (
          this.groups[groupName].members &&
          this.groups[groupName].members.includes(username)
      ) {
        if (!userGroups.includes(groupName)) {
          userGroups.push(groupName);
        }
      }
    }
    return userGroups;
  }

  deleteGroup(groupName) {
    const { StorageManager } = this.dependencies;
    if (!this.groupExists(groupName)) {
      return { success: false, error: `group '${groupName}' does not exist.` };
    }

    const users = StorageManager.loadItem(
        this.dependencies.Config.STORAGE_KEYS.USER_CREDENTIALS,
        "User list",
        {}
    );
    for (const username in users) {
      if (users[username].primaryGroup === groupName) {
        return {
          success: false,
          error: `cannot remove group '${groupName}': it is the primary group of user '${username}'.`,
        };
      }
    }

    delete this.groups[groupName];
    this._save();
    return { success: true };
  }

  removeUserFromAllGroups(username) {
    let changed = false;
    for (const groupName in this.groups) {
      const index = this.groups[groupName].members.indexOf(username);
      if (index > -1) {
        this.groups[groupName].members.splice(index, 1);
        changed = true;
      }
    }
    if (changed) {
      this._save();
    }
  }
}