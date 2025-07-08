/**
 * @file Manages the DOM and user interaction for the OopisOS text editor.
 * This module is the "hands" of the editor; it only renders state and forwards events.
 * @author Andrew Edmark
 * @author Gemini
 */
const EditorUI = (() => {
    "use strict";

    let elements = {};
    let managerCallbacks = {};

    /**
     * Creates the editor's DOM structure and displays it.
     * @param {object} initialState - The initial state from EditorManager.
     * @param {object} callbacks - The callback functions from EditorManager.
     */
    function buildAndShow(initialState, callbacks) {
        managerCallbacks = callbacks;

        // Main container
        elements.container = Utils.createElement('div', { id: 'editor-container', className: 'editor-container' });

        // Header
        elements.header = Utils.createElement('header', { className: 'editor-header' });
        elements.fileName = Utils.createElement('div', { className: 'editor-filename' });
        elements.header.appendChild(elements.fileName);

        // Editor Pane
        elements.editorPane = Utils.createElement('div', { className: 'editor-pane' });
        elements.textArea = Utils.createElement('textarea', { className: 'editor-textarea', spellcheck: 'false' });
        elements.editorPane.appendChild(elements.textArea);

        // Status Bar
        elements.statusBar = Utils.createElement('div', { className: 'editor-statusbar' });
        elements.statusFileName = Utils.createElement('span');
        elements.statusDirty = Utils.createElement('span', { className: 'editor-dirty-indicator' });
        elements.statusInfo = Utils.createElement('span');
        elements.statusBar.append(elements.statusFileName, elements.statusDirty, elements.statusInfo);

        // Assemble the container
        elements.container.append(elements.header, elements.editorPane, elements.statusBar);

        // Attach event listeners
        _addEventListeners();

        // Initial render
        _render(initialState);

        // Show on screen
        AppLayerManager.show(elements.container);
        elements.textArea.focus();
    }

    /**
     * Hides and cleans up the editor's DOM elements.
     */
    function hideAndReset() {
        if (elements.container) {
            elements.container.remove();
        }
        elements = {};
        managerCallbacks = {};
    }

    /**
     * Renders the entire UI based on the current state.
     * @param {object} state - The current state from EditorManager.
     */
    function _render(state) {
        elements.fileName.textContent = state.currentFilePath;
        elements.textArea.value = state.currentContent;
        updateStatusBar(state);
    }

    /**
     * Updates only the status bar with new information.
     * @param {object} state - The current state from EditorManager.
     */
    function updateStatusBar(state) {
        elements.statusFileName.textContent = state.currentFilePath;
        elements.statusDirty.textContent = state.isDirty ? '*' : '';
        const lineCount = state.currentContent.split('\n').length;
        const wordCount = state.currentContent.trim().split(/\s+/).filter(Boolean).length;
        elements.statusInfo.textContent = `Lines: ${lineCount}, Words: ${wordCount}, Chars: ${state.currentContent.length}`;

        if (state.statusMessage) {
            elements.statusInfo.textContent += ` | ${state.statusMessage}`;
            // Clear the message after a delay
            setTimeout(() => {
                if (elements.statusInfo) {
                    updateStatusBar(state); // Re-render without message
                }
            }, 3000);
        }
    }

    /**
     * Sets the content of the text area.
     * @param {string} content - The new content to display.
     */
    function setContent(content) {
        if (elements.textArea) {
            elements.textArea.value = content;
        }
    }


    /**
     * Sets up all necessary DOM event listeners.
     */
    function _addEventListeners() {
        // Listen for content changes
        elements.textArea.addEventListener('input', () => {
            managerCallbacks.onContentUpdate(elements.textArea.value);
        });

        // Listen for keyboard shortcuts
        elements.container.addEventListener('keydown', (e) => {
            if (e.ctrlKey || e.metaKey) {
                switch (e.key.toLowerCase()) {
                    case 's':
                        e.preventDefault();
                        managerCallbacks.onSaveRequest();
                        break;
                    case 'o':
                        e.preventDefault();
                        managerCallbacks.onExitRequest();
                        break;
                    case 'z':
                        e.preventDefault();
                        if (e.shiftKey) {
                            managerCallbacks.onRedoRequest();
                        } else {
                            managerCallbacks.onUndoRequest();
                        }
                        break;
                    case 'y':
                        e.preventDefault();
                        managerCallbacks.onRedoRequest();
                        break;
                }
            } else if (e.key === 'Escape') {
                e.preventDefault();
                managerCallbacks.onExitRequest();
            }
        });
    }

    return {
        buildAndShow,
        hideAndReset,
        updateStatusBar,
        setContent,
    };
})();