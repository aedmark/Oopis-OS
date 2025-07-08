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
        fileMode: 'text',
        viewMode: 'editor',
        editorSettings: {
            wordWrap: false
        },
        findState: {
            query: "",
            matches: [],
            currentIndex: -1,
            isCaseSensitive: false,
            isRegex: false,
            error: null
        }
    };

    function enter(filePath, fileContent, onExitCallback) {
        if (state.isActive) {
            console.warn("EditorManager.enter called while already active.");
            return;
        }

        const wordWrapSetting = StorageManager.loadItem(Config.STORAGE_KEYS.EDITOR_WORD_WRAP_ENABLED, "Editor Word Wrap", false);
        const fileMode = _getFileMode(filePath);
        const initialViewMode = (fileMode === 'markdown' || fileMode === 'html') ? 'split' : 'editor';

        state = {
            isActive: true,
            currentFilePath: filePath,
            originalContent: fileContent,
            currentContent: fileContent,
            undoStack: [fileContent],
            redoStack: [],
            isDirty: false,
            fileMode: fileMode,
            viewMode: initialViewMode,
            editorSettings: {
                wordWrap: wordWrapSetting
            },
            findState: { query: "", matches: [], currentIndex: -1, isCaseSensitive: false, isRegex: false, error: null }
        };

        EditorUI.buildAndShow(state, callbacks);
        callbacks.onExit = onExitCallback;
    }

    async function exit() {
        if (!state.isActive) return;
        if (state.isDirty) {
            const confirmed = await new Promise(resolve => {
                ModalManager.request({
                    context: 'graphical',
                    messageLines: [Config.MESSAGES.EDITOR_DISCARD_CONFIRM],
                    confirmText: "Save & Exit",
                    cancelText: "Discard Changes",
                    onConfirm: async () => { await saveContent(); resolve(true); },
                    onCancel: () => {
                        ModalManager.request({
                            context: 'graphical',
                            messageLines: ["Are you sure you want to discard all changes?"],
                            confirmText: "Discard", cancelText: "Cancel",
                            onConfirm: () => resolve(true), onCancel: () => resolve(false)
                        });
                    }
                });
            });
            if (!confirmed) return;
        }
        _performExit();
    }

    function _performExit() {
        EditorUI.hideAndReset();
        state.isActive = false;
        if (typeof callbacks.onExit === 'function') {
            callbacks.onExit();
        }
    }

    function _getFileMode(filePath) {
        const extension = Utils.getFileExtension(filePath);
        if (extension === 'md') return 'markdown';
        if (extension === 'html') return 'html';
        return 'text';
    }

    async function saveContent() {
        if (!state.isActive) return;
        const currentUser = UserManager.getCurrentUser().name;
        const primaryGroup = UserManager.getPrimaryGroupForUser(currentUser);
        if (!primaryGroup) {
            EditorUI.updateStatusBar({ ...state, statusMessage: "Error: Cannot determine user's primary group." });
            return;
        }
        const saveResult = await FileSystemManager.createOrUpdateFile(state.currentFilePath, state.currentContent, { currentUser, primaryGroup });
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

    function _findMatches(query, content, isCaseSensitive, isRegex) {
        state.findState.error = null;
        if (!query) return [];

        try {
            const flags = 'g' + (isCaseSensitive ? '' : 'i');
            const pattern = isRegex ? new RegExp(query, flags) : new RegExp(query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), flags);
            const matches = [];
            let match;
            while ((match = pattern.exec(content)) !== null) {
                matches.push({ start: match.index, end: match.index + match[0].length });
            }
            return matches;
        } catch (e) {
            state.findState.error = e.message;
            return [];
        }
    }

    // Define the debounced function before the callbacks object that uses it.
    const debouncedSaveUndo = Utils.debounce(() => {
        if (state.undoStack.at(-1) !== state.currentContent) {
            state.undoStack.push(state.currentContent);
            if (state.undoStack.length > 50) state.undoStack.shift();
            state.redoStack = [];
            // Make sure the UI reflects that the undo stack has changed
            if(state.isActive) {
                EditorUI.updateStatusBar(state);
            }
        }
    }, 300);

    const callbacks = {
        onContentUpdate: (newContent) => {
            if (!state.isActive) return;
            state.currentContent = newContent;
            state.isDirty = state.currentContent !== state.originalContent;

            // Re-run find to keep matches fresh
            state.findState.matches = _findMatches(state.findState.query, state.currentContent, state.findState.isCaseSensitive, state.findState.isRegex);
            state.findState.currentIndex = -1;

            // Update UI elements
            EditorUI.updateFindUI(state.findState);
            EditorUI.updateStatusBar(state);
            EditorUI.renderPreview(state.fileMode, state.currentContent);
            EditorUI.updateLineNumbers(state.currentContent);

            // Now, safely call the debounced function
            debouncedSaveUndo();
        },
        onSaveRequest: async () => { await saveContent(); _performExit(); },
        onExitRequest: () => { exit(); },
        onUndoRequest: () => {
            if (state.undoStack.length > 1) {
                state.redoStack.push(state.undoStack.pop());
                state.currentContent = state.undoStack.at(-1);
                state.isDirty = state.currentContent !== state.originalContent;
                EditorUI.setContent(state.currentContent);
            }
        },
        onRedoRequest: () => {
            if (state.redoStack.length > 0) {
                const nextState = state.redoStack.pop();
                state.undoStack.push(nextState);
                state.currentContent = nextState;
                state.isDirty = state.currentContent !== state.originalContent;
                EditorUI.setContent(state.currentContent);
            }
        },
        onToggleWordWrap: () => {
            state.editorSettings.wordWrap = !state.editorSettings.wordWrap;
            StorageManager.saveItem(Config.STORAGE_KEYS.EDITOR_WORD_WRAP_ENABLED, state.editorSettings.wordWrap, "Editor Word Wrap");
            EditorUI.applySettings(state.editorSettings);
        },
        onToggleViewMode: () => {
            const modes = ['editor', 'split', 'preview'];
            const currentIndex = modes.indexOf(state.viewMode);
            state.viewMode = modes[(currentIndex + 1) % modes.length];
            EditorUI.applyViewMode(state.viewMode);
        },
        onFind: (query, findOptions) => {
            state.findState.query = query;
            state.findState.isCaseSensitive = findOptions.isCaseSensitive;
            state.findState.isRegex = findOptions.isRegex;
            state.findState.matches = _findMatches(query, state.currentContent, findOptions.isCaseSensitive, findOptions.isRegex);
            state.findState.currentIndex = state.findState.matches.length > 0 ? 0 : -1;
            EditorUI.updateFindUI(state.findState);
            if (state.findState.currentIndex !== -1) {
                EditorUI.highlightMatch(state.findState.matches[0]);
            }
        },
        onFindNext: () => {
            if (state.findState.matches.length > 0) {
                state.findState.currentIndex = (state.findState.currentIndex + 1) % state.findState.matches.length;
                EditorUI.highlightMatch(state.findState.matches[state.findState.currentIndex]);
            }
        },
        onFindPrev: () => {
            if (state.findState.matches.length > 0) {
                state.findState.currentIndex = (state.findState.currentIndex - 1 + state.findState.matches.length) % state.findState.matches.length;
                EditorUI.highlightMatch(state.findState.matches[state.findState.currentIndex]);
            }
        },
        onReplace: (replaceTerm) => {
            const { matches, currentIndex } = state.findState;
            if (currentIndex === -1 || !matches[currentIndex]) return;
            const match = matches[currentIndex];
            const newContent = state.currentContent.substring(0, match.start) + replaceTerm + state.currentContent.substring(match.end);
            EditorUI.setContent(newContent); // This will trigger onContentUpdate and a re-find
        },
        onReplaceAll: (replaceTerm) => {
            const { matches } = state.findState;
            if (matches.length === 0) return;
            let newContent = state.currentContent;
            let offset = 0;
            for (const match of matches) {
                const start = match.start + offset;
                const end = match.end + offset;
                newContent = newContent.substring(0, start) + replaceTerm + newContent.substring(end);
                offset += replaceTerm.length - (end - start);
            }
            EditorUI.setContent(newContent);
        }
    };

    return { enter, exit, isActive: () => state.isActive };
})();