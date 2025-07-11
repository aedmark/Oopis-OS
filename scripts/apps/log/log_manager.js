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
        state = {isActive: false, allEntries: [], filteredEntries: [], selectedPath: null, isDirty: false};
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
            return {success: false, error: saveResult.error};
        }
        await FileSystemManager.save();
        return {success: true, message: `Log entry saved to ${fullPath}`, path: fullPath};
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
        const pathInfo = FileSystemManager.validatePath("log", LOG_DIR, {allowMissing: true});
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
        state.allEntries.sort((a, b) => b.timestamp - a.timestamp);
        state.filteredEntries = [...state.allEntries];
    }

    return {enter, exit, quickAdd};
})();