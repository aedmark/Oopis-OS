const ExplorerManager = (() => {
    "use strict";
    let isActive = false;
    let currentPath = '/';
    let explorerContainer = null;
    let expandedPaths = new Set(['/']);
    // --- STATE FOR MOVE OPERATION ---
    let moveOperation = {
        active: false,
        sourcePath: null
    };

    const callbacks = {
        onExit: exit,
        onTreeItemSelect: (path) => {
            // If a move is active, this click is the destination
            if (moveOperation.active) {
                callbacks.onMove(moveOperation.sourcePath, path);
                return;
            }

            if (path !== '/') {
                if (expandedPaths.has(path)) {
                    expandedPaths.delete(path);
                } else {
                    expandedPaths.add(path);
                }
            }
            _updateView(path);
        },
        // Make the callback function asynchronous
	onMainItemActivate: async (path, type) => {
		if (type === 'directory') {
			expandedPaths.add(path);
			_updateView(path);
		} else {
			// First, initiate the exit of the explorer.
		exit();

       // Then, wait briefly for the UI to update.
       // This pause is critical to prevent the race condition.
	await new Promise(resolve => setTimeout(resolve, 50)); // 50ms delay

       // Now that the explorer is closed, safely open the editor.
    await CommandExecutor.processSingleCommand(`edit "${path}"`, { isInteractive: true });
    }
},

        // --- NEW CALLBACKS ---
        onCreateFile: (path) => {
            ModalManager.request({
                context: 'graphical-input',
                messageLines: ["Enter New File Name:"],
                placeholder: "new_file.txt",
                onConfirm: async (name) => {
                    if (name) {
                        const newFilePath = `${path}/${name}`;
                        const result = await FileSystemManager.createOrUpdateFile(newFilePath, "", {
                            currentUser: UserManager.getCurrentUser().name,
                            primaryGroup: UserManager.getPrimaryGroupForUser(UserManager.getCurrentUser().name)
                        });
                        if (result.success) {
                            await FileSystemManager.save();
                            _updateView(currentPath);
                        } else {
                            alert(`Error: ${result.error}`);
                        }
                    }
                },
                onCancel: () => {}
            });
        },
        onCreateDirectory: (path) => {
            ModalManager.request({
                context: 'graphical-input',
                messageLines: ["Enter New Directory Name:"],
                placeholder: "new_directory",
                onConfirm: async (name) => {
                    if (name) {
                        await CommandExecutor.processSingleCommand(`mkdir "${path}/${name}"`, {isInteractive: false});
                        _updateView(currentPath);
                    }
                },
                onCancel: () => {}
            });
        },
        onRename: (path, oldName) => {
             ModalManager.request({
                context: 'graphical-input',
                messageLines: [`Rename "${oldName}":`],
                placeholder: oldName,
                onConfirm: async (newName) => {
                    if (newName && newName !== oldName) {
                        const newPath = `${currentPath}/${newName}`;
                        await CommandExecutor.processSingleCommand(`mv "${path}" "${newPath}"`, {isInteractive: false});
                        _updateView(currentPath);
                    }
                },
                onCancel: () => {}
            });
        },
        onDelete: (path, name) => {
            ModalManager.request({
                context: 'graphical',
                messageLines: [`Are you sure you want to delete "${name}"?`, "This action cannot be undone."],
                onConfirm: async () => {
                    await CommandExecutor.processSingleCommand(`rm -r "${path}"`, { isInteractive: false });
                    _updateView(currentPath);
                },
                onCancel: () => {}
            });
        },
        onMove: (sourcePath, destPath) => {
            // If move isn't active, start it
            if (!moveOperation.active) {
                moveOperation.active = true;
                moveOperation.sourcePath = sourcePath;
                // Provide visual feedback - this part is handled in the UI
                ExplorerUI.setMoveCursor(true);
                ExplorerUI.highlightItem(sourcePath, true);
                return;
            }
            
            // Move is active, so destPath is the destination directory
            CommandExecutor.processSingleCommand(`mv "${sourcePath}" "${destPath}/"`, { isInteractive: false }).then(() => {
                 _resetMoveOperation();
                _updateView(currentPath);
            });
        },
        onCancelMove: () => {
            _resetMoveOperation();
            _updateView(currentPath); // Redraw to remove highlighting
        }
    };

    function _resetMoveOperation() {
        moveOperation.active = false;
        moveOperation.sourcePath = null;
        ExplorerUI.setMoveCursor(false);
    }


    async function enter(startPath = null) {
        if (isActive) return;

        let initialPath = startPath || FileSystemManager.getCurrentPath();
        const pathValidation = FileSystemManager.validatePath(initialPath, {allowMissing: false});

        if (pathValidation.error) {
            OutputManager.appendToOutput(`explore: ${pathValidation.error}`, {typeClass: 'text-error'});
            return;
        }

        if (pathValidation.node.type !== 'directory') {
            initialPath = initialPath.substring(0, initialPath.lastIndexOf('/')) || '/';
        }

        isActive = true;

        expandedPaths = new Set(['/']);
        let parent = initialPath;
        while (parent && parent !== '/') {
            expandedPaths.add(parent);
            parent = parent.substring(0, parent.lastIndexOf('/')) || (parent.includes('/') ? '/' : null);
        }

        explorerContainer = ExplorerUI.buildLayout(callbacks);
        AppLayerManager.show(explorerContainer);
        document.addEventListener('keydown', handleKeyDown);

        _updateView(initialPath);
    }

    function exit() {
        if (!isActive) return;
        
        // Ensure any pending move operation is cancelled
        if (moveOperation.active) {
            _resetMoveOperation();
        }

        document.removeEventListener('keydown', handleKeyDown);
        AppLayerManager.hide();
        ExplorerUI.reset();

        isActive = false;
        currentPath = '/';
        explorerContainer = null;
        expandedPaths = new Set(['/']);
    }

    function handleKeyDown(event) {
        if (isActive && event.key === 'Escape') {
            if (moveOperation.active) {
                callbacks.onCancelMove();
            } else {
                exit();
            }
        }
    }

    function _updateView(path) {
        currentPath = path;
        const currentUser = UserManager.getCurrentUser().name;
        const rootNode = FileSystemManager.getNodeByPath('/');
        if (!rootNode) {
            console.error("CRITICAL: Root node not found in ExplorerManager.");
            exit();
            return;
        }

        ExplorerUI.renderTree(rootNode, currentPath, expandedPaths);

        const mainNode = FileSystemManager.getNodeByPath(currentPath);
        if (mainNode && FileSystemManager.hasPermission(mainNode, currentUser, 'read')) {
            const items = Object.keys(mainNode.children || {}).sort((a, b) => {
                const nodeA = mainNode.children[a];
                const nodeB = mainNode.children[b];
                if (nodeA.type === 'directory' && nodeB.type !== 'directory') return -1;
                if (nodeA.type !== 'directory' && nodeB.type === 'directory') return 1;
                return a.localeCompare(b);
            }).map(name => {
                const childNode = mainNode.children[name];
                return {
                    name,
                    path: `${currentPath === '/' ? '' : currentPath}/${name}`,
                    type: childNode.type,
                    node: childNode,
                    size: FileSystemManager.calculateNodeSize(childNode)
                };
            });
            ExplorerUI.renderMainPane(items, currentPath);
            ExplorerUI.updateStatusBar(currentPath, items.length);
        } else {
            ExplorerUI.renderMainPane([], currentPath);
            ExplorerUI.updateStatusBar(currentPath, 'Permission Denied');
        }
    }

    return {enter, exit, isActive: () => isActive};
})();