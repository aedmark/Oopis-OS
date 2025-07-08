/**
 * @file Manages the state and core logic for the OopisOS text editor.
 * This module is the "brain" of the editor; it knows nothing of the DOM.
 * @author Andrew Edmark
 * @author Gemini
 */
const EditorManager = (() => {
    "use strict";
    let state = {
        isActive: false,
        currentFilePath: null,
        originalContent: "",
        currentContent: "",
        undoStack: [],
        redoStack: [],
        isDirty: false,
        fileMode: 'text', // Default mode
        editorSettings: {
            wordWrap: false
        }
    };

    /**
     * Initializes an editor session.
     * @param {string} filePath - The absolute path of the file to edit.
     * @param {string} fileContent - The initial content of the file.
     * @param {function} onExitCallback - The function to call when the editor is closed.
     */
    function enter(filePath, fileContent, onExitCallback) {
        if (state.isActive) {
            console.warn("EditorManager.enter called while already active.");
            return;
        }

        // Load settings from storage
        const wordWrapSetting = StorageManager.loadItem(Config.STORAGE_KEYS.EDITOR_WORD_WRAP_ENABLED, "Editor Word Wrap", false);

        state = {
            isActive: true,
            currentFilePath: filePath,
            originalContent: fileContent,
            currentContent: fileContent,
            undoStack: [fileContent],
            redoStack: [],
            isDirty: false,
            fileMode: _getFileMode(filePath),
            editorSettings: {
                wordWrap: wordWrapSetting
            }
        };

        EditorUI.buildAndShow(state, callbacks);
        callbacks.onExit = onExitCallback; // Store the exit callback
    }

    /**
     * Exits the editor session, prompting to save if dirty.
     */
    async function exit() {
        if (!state.isActive) return;

        if (state.isDirty) {
            const confirmed = await new Promise(resolve => {
                ModalManager.request({
                    context: 'graphical',
                    messageLines: [Config.MESSAGES.EDITOR_DISCARD_CONFIRM],
                    confirmText: "Save & Exit",
                    cancelText: "Discard Changes",
                    onConfirm: async () => {
                        await saveContent();
                        resolve(true); // Proceed with exiting
                    },
                    onCancel: () => {
                        // Create a new modal for discarding
                        ModalManager.request({
                            context: 'graphical',
                            messageLines: ["Are you sure you want to discard all changes?"],
                            confirmText: "Discard",
                            cancelText: "Cancel",
                            onConfirm: () => resolve(true), // Proceed with exiting
                            onCancel: () => resolve(false) // Do not exit
                        });
                    }
                });
            });

            if (!confirmed) {
                return; // User cancelled the exit
            }
        }

        _performExit();
    }

    /**
     * Cleans up and hides the editor UI.
     */
    function _performExit() {
        EditorUI.hideAndReset();
        state.isActive = false;
        if (typeof callbacks.onExit === 'function') {
            callbacks.onExit();
        }
    }


    /**
     * Determines the file mode based on the file extension.
     * @param {string} filePath - The path to the file.
     * @returns {string} The mode ('markdown', 'html', or 'text').
     */
    function _getFileMode(filePath) {
        const extension = Utils.getFileExtension(filePath);
        if (extension === 'md') return 'markdown';
        if (extension === 'html') return 'html';
        return 'text';
    }

    /**
     * Saves the current content to the file system.
     */
    async function saveContent() {
        if (!state.isActive) return;

        const currentUser = UserManager.getCurrentUser().name;
        const primaryGroup = UserManager.getPrimaryGroupForUser(currentUser);

        if (!primaryGroup) {
            EditorUI.updateStatusBar({ ...state, statusMessage: "Error: Cannot determine user's primary group." });
            return;
        }

        const saveResult = await FileSystemManager.createOrUpdateFile(
            state.currentFilePath,
            state.currentContent, { currentUser, primaryGroup }
        );

        if (saveResult.success) {
            if (await FileSystemManager.save()) {
                state.originalContent = state.currentContent;
                state.isDirty = false;
                EditorUI.updateStatusBar({ ...state, statusMessage: `Saved to ${state.currentFilePath}` });
            } else {
                EditorUI.updateStatusBar({ ...state, statusMessage: "Error: Failed to save to filesystem." });
            }
        } else {
            EditorUI.updateStatusBar({ ...state, statusMessage: `Error: ${saveResult.error}` });
        }
    }

    // Callback handlers passed to the UI
    const callbacks = {
        onContentUpdate: (newContent) => {
            if (!state.isActive) return;
            state.currentContent = newContent;
            state.isDirty = state.currentContent !== state.originalContent;
            EditorUI.updateStatusBar(state);
            // Simple undo snapshotting
            // A more robust implementation would debounce this.
            if (state.undoStack.at(-1) !== newContent) {
                state.undoStack.push(newContent);
                state.redoStack = []; // Clear redo stack on new action
            }
        },
        onSaveRequest: async () => {
            await saveContent();
            _performExit();
        },
        onExitRequest: () => {
            exit();
        },
        onUndoRequest: () => {
            if (state.undoStack.length > 1) {
                state.redoStack.push(state.undoStack.pop());
                state.currentContent = state.undoStack.at(-1);
                state.isDirty = state.currentContent !== state.originalContent;
                EditorUI.setContent(state.currentContent);
                EditorUI.updateStatusBar(state);
            }
        },
        onRedoRequest: () => {
            if (state.redoStack.length > 0) {
                const nextState = state.redoStack.pop();
                state.undoStack.push(nextState);
                state.currentContent = nextState;
                state.isDirty = state.currentContent !== state.originalContent;
                EditorUI.setContent(state.currentContent);
                EditorUI.updateStatusBar(state);
            }
        },
    };

    return {
        enter,
        exit,
        isActive: () => state.isActive,
    };
})();