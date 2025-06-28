/**
 * @file Manages the OopisOS Graphical File Explorer application.
 * This refactored version uses the AppLayerManager for a fully modal experience.
 * @author Architect
 */

/**
 * @module ExplorerUI
 * @description Manages all DOM building and manipulation for the file explorer.
 */
const ExplorerUI = (() => {
    "use strict";
    let elements = {};
    let callbacks = {};

    /**
     * Creates the main layout of the explorer application.
     * @param {object} cb - An object containing callback functions for UI events.
     * @returns {HTMLElement} The root element of the explorer UI.
     */
    function buildLayout(cb) {
        callbacks = cb;
        elements.treePane = Utils.createElement('div', { id: 'explorer-tree-pane', className: 'p-2 border-r border-zinc-700 overflow-y-auto w-1/3' });
        elements.mainPane = Utils.createElement('div', { id: 'explorer-main-pane', className: 'p-2 overflow-y-auto w-2/3' });
        elements.statusBar = Utils.createElement('div', { id: 'explorer-status-bar', className: 'text-sm p-1 border-t border-zinc-700 text-zinc-400' });
        elements.exitBtn = Utils.createElement('button', { id: 'explorer-exit-btn', className: 'text-lg hover:text-red-500', textContent: '×', title: 'Close Explorer (Esc)', eventListeners: { click: () => callbacks.onExit() }});

        const header = Utils.createElement('header', { id: 'explorer-header', className: 'flex justify-between items-center p-2 border-b border-zinc-700' },
            Utils.createElement('h2', { className: 'text-lg text-sky-400 font-["VT323"]', textContent: 'OopisOS File Explorer' }),
            elements.exitBtn
        );

        const mainContainer = Utils.createElement('div', { id: 'explorer-main-container', className: 'flex flex-grow min-h-0' }, elements.treePane, elements.mainPane);

        elements.container = Utils.createElement('div', {
            id: 'explorer-container',
            className: 'flex flex-col bg-neutral-800 border-2 border-neutral-700 rounded-lg text-neutral-300 font-["VT323"] overflow-hidden',
            style: {
                width: '95%',
                height: '95%',
                maxWidth: '1200px'
            }
        }, header, mainContainer, elements.statusBar);
        return elements.container;
    }

    /**
     * Renders the directory tree in the left pane.
     * @param {object} treeData - The root node of the file system.
     * @param {string} selectedPath - The currently selected path to highlight.
     * @param {object} expandedPaths - A Set of paths that should be rendered in an expanded state.
     */
    function renderTree(treeData, selectedPath, expandedPaths) {
        if (!elements.treePane) return;
        const treeRoot = Utils.createElement('ul', { className: 'explorer-tree text-sm' });

        function createTreeItem(node, path, name) {
            const hasChildren = node.children && Object.keys(node.children).filter(childName => node.children[childName].type === 'directory').length > 0;
            const canRead = FileSystemManager.hasPermission(node, UserManager.getCurrentUser().name, 'read');

            const summary = Utils.createElement('summary', { className: 'cursor-pointer select-none hover:bg-zinc-700 rounded' });
            const folderIcon = Utils.createElement('span', { className: 'mr-1', textContent: '📁' });
            const nameSpan = Utils.createElement('span', { textContent: name });
            summary.append(folderIcon, nameSpan);

            if (!canRead) {
                summary.classList.add('opacity-50', 'italic');
            }

            const details = Utils.createElement('details', { className: 'explorer-tree-item pl-4', 'data-path': path }, summary);
            if (expandedPaths.has(path)) {
                details.open = true;
            }

            if (canRead && hasChildren) {
                const childList = Utils.createElement('ul');
                const sortedChildNames = Object.keys(node.children).sort();

                for (const childName of sortedChildNames) {
                    const childNode = node.children[childName];
                    if (childNode.type === 'directory') {
                        childList.appendChild(createTreeItem(childNode, `${path === '/' ? '' : path}/${childName}`, childName));
                    }
                }
                details.appendChild(childList);
            }

            summary.addEventListener('click', (e) => {
                e.preventDefault();
                if (canRead) {
                    callbacks.onTreeItemSelect(path);
                }
            });

            if (path === selectedPath) {
                summary.classList.add('bg-sky-800', 'font-semibold');
            }

            return details;
        }

        treeRoot.appendChild(createTreeItem(treeData, '/', '/'));
        elements.treePane.innerHTML = '';
        elements.treePane.appendChild(treeRoot);
    }

    /**
     * Renders the contents of a directory in the main right pane.
     * @param {Array<object>} items - An array of item objects to display.
     */
    function renderMainPane(items) {
        if (!elements.mainPane) return;
        elements.mainPane.innerHTML = '';

        if (items.length === 0) {
            elements.mainPane.appendChild(Utils.createElement('div', { className: 'p-4 text-zinc-500', textContent: '(Directory is empty)' }));
            return;
        }

        const list = Utils.createElement('ul', { className: 'explorer-file-list space-y-1' });
        items.forEach(item => {
            const icon = Utils.createElement('span', { className: 'mr-2 w-4 inline-block', textContent: item.type === 'directory' ? '📁' : '📄' });
            const name = Utils.createElement('span', { className: 'explorer-item-name flex-1', textContent: item.name });
            const perms = Utils.createElement('span', { className: 'explorer-item-perms text-xs text-zinc-400 mr-4', textContent: FileSystemManager.formatModeToString(item.node) });
            const size = Utils.createElement('span', { className: 'explorer-item-size text-xs text-zinc-400 w-16 text-right', textContent: Utils.formatBytes(item.size) });

            const li = Utils.createElement('li', {
                    className: `flex items-center p-1 rounded cursor-pointer hover:bg-zinc-700 explorer-type-${item.type}`,
                    'data-path': item.path,
                    title: item.path
                },
                icon, name, perms, size
            );

            li.addEventListener('dblclick', () => callbacks.onMainItemActivate(item.path, item.type));
            list.appendChild(li);
        });
        elements.mainPane.appendChild(list);
    }

    /**
     * Updates the status bar with information about the selected path.
     * @param {string} path - The current path.
     * @param {number|string} itemCount - The number of items in the current directory or a status string.
     */
    function updateStatusBar(path, itemCount) {
        if (!elements.statusBar) return;
        elements.statusBar.textContent = `Path: ${path}  |  Items: ${itemCount}`;
    }

    /**
     * Clears all elements and callbacks.
     */
    function reset() {
        elements = {};
        callbacks = {};
    }

    return { buildLayout, renderTree, renderMainPane, updateStatusBar, reset };
})();


/**
 * @module ExplorerManager
 * @description The main controller for the file explorer application.
 */
const ExplorerManager = (() => {
    "use strict";
    let isActive = false;
    let currentPath = '/';
    let explorerContainer = null;
    let expandedPaths = new Set(['/']);

    const callbacks = {
        onExit: exit,
        onTreeItemSelect: (path) => {
            if (path !== '/') { // Root cannot be collapsed
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

    /**
     * Launches the file explorer application.
     * @param {string|null} startPath - The optional path to start the explorer in.
     */
    function enter(startPath = null) {
        if (isActive) return;

        let initialPath = startPath || FileSystemManager.getCurrentPath();
        const pathValidation = FileSystemManager.validatePath("explore", initialPath, { allowMissing: false });

        if (pathValidation.error) {
            OutputManager.appendToOutput(`explore: ${pathValidation.error}`, { typeClass: Config.CSS_CLASSES.ERROR_MSG });
            return;
        }

        if (pathValidation.node.type !== 'directory') {
            initialPath = initialPath.substring(0, initialPath.lastIndexOf('/')) || '/';
        }

        isActive = true;

        // Add the initial path and all its parents to the expanded set for a nice default view
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

    /**
     * Closes the explorer and cleans up resources.
     */
    function exit() {
        if (!isActive) return;

        document.removeEventListener('keydown', handleKeyDown);
        AppLayerManager.hide();
        ExplorerUI.reset();

        // Reset state
        isActive = false;
        currentPath = '/';
        explorerContainer = null;
        expandedPaths = new Set(['/']);
    }

    /**
     * Handles keydown events for the explorer, like the Escape key.
     * @param {KeyboardEvent} event - The keyboard event.
     */
    function handleKeyDown(event) {
        if (isActive && event.key === 'Escape') {
            exit();
        }
    }

    /**
     * Updates the entire explorer view for a given path.
     * @private
     * @param {string} path - The path to display.
     */
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
                // Sort directories before files
                if (nodeA.type === 'directory' && nodeB.type !== 'directory') return -1;
                if (nodeA.type !== 'directory' && nodeB.type === 'directory') return 1;
                // Then sort alphabetically
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

    return { enter, exit, isActive: () => isActive };
})();