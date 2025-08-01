// scripts/apps/log/log_manager.js

window.LogManager = class LogManager extends App {
  constructor() {
    super();
    this.state = {};
    this.dependencies = {};
    this.callbacks = {};
    this.ui = null;
    this.LOG_DIR = "/home/Guest/.journal";
  }

  async enter(appLayer, options = {}) {
    if (this.isActive) return;
    this.dependencies = options.dependencies;
    this.callbacks = this._createCallbacks();

    this.isActive = true;
    this.state = {
      allEntries: [],
      filteredEntries: [],
      selectedPath: null,
      isDirty: false,
    };

    this.ui = new this.dependencies.LogUI(this.callbacks, this.dependencies);
    this.container = this.ui.getContainer();
    appLayer.appendChild(this.container);

    await this._ensureLogDir();
    await this._loadEntries();

    this.ui.renderEntries(this.state.filteredEntries, null);
    this.ui.renderContent(null);
  }

  exit() {
    if (!this.isActive) return;
    const { AppLayerManager, ModalManager } = this.dependencies;
    const performExit = () => {
      if (this.ui) {
        this.ui.reset();
      }
      AppLayerManager.hide(this);
      this.isActive = false;
      this.state = {};
      this.ui = null;
    };

    if (this.state.isDirty) {
      ModalManager.request({
        context: "graphical",
        type: "confirm",
        messageLines: [
          "You have unsaved changes that will be lost.",
          "Exit without saving?",
        ],
        onConfirm: performExit,
        onCancel: () => { },
      });
    } else {
      performExit();
    }
  }

  async handleKeyDown(event) {
    if (!this.isActive) return;
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") {
      event.preventDefault();
      await this.callbacks.onSave();
    } else if (event.key === "Escape") {
      this.exit();
    }
  }

  async quickAdd(entryText, currentUser) {
    const { FileSystemManager, UserManager } = this.dependencies;
    await this._ensureLogDir();
    const timestamp = new Date().toISOString();
    const filename = `${timestamp.replace(/[:.]/g, "-")}.md`;
    const fullPath = `${this.LOG_DIR}/${filename}`;

    const saveResult = await FileSystemManager.createOrUpdateFile(
        fullPath,
        entryText,
        {
          currentUser: currentUser,
          primaryGroup: UserManager.getPrimaryGroupForUser(currentUser),
        }
    );

    if (!saveResult.success) {
      return { success: false, error: saveResult.error };
    }
    await FileSystemManager.save();
    return {
      success: true,
      message: `Log entry saved to ${fullPath}`,
      path: fullPath,
    };
  }

  _createCallbacks() {
    return {
      onExit: this.exit.bind(this),
      onSearch: (query) => {
        this.state.filteredEntries = this.state.allEntries.filter((e) =>
            e.content.toLowerCase().includes(query.toLowerCase())
        );
        this.ui.renderEntries(
            this.state.filteredEntries,
            this.state.selectedPath
        );
      },
      onSelect: async (path) => {
        const { ModalManager } = this.dependencies;
        if (this.state.isDirty) {
          const confirmed = await new Promise((r) =>
              ModalManager.request({
                context: "graphical",
                type: "confirm",
                messageLines: ["You have unsaved changes. Discard them?"],
                onConfirm: () => r(true),
                onCancel: () => r(false),
              })
          );
          if (!confirmed) return;
        }
        this.state.selectedPath = path;
        const selectedEntry = this.state.allEntries.find(
            (e) => e.path === path
        );
        this.ui.renderContent(selectedEntry);
        this.ui.renderEntries(
            this.state.filteredEntries,
            this.state.selectedPath
        );
        this.state.isDirty = false;
        this.ui.updateSaveButton(false);
      },
      onNew: async () => {
        const { ModalManager, UserManager } = this.dependencies;
        const title = await new Promise((resolve) =>
            ModalManager.request({
              context: "graphical",
              type: "input",
              messageLines: ["Enter New Log Title:"],
              placeholder: "A new beginning...",
              onConfirm: (value) => resolve(value),
              onCancel: () => resolve(null),
            })
        );
        if (title) {
          const newContent = `# ${title}`;
          const result = await this.quickAdd(
              newContent,
              UserManager.getCurrentUser().name
          );
          if (result.success) {
            await this._loadEntries();
            await this.callbacks.onSelect(result.path);
          }
        }
      },
      onSave: async () => {
        if (!this.state.selectedPath || !this.state.isDirty) return;
        const newContent = this.ui.getContent();
        const result = await this._saveEntry(
            this.state.selectedPath,
            newContent
        );
        if (result.success) {
          const entryIndex = this.state.allEntries.findIndex(
              (e) => e.path === this.state.selectedPath
          );
          if (entryIndex > -1) {
            this.state.allEntries[entryIndex].content = newContent;
          }
          this.state.isDirty = false;
          this.ui.updateSaveButton(false);
        } else {
          alert(`Error saving: ${result.error}`);
        }
      },
      onContentChange: () => {
        const selectedEntry = this.state.allEntries.find(
            (e) => e.path === this.state.selectedPath
        );
        if (!selectedEntry) return;
        const newContent = this.ui.getContent();
        this.state.isDirty = newContent !== selectedEntry.content;
        this.ui.updateSaveButton(this.state.isDirty);
      },
    };
  }

  async _saveEntry(path, content) {
    const { FileSystemManager, UserManager } = this.dependencies;
    const result = await FileSystemManager.createOrUpdateFile(path, content, {
      currentUser: UserManager.getCurrentUser().name,
      primaryGroup: UserManager.getPrimaryGroupForUser(
          UserManager.getCurrentUser().name
      ),
    });
    if (result.success) await FileSystemManager.save();
    return result;
  }

  async _ensureLogDir() {
    const { FileSystemManager, CommandExecutor } = this.dependencies;
    const pathInfo = FileSystemManager.validatePath(this.LOG_DIR, {
      allowMissing: true,
    });
    if (!pathInfo.data.node) {
      await CommandExecutor.processSingleCommand(`mkdir -p ${this.LOG_DIR}`, {
        isInteractive: false,
      });
    }
  }

  async _loadEntries() {
    const { FileSystemManager } = this.dependencies;
    this.state.allEntries = [];
    const dirNode = FileSystemManager.getNodeByPath(this.LOG_DIR);
    if (dirNode && dirNode.children) {
      for (const filename in dirNode.children) {
        if (filename.endsWith(".md")) {
          const fileNode = dirNode.children[filename];
          const rawTimestamp = filename.replace(".md", "");
          const isoString =
              rawTimestamp.substring(0, 10) +
              "T" +
              rawTimestamp.substring(11, 13) +
              ":" +
              rawTimestamp.substring(14, 16) +
              ":" +
              rawTimestamp.substring(17, 19) +
              "." +
              rawTimestamp.substring(20, 23) +
              "Z";
          this.state.allEntries.push({
            timestamp: new Date(isoString),
            content: fileNode.content || "",
            path: `${this.LOG_DIR}/${filename}`,
          });
        }
      }
    }
    this.state.allEntries.sort((a, b) => b.timestamp - a.timestamp);
    this.state.filteredEntries = [...this.state.allEntries];
  }
}
