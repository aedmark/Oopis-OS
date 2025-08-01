// scripts/apps/log/log_ui.js

window.LogUI = class LogUI {
  constructor(callbacks, dependencies) {
    this.elements = {};
    this.callbacks = callbacks;
    this.dependencies = dependencies;
    this._buildLayout();
  }

  getContainer() {
    return this.elements.container;
  }

  _buildLayout() {
    const { Utils, UIComponents } = this.dependencies;

    const appWindow = UIComponents.createAppWindow("Captain's Log", this.callbacks.onExit);
    this.elements.container = appWindow.container;
    this.elements.header = appWindow.header;
    this.elements.main = appWindow.main;

    this.elements.searchBar = Utils.createElement("input", {
      id: "log-search-bar",
      type: "text",
      placeholder: "Search entries...",
      className: "log-app__search",
    });

    this.elements.newBtn = Utils.createElement("button", {
      id: "log-new-btn",
      textContent: "New Entry",
      className: "btn",
    });
    this.elements.saveBtn = Utils.createElement("button", {
      id: "log-save-btn",
      textContent: "Save Changes",
      className: "btn hidden",
    });

    const actionButtons = Utils.createElement("div", { className: "log-app__actions" }, [
      this.elements.newBtn,
      this.elements.saveBtn,
    ]);

    this.elements.header.append(this.elements.searchBar, actionButtons);

    this.elements.entryList = Utils.createElement("div", {
      id: "log-entry-list",
      className: "log-app__list-pane",
    });
    this.elements.contentView = Utils.createElement("textarea", {
      id: "log-content-view",
      className: "log-app__content-pane",
      placeholder: "Select an entry to view or edit...",
    });

    this.elements.main.append(this.elements.entryList, this.elements.contentView);

    this.elements.searchBar.addEventListener("input", () =>
        this.callbacks.onSearch(this.elements.searchBar.value)
    );
    this.elements.newBtn.addEventListener("click", () => this.callbacks.onNew());
    this.elements.saveBtn.addEventListener("click", () => this.callbacks.onSave());
    this.elements.contentView.addEventListener("input", () =>
        this.callbacks.onContentChange(this.elements.contentView.value)
    );
  }

  renderEntries(entries, selectedPath) {
    if (!this.elements.entryList) return;
    const { Utils } = this.dependencies;
    this.elements.entryList.innerHTML = "";
    if (entries.length === 0) {
      this.elements.entryList.textContent = "No entries found.";
      return;
    }
    entries.forEach((entry) => {
      const date = new Date(entry.timestamp);
      const title =
          entry.content
              .split("\n")[0]
              .replace(/^#+\s*/, "")
              .substring(0, 40) || "(Untitled)";
      const item = Utils.createElement(
          "div",
          {
            className: "log-app__list-item",
            "data-path": entry.path,
          },
          [
            Utils.createElement("strong", { textContent: date.toLocaleString() }),
            Utils.createElement("span", { textContent: title }),
          ]
      );
      if (entry.path === selectedPath) {
        item.classList.add("selected");
      }
      item.addEventListener("click", () => this.callbacks.onSelect(entry.path));
      this.elements.entryList.appendChild(item);
    });
  }

  renderContent(entry) {
    if (!this.elements.contentView) return;
    if (!entry) {
      this.elements.contentView.value = "";
      this.elements.contentView.placeholder = "Select an entry to view or edit...";
      this.elements.saveBtn.classList.add("hidden");
      return;
    }
    this.elements.contentView.value = entry.content;
  }

  updateSaveButton(isDirty) {
    if (this.elements.saveBtn) {
      this.elements.saveBtn.classList.toggle("hidden", !isDirty);
    }
  }

  getContent() {
    return this.elements.contentView ? this.elements.contentView.value : "";
  }

  reset() {
    this.elements = {};
    this.callbacks = {};
    this.dependencies = {};
  }
}
