const EditorManager = (() => {
    "use strict";

    let state = {};

    const defaultState = {
        isActive: false,
        currentFilePath: null,
        originalContent: "",
        currentContent: "",
        isDirty: false,
        fileMode: 'text', // 'text', 'markdown', 'html'
        viewMode: 'split', // 'edit', 'split', 'preview'
        undoStack: [],
        redoStack: [],
        wordWrap: false
    };

    function enter(filePath, fileContent) {
        if (state.isActive) return;

        state = {...defaultState};
        state.isActive = true;
        state.currentFilePath = filePath;

        // Corrected: Normalize line endings to prevent rendering issues.
        const normalizedContent = (fileContent || "").replace(/\r\n|\r/g, "\n");
        state.originalContent = normalizedContent;
        state.currentContent = normalizedContent;

        state.fileMode = _getFileMode(filePath);

        // Initial state for undo
        state.undoStack.push(state.currentContent);

        // Load word wrap preference
        state.wordWrap = StorageManager.loadItem(Config.STORAGE_KEYS.EDITOR_WORD_WRAP_ENABLED, "Editor Word Wrap", false);

        EditorUI.buildAndShow(state, callbacks);
    }

    async function exit() {
        if (!state.isActive) return;

        if (state.isDirty) {
            const confirmed = await new Promise(resolve => {
                ModalManager.request({
                    context: 'graphical',
                    messageLines: ["You have unsaved changes that will be lost.", "Are you sure you want to exit?"],
                    confirmText: "Discard Changes",
                    cancelText: "Cancel",
                    onConfirm: () => resolve(true),
                    onCancel: () => resolve(false)
                });
            });
            if (!confirmed) return;
        }
        _performExit();
    }

    function _performExit() {
        EditorUI.hideAndReset();
        state = {}; // Reset state
    }

    const callbacks = {
        onContentChange: (newContent) => {
            if (!state.isActive) return;
            state.currentContent = newContent;
            state.isDirty = state.currentContent !== state.originalContent;
            EditorUI.updateDirtyStatus(state.isDirty);

            // Debounced push to undo stack
            _debouncedPushUndo(newContent);

            if (state.viewMode !== 'edit') {
                EditorUI.renderPreview(state.currentContent, state.fileMode);
            }
        },
        onSaveRequest: async () => {
            if (!state.isActive) return;

            let savePath = state.currentFilePath;
            if (!savePath) {
                const newName = await new Promise(resolve => {
                    ModalManager.request({
                        context: 'graphical-input',
                        messageLines: ["Save New File"],
                        placeholder: "/home/Guest/untitled.txt",
                        confirmText: "Save",
                        cancelText: "Cancel",
                        onConfirm: (value) => resolve(value),
                        onCancel: () => resolve(null)
                    });
                });

                if (!newName) {
                    EditorUI.updateStatusMessage("Save cancelled.");
                    return;
                }
                savePath = newName;
                state.currentFilePath = savePath;
                state.fileMode = _getFileMode(savePath);
                EditorUI.updateWindowTitle(savePath);
            }

            const currentUser = UserManager.getCurrentUser().name;
            const primaryGroup = UserManager.getPrimaryGroupForUser(currentUser);

            const saveResult = await FileSystemManager.createOrUpdateFile(savePath, state.currentContent, {
                currentUser,
                primaryGroup
            });

            if (saveResult.success && await FileSystemManager.save()) {
                state.originalContent = state.currentContent;
                state.isDirty = false;
                EditorUI.updateDirtyStatus(false);
                EditorUI.updateStatusMessage(`File saved to ${savePath}`);
            } else {
                EditorUI.updateStatusMessage(`Error: ${saveResult.error || "Failed to save file system changes."}`);
            }
        },
        onExitRequest: exit,
        onTogglePreview: () => {
            if (state.fileMode === 'text') {
                state.viewMode = 'edit';
            } else {
                const modes = ['split', 'edit', 'preview'];
                const currentIndex = modes.indexOf(state.viewMode);
                state.viewMode = modes[(currentIndex + 1) % modes.length];
            }
            EditorUI.setViewMode(state.viewMode, state.fileMode, state.currentContent);
        },
        onUndo: () => {
            if (state.undoStack.length > 1) {
                const currentState = state.undoStack.pop();
                state.redoStack.push(currentState);
                state.currentContent = state.undoStack[state.undoStack.length - 1];
                EditorUI.setContent(state.currentContent);
                if (state.viewMode !== 'edit') {
                    EditorUI.renderPreview(state.currentContent, state.fileMode);
                }
            }
        },
        onRedo: () => {
            if (state.redoStack.length > 0) {
                const nextState = state.redoStack.pop();
                state.undoStack.push(nextState);
                state.currentContent = nextState;
                EditorUI.setContent(state.currentContent);
                if (state.viewMode !== 'edit') {
                    EditorUI.renderPreview(state.currentContent, state.fileMode);
                }
            }
        },
        onWordWrapToggle: () => {
            state.wordWrap = !state.wordWrap;
            StorageManager.saveItem(Config.STORAGE_KEYS.EDITOR_WORD_WRAP_ENABLED, state.wordWrap);
            EditorUI.setWordWrap(state.wordWrap);
        }
    };

    const _debouncedPushUndo = Utils.debounce((content) => {
        state.undoStack.push(content);
        if (state.undoStack.length > 50) { // Limit undo history
            state.undoStack.shift();
        }
        state.redoStack = []; // Clear redo on new action
    }, 500);

    function _getFileMode(filePath) {
        if (!filePath) return 'text';
        const extension = Utils.getFileExtension(filePath);
        if (extension === 'md') return 'markdown';
        if (extension === 'html') return 'html';
        return 'text';
    }

    return {enter, exit, isActive: () => state.isActive};
})();