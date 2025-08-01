// gem/scripts/apps/desktop/app_launcher.js

/**
 * Manages launching applications based on file extensions in the desktop environment
 */
window.AppLauncher = class AppLauncher {
    /**
     * @param {Object} windowManager - Window management system
     * @param {Object} dependencies - System dependencies (Utils, FileSystemManager, CommandExecutor)
     */
    constructor(windowManager, dependencies) {
        this.windowManager = windowManager;
        this.dependencies = dependencies;
        /** @type {Object.<string, {manager: string, files: string[]}>} Registry mapping file extensions to app configurations */
        this.appRegistry = {
            'txt': { manager: 'EditorManager', files: ['apps/editor/editor_manager.js', 'apps/editor/editor_ui.js'] },
            'md': { manager: 'EditorManager', files: ['apps/editor/editor_manager.js', 'apps/editor/editor_ui.js'] },
            'sh': { manager: 'EditorManager', files: ['apps/editor/editor_manager.js', 'apps/editor/editor_ui.js'] },
            'js': { manager: 'EditorManager', files: ['apps/editor/editor_manager.js', 'apps/editor/editor_ui.js'] },
            'json': { manager: 'EditorManager', files: ['apps/editor/editor_manager.js', 'apps/editor/editor_ui.js'] },
            'html': { manager: 'EditorManager', files: ['apps/editor/editor_manager.js', 'apps/editor/editor_ui.js'] },
            'css': { manager: 'EditorManager', files: ['apps/editor/editor_manager.js', 'apps/editor/editor_ui.js'] },
            'bas': { manager: 'BasicManager', files: ['apps/basic/basic_manager.js', 'apps/basic/basic_ui.js', 'apps/basic/basic_interp.js'] },
            'oopic': { manager: 'PaintManager', files: ['apps/paint/paint_manager.js', 'apps/paint/paint_ui.js'] },
        };
    }

    /**
     * Launches the appropriate application for a given file path
     * @param {string} filePath - Path to the file to open
     * @returns {Promise<void>}
     */
    async launch(filePath) {
        const { Utils, FileSystemManager, CommandExecutor } = this.dependencies;
        const extension = Utils.getFileExtension(filePath);
        const appInfo = this.appRegistry[extension];

        if (!appInfo) {
            console.warn(`No application registered for extension: ${extension}`);
            const pathInfo = FileSystemManager.validatePath(filePath, { allowMissing: false });
            if (pathInfo.success && pathInfo.data.node.type === 'directory') {
                await CommandExecutor.processSingleCommand(`explore "${filePath}"`, { isInteractive: true });
            } else {
                await CommandExecutor.processSingleCommand(`edit "${filePath}"`, { isInteractive: true });
            }
            return;
        }

        console.log(`Launching ${appInfo.manager} for file: ${filePath}`);
        
        for (const file of appInfo.files) {
            console.log(`Loading script: ${file}`);
            await CommandExecutor._loadScript(file);
        }

        const AppManagerClass = window[appInfo.manager];
        if (!AppManagerClass) {
            console.error(`App manager class ${appInfo.manager} not found.`);
            return;
        }
        
        const uiClassName = appInfo.manager.replace('Manager', 'UI');
        const UIClass = window[uiClassName];
        if (!UIClass) {
            console.error(`UI class ${uiClassName} not found.`);
            return;
        }

        const pathInfo = FileSystemManager.validatePath(filePath, { expectedType: 'file' });
        if (!pathInfo.success) {
            console.error(`Could not read file: ${filePath}`, pathInfo.error);
            return;
        }
        
        console.log(`File content length: ${pathInfo.data.node.content?.length || 0}`);
        console.log(`File content preview: "${pathInfo.data.node.content?.substring(0, 50)}..."`);

        const contentContainer = Utils.createElement('div', { className: 'app-content-container' });
        const fileName = filePath.split('/').pop();
        const windowId = this.windowManager.createWindow({
            title: `${fileName} - ${appInfo.manager.replace('Manager', '')}`,
            contentElement: contentContainer,
            width: 800,
            height: 600
        });

        const windowedAppLayerManager = {
            hide: (app) => {
                this.windowManager.closeWindow(windowId);
            }
        };

        const appInstance = new AppManagerClass();
        const launchOptions = {
            ...this.dependencies,
            [uiClassName]: UIClass,
            AppLayerManager: windowedAppLayerManager,
            filePath: filePath,
            fileContent: pathInfo.data.node.content,
            isWindowed: true
        };
        
        console.log(`Launching app with options:`, { filePath, contentLength: pathInfo.data.node.content?.length });
        
        this.windowManager.setWindowData(windowId, { appInstance });
        
        try {
            const appOptions = {
                dependencies: launchOptions,
                filePath: filePath,
                fileContent: pathInfo.data.node.content
            };
            appInstance.enter(contentContainer, appOptions);
            console.log(`App ${appInfo.manager} launched successfully`);
        } catch (error) {
            console.error(`Error launching app ${appInfo.manager}:`, error);
        }
    }
}
