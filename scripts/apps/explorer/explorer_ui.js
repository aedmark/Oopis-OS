// scripts/apps/explorer/explorer_ui.js

window.ExplorerUI = class ExplorerUI {
  constructor(callbacks, dependencies) {
    this.callbacks = callbacks;
    this.dependencies = dependencies;
    this.elements = {};
    this.activeContextMenu = null;

    this._buildLayout();
  }

  getContainer() {
    return this.elements.container;
  }

  _buildLayout() {
    const { Utils, UIComponents } = this.dependencies;

    const appWindow = UIComponents.createAppWindow('File Explorer', this.callbacks.onExit);
    this.elements.container = appWindow.container;
    this.elements.main = appWindow.main;
    this.elements.footer = appWindow.footer;

    this.elements.treePane = Utils.createElement("div", {
      id: "explorer-tree-pane",
      className: "explorer__tree-pane",
    });
    this.elements.mainPane = Utils.createElement("div", {
      id: "explorer-main-pane",
      className: "explorer__main-pane",
    });

    this.elements.main.append(this.elements.treePane, this.elements.mainPane);

    this.elements.statusBar = this.elements.footer;

    this.elements.mainPane.addEventListener("contextmenu", (e) => {
      e.preventDefault();

      const listItem = e.target.closest("li[data-path]");

      if (listItem) {
        const path = listItem.getAttribute("data-path");
        const name = listItem.querySelector(".explorer-item-name").textContent;
        const menuItems = [
          {
            label: "Rename...",
            callback: () => this.callbacks.onRename(path, name),
          },
          { label: "Delete", callback: () => this.callbacks.onDelete(path, name) },
          { label: "Move", callback: () => this.callbacks.onMove(path, null) },
        ];
        this._createContextMenu(menuItems, e.clientX, e.clientY);
      } else {
        const currentPath = this.elements.statusBar.textContent
            .split("  |")[0]
            .replace("Path: ", "");
        const menuItems = [
          {
            label: "New File...",
            callback: () => this.callbacks.onCreateFile(currentPath),
          },
          {
            label: "New Directory...",
            callback: () => this.callbacks.onCreateDirectory(currentPath),
          },
        ];
        this._createContextMenu(menuItems, e.clientX, e.clientY);
      }
    });

    document.addEventListener(
        "click",
        (e) => {
          if (this.activeContextMenu && !this.activeContextMenu.contains(e.target)) {
            this._removeContextMenu();
          }
        },
        true
    );
  }

  _removeContextMenu() {
    if (this.activeContextMenu) {
      this.activeContextMenu.remove();
      this.activeContextMenu = null;
    }
  }

  _createContextMenu(items, x, y) {
    this._removeContextMenu();
    const { Utils } = this.dependencies;

    const menu = Utils.createElement("div", { className: "context-menu" });
    menu.style.left = `${x}px`;
    menu.style.top = `${y}px`;

    menu.addEventListener("click", (e) => e.stopPropagation());

    items.forEach((item) => {
      if (item.separator) {
        menu.appendChild(
            Utils.createElement("div", { className: "context-menu-separator" })
        );
        return;
      }
      const menuItem = Utils.createElement("div", {
        className: "context-menu-item",
        textContent: item.label,
      });
      menuItem.addEventListener("click", () => {
        item.callback();
        this._removeContextMenu();
      });
      menu.appendChild(menuItem);
    });

    document.body.appendChild(menu);
    this.activeContextMenu = menu;
  }

  renderTree(treeData, selectedPath, expandedPaths) {
    if (!this.elements.treePane) return;
    const { Utils, FileSystemManager, UserManager } = this.dependencies;
    const treeRoot = Utils.createElement("ul", { className: "explorer-tree" });

    const createTreeItem = (node, path, name) => {
      const hasChildren =
          node.children &&
          Object.keys(node.children).filter(
              (childName) => node.children[childName].type === "directory"
          ).length > 0;
      const canRead = FileSystemManager.hasPermission(
          node,
          UserManager.getCurrentUser().name,
          "read"
      );

      const summary = Utils.createElement("summary");
      const folderIcon = Utils.createElement("span", {
        className: "mr-1",
        textContent: "📁",
      });
      const nameSpan = Utils.createElement("span", { textContent: name });
      summary.append(folderIcon, nameSpan);

      if (!canRead) {
        summary.classList.add("opacity-50", "italic");
      }

      const details = Utils.createElement(
          "details",
          { className: "explorer-tree-item", "data-path": path },
          summary
      );
      if (expandedPaths.has(path)) {
        details.open = true;
      }

      if (canRead && hasChildren) {
        const childList = Utils.createElement("ul", { className: "pl-4" });
        const sortedChildNames = Object.keys(node.children).sort();

        for (const childName of sortedChildNames) {
          const childNode = node.children[childName];
          if (childNode.type === "directory") {
            childList.appendChild(
                createTreeItem(
                    childNode,
                    `${path === "/" ? "" : path}/${childName}`,
                    childName
                )
            );
          }
        }
        details.appendChild(childList);
      }

      summary.addEventListener("click", (e) => {
        e.preventDefault();
        if (canRead) {
          this.callbacks.onTreeItemSelect(path);
        }
      });

      if (path === selectedPath) {
        summary.classList.add("selected");
      }

      return details;
    }

    treeRoot.appendChild(createTreeItem(treeData, "/", "/"));
    this.elements.treePane.innerHTML = "";
    this.elements.treePane.appendChild(treeRoot);
  }

  renderMainPane(items, currentPath) {
    if (!this.elements.mainPane) return;
    const { Utils, FileSystemManager } = this.dependencies;
    this.elements.mainPane.innerHTML = "";

    this.elements.mainPane.addEventListener("contextmenu", (e) => {
      e.preventDefault();
      e.stopPropagation();
      const menuItems = [
        {
          label: "New File...",
          callback: () => this.callbacks.onCreateFile(currentPath),
        },
        {
          label: "New Directory...",
          callback: () => this.callbacks.onCreateDirectory(currentPath),
        },
      ];
      this._createContextMenu(menuItems, e.clientX, e.clientY);
    });

    if (items.length === 0) {
      this.elements.mainPane.appendChild(
          Utils.createElement("div", {
            className: "p-4 text-zinc-500",
            textContent: "(Directory is empty)",
          })
      );
      return;
    }

    const list = Utils.createElement("ul", { className: "explorer-file-list" });
    items.forEach((item) => {
      const icon = Utils.createElement("span", {
        className: "mr-2 w-4 inline-block",
        textContent: item.type === "directory" ? "📁" : "📄",
      });
      const name = Utils.createElement("span", {
        className: "explorer-item-name",
        textContent: item.name,
      });
      const perms = Utils.createElement("span", {
        className: "explorer-item-perms",
        textContent: FileSystemManager.formatModeToString(item.node),
      });
      const size = Utils.createElement("span", {
        className: "explorer-item-size",
        textContent: item.type === "file" ? Utils.formatBytes(item.size) : "",
      });

      const li = Utils.createElement(
          "li",
          {
            "data-path": item.path,
            title: item.path,
          },
          icon,
          name,
          perms,
          size
      );

      li.addEventListener("dblclick", () =>
          this.callbacks.onMainItemActivate(item.path, item.type)
      );

      li.addEventListener("contextmenu", (e) => {
        e.preventDefault();
        e.stopPropagation();
        const menuItems = [
          {
            label: "Rename...",
            callback: () => this.callbacks.onRename(item.path, item.name),
          },
          {
            label: "Delete",
            callback: () => this.callbacks.onDelete(item.path, item.name),
          },
          { label: "Move", callback: () => this.callbacks.onMove(item.path, null) },
        ];
        this._createContextMenu(menuItems, e.clientX, e.clientY);
      });

      list.appendChild(li);
    });
    this.elements.mainPane.appendChild(list);
  }

  updateStatusBar(path, itemCount) {
    if (!this.elements.statusBar) return;
    this.elements.statusBar.textContent = `Path: ${path}  |  Items: ${itemCount}`;
  }

  setMoveCursor(isMoving) {
    if (this.elements.container) {
      this.elements.container.style.cursor = isMoving ? "move" : "default";
    }
  }

  highlightItem(path, isHighlighted) {
    const allItems = this.elements.mainPane.querySelectorAll("li");
    allItems.forEach((li) => {
      li.style.backgroundColor = "";
      li.style.color = "";
    });

    if (isHighlighted) {
      const itemElement = this.elements.mainPane.querySelector(
          `[data-path="${path}"]`
      );
      if (itemElement) {
        itemElement.style.backgroundColor = "var(--color-info)";
        itemElement.style.color = "var(--color-background-darkest)";
      }
    }
  }

  reset() {
    this._removeContextMenu();
    this.elements = {};
    this.callbacks = {};
  }
}
