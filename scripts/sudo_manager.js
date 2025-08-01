// scripts/sudo_manager.js

class SudoManager {
  constructor() {
    this.sudoersConfig = null;
    this.userSudoTimestamps = {};
    this.fsManager = null;
    this.groupManager = null;
    this.config = null;
  }

  setDependencies(fsManager, groupManager, config) {
    this.fsManager = fsManager;
    this.groupManager = groupManager;
    this.config = config;
  }

  _parseSudoers() {
    const sudoersNode = this.fsManager.getNodeByPath(
        this.config.SUDO.SUDOERS_PATH
    );
    if (!sudoersNode || sudoersNode.type !== "file") {
      this.sudoersConfig = {
        users: {},
        groups: {},
        timeout: this.config.SUDO.DEFAULT_TIMEOUT,
      };
      return;
    }

    const content = sudoersNode.content || "";
    const lines = content.split("\n");
    const config = {
      users: {},
      groups: {},
      timeout: this.config.SUDO.DEFAULT_TIMEOUT,
    };

    lines.forEach((line) => {
      line = line.trim();
      if (line.startsWith("#") || line === "") return;

      if (line.toLowerCase().startsWith("defaults timestamp_timeout=")) {
        const timeoutValue = parseInt(line.split("=")[1], 10);
        if (!isNaN(timeoutValue) && timeoutValue >= 0) {
          config.timeout = timeoutValue;
        }
        return;
      }

      const parts = line.split(/\s+/);
      if (parts.length < 2) {
        console.warn(
            `SudoManager: Malformed line in /etc/sudoers: "${line}". Ignoring.`
        );
        return;
      }

      const entity = parts[0];
      const permissions = parts.slice(1).join(" ");

      if (entity.startsWith("%")) {
        config.groups[entity.substring(1)] = permissions;
      } else {
        config.users[entity] = permissions;
      }
    });
    this.sudoersConfig = config;
  }

  _getSudoersConfig() {
    this._parseSudoers();
    return this.sudoersConfig;
  }

  invalidateSudoersCache() {
    this.sudoersConfig = null;
  }

  isUserTimestampValid(username) {
    const timestamp = this.userSudoTimestamps[username];
    if (!timestamp) return false;

    const config = this._getSudoersConfig();
    const timeoutMinutes = config.timeout || 0;
    if (timeoutMinutes <= 0) return false;

    const now = new Date().getTime();
    const elapsedMinutes = (now - timestamp) / (1000 * 60);

    return elapsedMinutes < timeoutMinutes;
  }

  updateUserTimestamp(username) {
    this.userSudoTimestamps[username] = new Date().getTime();
  }

  clearUserTimestamp(username) {
    if (this.userSudoTimestamps[username]) {
      delete this.userSudoTimestamps[username];
    }
  }

  canUserRunCommand(username, commandToRun) {
    if (username === "root") return true;

    const config = this._getSudoersConfig();
    let userPermissions = config.users[username];

    if (!userPermissions) {
      const userGroups = this.groupManager.getGroupsForUser(username);
      for (const group of userGroups) {
        if (config.groups[group]) {
          userPermissions = config.groups[group];
          break;
        }
      }
    }

    if (!userPermissions) return false;
    if (userPermissions.trim() === "ALL") return true;

    const allowedCommands = userPermissions.split(",").map((cmd) => cmd.trim());

    for (const allowed of allowedCommands) {
      if (allowed === commandToRun || allowed.endsWith("/" + commandToRun)) {
        return true;
      }
    }

    return false;
  }
}