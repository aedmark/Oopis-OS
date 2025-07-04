/**
 * @file Manages the OopisOS Personal Journal application (log).
 * This file contains the UI and Manager modules for the log app.
 * @author The Architect & Gemini
 */

const LOG_DIR = "/home/Guest/.journal";

/**
 * @module LogUI
 * @description Manages all DOM building and manipulation for the log app.
 */
const LogUI = (() => {
    "use strict";
    let elements = {};
    let callbacks = {};

    function buildLayout(cb) {
        callbacks = cb;
        elements.entryList = Utils.createElement('div', { id: 'log-entry-list', className: 'log-app__list-pane' });

        // Change content view to a textarea for editing
        elements.contentView = Utils.createElement('textarea', {
            id: 'log-content-view',
            className: 'log-app__content-pane log-app__content-pane--editable',
            placeholder: 'Select an entry to view or edit...'
        });

        elements.searchBar = Utils.createElement('input', { id: 'log-search-bar', type: 'text', placeholder: 'Search entries...', className: 'log-app__search' });
        elements.newBtn = Utils.createElement('button', { id: 'log-new-btn', textContent: 'New Entry', className: 'log-app__btn' });

        // Add a Save button, initially hidden
        elements.saveBtn = Utils.createElement('button', { id: 'log-save-btn', textContent: 'Save Changes', className: 'log-app__btn hidden' });

        elements.exitBtn = Utils.createElement('button', { id: 'log-exit-btn', textContent: 'Exit', className: 'log-app__btn log-app__btn--exit' });

        elements.searchBar.addEventListener('input', () => callbacks.onSearch(elements.searchBar.value));
        elements.newBtn.addEventListener('click', () => callbacks.onNew());
        elements.saveBtn.addEventListener('click', () => callbacks.onSave());
        elements.exitBtn.addEventListener('click', () => callbacks.onExit());
        elements.contentView.addEventListener('input', () => callbacks.onContentChange());

        const header = Utils.createElement('header', { className: 'log-app__header' },
            Utils.createElement('h2', { textContent: 'Captain\'s Log' }),
            elements.searchBar,
            Utils.createElement('div', { className: 'log-app__actions'}, elements.newBtn, elements.saveBtn, elements.exitBtn)
        );

        const main = Utils.createElement('main', { className: 'log-app__main' }, elements.entryList, elements.contentView);
        elements.container = Utils.createElement('div', { id: 'log-app-container', className: 'log-app__container' }, header, main);

        return elements.container;
    }

    function renderEntries(entries, selectedPath) {
        elements.entryList.innerHTML = '';
        if (entries.length === 0) {
            elements.entryList.textContent = 'No entries found.';
            return;
        }
        entries.forEach((entry) => {
            const date = new Date(entry.timestamp);
            const title = entry.content.split('\n')[0].replace(/^#+\s*/, '').substring(0, 40) || '(Untitled)';
            const item = Utils.createElement('div', {
                className: 'log-app__list-item',
                'data-path': entry.path
            }, [
                Utils.createElement('strong', { textContent: date.toLocaleString() }),
                Utils.createElement('span', { textContent: title })
            ]);
            if (entry.path === selectedPath) {
                item.classList.add('selected');
            }
            item.addEventListener('click', () => callbacks.onSelect(entry.path));
            elements.entryList.appendChild(item);
        });
    }

    function renderContent(entry) {
        if (!entry) {
            elements.contentView.value = '';
            elements.contentView.placeholder = 'Select an entry to view or edit...';
            elements.saveBtn.classList.add('hidden');
            return;
        }
        elements.contentView.value = entry.content;
    }

    function updateSaveButton(isDirty) {
        elements.saveBtn.classList.toggle('hidden', !isDirty);
    }

    function getContent() {
        return elements.contentView.value;
    }

    function reset() {
        elements = {};
        callbacks = {};
    }

    return { buildLayout, renderEntries, renderContent, reset, getContent, updateSaveButton };
})();

/**
 * @module LogManager
 * @description The main controller for the log application.
 */
const LogManager = (() => {
    "use strict";
    let state = {
        isActive: false,
        allEntries: [],
        filteredEntries: [],
        selectedPath: null,
        isDirty: false,
    };

    const callbacks = {
        onExit: exit,
        onSearch: (query) => {
            state.filteredEntries = state.allEntries.filter(e => e.content.toLowerCase().includes(query.toLowerCase()));
            LogUI.renderEntries(state.filteredEntries, state.selectedPath);
        },
        onSelect: async (path) => {
            if (state.isDirty) {
                const confirmed = await new Promise(r => ModalManager.request({
                    context: 'graphical',
                    messageLines: ["You have unsaved changes. Discard them?"],
                    onConfirm: () => r(true), onCancel: () => r(false)
                }));
                if (!confirmed) return;
            }
            state.selectedPath = path;
            const selectedEntry = state.allEntries.find(e => e.path === path);
            LogUI.renderContent(selectedEntry);
            LogUI.renderEntries(state.filteredEntries, state.selectedPath);
            state.isDirty = false;
            LogUI.updateSaveButton(false);
        },
        onNew: async () => {
            const title = await new Promise(resolve => ModalManager.request({
                context: 'graphical-input',
                messageLines: ["Enter New Log Title:"],
                placeholder: "A new beginning...",
                onConfirm: (value) => resolve(value), onCancel: () => resolve(null)
            }));
            if (title) {
                const newContent = `# ${title}`;
                const result = await quickAdd(newContent, UserManager.getCurrentUser().name);
                if (result.success) {
                    await _loadEntries();
                    await callbacks.onSelect(result.path);
                }
            }
        },
        onSave: async () => {
            if (!state.selectedPath || !state.isDirty) return;
            const newContent = LogUI.getContent();
            const result = await _saveEntry(state.selectedPath, newContent);
            if (result.success) {
                const entryIndex = state.allEntries.findIndex(e => e.path === state.selectedPath);
                if (entryIndex > -1) {
                    state.allEntries[entryIndex].content = newContent;
                }
                state.isDirty = false;
                LogUI.updateSaveButton(false);
            } else {
                alert(`Error saving: ${result.error}`);
            }
        },
        onContentChange: () => {
            const selectedEntry = state.allEntries.find(e => e.path === state.selectedPath);
            if (!selectedEntry) return;
            const currentContent = LogUI.getContent();
            state.isDirty = currentContent !== selectedEntry.content;
            LogUI.updateSaveButton(state.isDirty);
        }
    };

    async function enter() {
        if (state.isActive) return;
        state.isActive = true;
        document.addEventListener('keydown', handleKeyDown);
        await _ensureLogDir();
        await _loadEntries();
        const layout = LogUI.buildLayout(callbacks);
        AppLayerManager.show(layout);
        LogUI.renderEntries(state.filteredEntries, null);
        LogUI.renderContent(null);
    }

    async function exit() {
        if (!state.isActive) return;
        if (state.isDirty) {
            const confirmed = await new Promise(r => ModalManager.request({
                context: 'graphical',
                messageLines: ["You have unsaved changes. Exit and discard them?"],
                onConfirm: () => r(true), onCancel: () => r(false)
            }));
            if (!confirmed) return;
        }
        document.removeEventListener('keydown', handleKeyDown);
        AppLayerManager.hide();
        LogUI.reset();
        state = { isActive: false, allEntries: [], filteredEntries: [], selectedPath: null, isDirty: false };
    }

    function handleKeyDown(e) {
        if (!state.isActive) return;
        if ((e.ctrlKey || e.metaKey) && e.key === 's') {
            e.preventDefault();
            callbacks.onSave();
        }
    }

    async function quickAdd(entryText, currentUser) {
        await _ensureLogDir(currentUser);
        const timestamp = new Date().toISOString();
        const filename = `${timestamp.replace(/[:.]/g, '-')}.md`;
        const fullPath = `${LOG_DIR}/${filename}`;

        const saveResult = await FileSystemManager.createOrUpdateFile(fullPath, entryText, {
            currentUser: currentUser,
            primaryGroup: UserManager.getPrimaryGroupForUser(currentUser)
        });

        if (!saveResult.success) {
            return { success: false, error: saveResult.error };
        }
        await FileSystemManager.save();
        return { success: true, message: `Log entry saved to ${fullPath}`, path: fullPath };
    }

    async function _saveEntry(path, content) {
        const result = await FileSystemManager.createOrUpdateFile(path, content, {
            currentUser: UserManager.getCurrentUser().name,
            primaryGroup: UserManager.getPrimaryGroupForUser(UserManager.getCurrentUser().name)
        });
        if (result.success) await FileSystemManager.save();
        return result;
    }

    async function _ensureLogDir(currentUser) {
        const pathInfo = FileSystemManager.validatePath("log", LOG_DIR, { allowMissing: true });
        if (!pathInfo.node) {
            await CommandExecutor.processSingleCommand(`mkdir -p ${LOG_DIR}`);
        }
    }

    async function _loadEntries() {
        const dirNode = FileSystemManager.getNodeByPath(LOG_DIR);
        state.allEntries = [];
        if (dirNode && dirNode.children) {
            for (const filename in dirNode.children) {
                if (filename.endsWith('.md')) {
                    const fileNode = dirNode.children[filename];
                    // FIX: Robust date parsing from filename
                    const rawTimestamp = filename.replace('.md', '');
                    const isoString = rawTimestamp.substring(0, 10) + 'T' +
                        rawTimestamp.substring(11, 13) + ':' +
                        rawTimestamp.substring(14, 16) + ':' +
                        rawTimestamp.substring(17, 19) + '.' +
                        rawTimestamp.substring(20, 23) + 'Z';
                    state.allEntries.push({
                        timestamp: new Date(isoString),
                        content: fileNode.content || '',
                        path: `${LOG_DIR}/${filename}`
                    });
                }
            }
        }
        state.allEntries.sort((a, b) => b.timestamp - a.timestamp); // Sort descending
        state.filteredEntries = [...state.allEntries];
    }

    return { enter, exit, quickAdd };
})();