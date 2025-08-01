// gem/scripts/apps/desktop/taskbar_manager.js

window.TaskbarManager = class TaskbarManager {
    constructor(desktopContainer, windowManager, dependencies) {
        this.desktopContainer = desktopContainer;
        this.windowManager = windowManager;
        this.dependencies = dependencies;
        this.ui = new this.dependencies.TaskbarUI({
            onTaskClick: (windowId) => this.windowManager.focusWindow(windowId)
        }, this.dependencies);

        this.desktopContainer.appendChild(this.ui.getContainer());
    }

    addWindow(windowId, title) {
        this.ui.addTask(windowId, title);
    }

    removeWindow(windowId) {
        this.ui.removeTask(windowId);
    }

    updateActiveWindow(windowId) {
        this.ui.setActive(windowId);
    }
}
