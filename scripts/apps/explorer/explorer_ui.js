const ExplorerUI = (() => {
    "use strict";
    let elements = {};
    let callbacks = {};
    let activeContextMenu = null;

    function buildLayout(cb) {
        callbacks = cb;
        elements.treePane = Utils.createElement('div', { id: 'explorer-tree-pane', className: 'explorer__tree-pane' });
        elements.mainPane = Utils.createElement('div', { id: 'explorer-main-pane', className: 'explorer__main-pane' });
        elements.statusBar = Utils.createElement('div', { id: 'explorer-status-bar', className: 'explorer__status-bar' });

        elements.exitBtn = Utils.createElement('button', {
            id: 'explorer-exit-btn',
            className: 'explorer__exit-btn',
            textContent: '×',
            title: 'Close Explorer (Esc)',
            eventListeners: { click: () => callbacks.onExit() }
        });

        const header = Utils.createElement('header', { id: 'explorer-header', className: 'explorer__header' },
            Utils.createElement('h2', { className: 'explorer__title', textContent: 'OopisOS File Explorer' }),
            elements.exitBtn
        );

        const mainContainer = Utils.createElement('div', { id: 'explorer-main-container', className: 'explorer__main' }, elements.treePane, elements.mainPane);

        elements.container = Utils.createElement('div', {
            id: 'explorer-container',
            className: 'explorer-container'
        }, header, mainContainer, elements.statusBar);

        // This single listener will handle all context menu logic for the main pane.
        elements.mainPane.addEventListener('contextmenu', (e) => {
            e.preventDefault(); // Prevent the default browser menu.
            
            const listItem = e.target.closest('li[data-path]');

            if (listItem) {
                // User right-clicked on a file or directory item
                const path = listItem.getAttribute('data-path');
                const name = listItem.querySelector('.explorer-item-name').textContent;
                const menuItems = [
                    { label: 'Rename...', callback: () => callbacks.onRename(path, name) },
                    { label: 'Delete', callback: () => callbacks.onDelete(path, name) },
                    { label: 'Move', callback: () => callbacks.onMove(path, null) }
                ];
                _createContextMenu(menuItems, e.clientX, e.clientY);
            } else {
                // User right-clicked on the background of the main pane
                const currentPath = elements.statusBar.textContent.split('  |')[0].replace('Path: ', '');
                const menuItems = [
                    { label: 'New File...', callback: () => callbacks.onCreateFile(currentPath) },
                    { label: 'New Directory...', callback: () => callbacks.onCreateDirectory(currentPath) }
                ];
                _createContextMenu(menuItems, e.clientX, e.clientY);
            }
        });

        // Close context menu when clicking elsewhere
        document.addEventListener('click', (e) => {
            if (activeContextMenu && !activeContextMenu.contains(e.target)) {
                _removeContextMenu();
            }
        }, true);

        return elements.container;
    }
    
    function _removeContextMenu() {
        if (activeContextMenu) {
            activeContextMenu.remove();
            activeContextMenu = null;
        }
    }
    
    function _createContextMenu(items, x, y) {
        _removeContextMenu(); // Remove any existing menu before creating a new one.

        const menu = Utils.createElement('div', { className: 'context-menu' });
        menu.style.left = `${x}px`;
        menu.style.top = `${y}px`;
        
        // Clicks inside the menu should not close it.
        menu.addEventListener('click', e => e.stopPropagation());

        items.forEach(item => {
            if (item.separator) {
                menu.appendChild(Utils.createElement('div', { className: 'context-menu-separator' }));
                return;
            }
            const menuItem = Utils.createElement('div', { className: 'context-menu-item', textContent: item.label });
            menuItem.addEventListener('click', () => {
                item.callback();
                _removeContextMenu();
            });
            menu.appendChild(menuItem);
        });

        document.body.appendChild(menu);
        activeContextMenu = menu;
    }

    function renderTree(treeData, selectedPath, expandedPaths) {
        if (!elements.treePane) return;
        const treeRoot = Utils.createElement('ul', { className: 'explorer-tree' });

        function createTreeItem(node, path, name) {
            const hasChildren = node.children && Object.keys(node.children).filter(childName => node.children[childName].type === 'directory').length > 0;
            const canRead = FileSystemManager.hasPermission(node, UserManager.getCurrentUser().name, 'read');

            const summary = Utils.createElement('summary');
            const folderIcon = Utils.createElement('span', { className: 'mr-1', textContent: '📁' });
            const nameSpan = Utils.createElement('span', { textContent: name });
            summary.append(folderIcon, nameSpan);

            if (!canRead) {
                summary.classList.add('opacity-50', 'italic');
            }

            const details = Utils.createElement('details', { className: 'explorer-tree-item', 'data-path': path }, summary);
            if (expandedPaths.has(path)) {
                details.open = true;
            }

            if (canRead && hasChildren) {
                const childList = Utils.createElement('ul', { className: 'pl-4' });
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
                summary.classList.add('selected');
            }

            return details;
        }

        treeRoot.appendChild(createTreeItem(treeData, '/', '/'));
        elements.treePane.innerHTML = '';
        elements.treePane.appendChild(treeRoot);
    }

    function renderMainPane(items, currentPath) {
    if (!elements.mainPane) return;
    elements.mainPane.innerHTML = '';

    // Add a context menu for the pane itself (for creating new files/dirs)
    elements.mainPane.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const menuItems = [
            { label: 'New File...', callback: () => callbacks.onCreateFile(currentPath) },
            { label: 'New Directory...', callback: () => callbacks.onCreateDirectory(currentPath) }
        ];
        _createContextMenu(menuItems, e.clientX, e.clientY);
    });

    if (items.length === 0) {
        elements.mainPane.appendChild(Utils.createElement('div', {
            className: 'p-4 text-zinc-500',
            textContent: '(Directory is empty)'
        }));
        return;
    }

    const list = Utils.createElement('ul', { className: 'explorer-file-list' });
    items.forEach(item => {
        const icon = Utils.createElement('span', {
            className: 'mr-2 w-4 inline-block',
            textContent: item.type === 'directory' ? '📁' : '📄'
        });
        const name = Utils.createElement('span', { className: 'explorer-item-name', textContent: item.name });
        const perms = Utils.createElement('span', { className: 'explorer-item-perms', textContent: FileSystemManager.formatModeToString(item.node) });
        const size = Utils.createElement('span', {
            className: 'explorer-item-size',
            textContent: item.type === 'file' ? Utils.formatBytes(item.size) : ''
        });

        const li = Utils.createElement('li', {
            'data-path': item.path,
            title: item.path
        }, icon, name, perms, size);

        // --- FIXED ---
        // Added dblclick event listener for file/directory activation
        li.addEventListener('dblclick', () => callbacks.onMainItemActivate(item.path, item.type));

        // --- FIXED ---
        // Added contextmenu event listener for individual item actions
        li.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            e.stopPropagation();
            const menuItems = [
                { label: 'Rename...', callback: () => callbacks.onRename(item.path, item.name) },
                { label: 'Delete', callback: () => callbacks.onDelete(item.path, item.name) },
                { label: 'Move', callback: () => callbacks.onMove(item.path, null) }
            ];
            _createContextMenu(menuItems, e.clientX, e.clientY);
        });

        list.appendChild(li);
    });
    elements.mainPane.appendChild(list);
}


    function updateStatusBar(path, itemCount) {
        if (!elements.statusBar) return;
        elements.statusBar.textContent = `Path: ${path}  |  Items: ${itemCount}`;
    }

    function setMoveCursor(isMoving) {
        if (elements.container) {
            elements.container.style.cursor = isMoving ? 'move' : 'default';
        }
    }

    function highlightItem(path, isHighlighted) {
        // Clear previous highlights
        const allItems = elements.mainPane.querySelectorAll('li');
        allItems.forEach(li => {
            li.style.backgroundColor = '';
            li.style.color = '';
        });

        // Apply new highlight
        if (isHighlighted) {
            const itemElement = elements.mainPane.querySelector(`[data-path="${path}"]`);
            if (itemElement) {
                itemElement.style.backgroundColor = 'var(--color-info)';
                itemElement.style.color = 'var(--color-background-darkest)';
            }
        }
    }

    function reset() {
        _removeContextMenu();
        elements = {};
        callbacks = {};
    }

    return { buildLayout, renderTree, renderMainPane, updateStatusBar, setMoveCursor, highlightItem, reset };
})();