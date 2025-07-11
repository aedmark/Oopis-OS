const ExplorerManager = (() => {
    "use strict";
    let isActive = false;
    let currentPath = '/';
    let explorerContainer = null;
    let expandedPaths = new Set(['/']);

    const callbacks = {
        onExit: exit,
        onTreeItemSelect: (path) => {
            if (path !== '/') {
                if (expandedPaths.has(path)) {
                    expandedPaths.delete(path);
                } else {
                    expandedPaths.add(path);
                }
            }
            _updateView(path);
        },
        onMainItemActivate: (path, type) => {
            if (type === 'directory') {
                expandedPaths.add(path);
                _updateView(path);
            }
        }
    };

    async function enter(startPath = null) {
        if (isActive) return;

        let initialPath = startPath || FileSystemManager.getCurrentPath();
        const pathValidation = FileSystemManager.validatePath("explore", initialPath, {allowMissing: false});

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
            exit();
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
            ExplorerUI.renderMainPane(items);
            ExplorerUI.updateStatusBar(currentPath, items.length);
        } else {
            ExplorerUI.renderMainPane([]);
            ExplorerUI.updateStatusBar(currentPath, 'Permission Denied');
        }
    }

    return {enter, exit, isActive: () => isActive};
})();