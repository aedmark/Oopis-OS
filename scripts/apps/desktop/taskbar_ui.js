// gem/scripts/apps/desktop/taskbar_ui.js

window.TaskbarUI = class TaskbarUI {
    constructor(callbacks, dependencies) {
        this.callbacks = callbacks;
        this.dependencies = dependencies;
        this.elements = {};
        this._buildLayout();
    }

    getContainer() {
        return this.elements.container;
    }

    _buildLayout() {
        const { Utils } = this.dependencies;
        this.elements.container = Utils.createElement('div', { id: 'taskbar', className: 'taskbar' });
        this.elements.taskList = Utils.createElement('div', { className: 'taskbar__task-list' });
        this.elements.container.appendChild(this.elements.taskList);
    }

    addTask(windowId, title) {
        const { UIComponents } = this.dependencies;
        const button = UIComponents.createButton({
            text: title,
            classes: ['taskbar-button'],
            onClick: () => this.callbacks.onTaskClick(windowId)
        });
        button.dataset.windowId = windowId;
        this.elements.taskList.appendChild(button);
        return button;
    }

    removeTask(windowId) {
        const button = this.elements.taskList.querySelector(`[data-window-id="${windowId}"]`);
        if (button) {
            button.remove();
        }
    }

    setActive(windowId) {
        Array.from(this.elements.taskList.children).forEach(btn => {
            btn.classList.remove('active');
        });

        const button = this.elements.taskList.querySelector(`[data-window-id="${windowId}"]`);
        if (button) {
            button.classList.add('active');
        }
    }
}
