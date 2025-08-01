// scripts/apps/top/top_manager.js

window.TopManager = class TopManager extends App {
    constructor() {
        super();
        this.state = {};
        this.dependencies = {};
        this.callbacks = {};
        this.ui = null;
        this.updateInterval = null;
    }

    enter(appLayer, options = {}) {
        if (this.isActive) return;

        this.dependencies = options.dependencies;
        this.callbacks = this._createCallbacks();
        this.isActive = true;

        this.ui = new this.dependencies.TopUI(this.callbacks, this.dependencies);
        this.container = this.ui.getContainer();
        appLayer.appendChild(this.container);

        this.updateInterval = setInterval(() => this._updateProcessList(), 1000);
        this._updateProcessList();
    }

    exit() {
        if (!this.isActive) return;
        const { AppLayerManager } = this.dependencies;

        clearInterval(this.updateInterval);
        this.updateInterval = null;

        if (this.ui) {
            this.ui.hideAndReset();
        }
        AppLayerManager.hide(this);
        this.isActive = false;
        this.state = {};
        this.ui = null;
    }

    handleKeyDown(event) {
        if (event.key === "q") {
            this.exit();
        }
    }

    _createCallbacks() {
        return {
            onExit: this.exit.bind(this),
        };
    }

    _updateProcessList() {
        const { CommandExecutor } = this.dependencies;
        const jobs = CommandExecutor.getActiveJobs();
        const processes = Object.keys(jobs).map(pid => {
            const job = jobs[pid];
            return {
                pid: pid,
                user: job.user || 'system',
                status: job.status.toUpperCase().charAt(0),
                command: job.command,
            };
        });

        if (this.ui) {
            this.ui.render(processes);
        }
    }
}
