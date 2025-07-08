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

    function buildAndShow(initialState, callbacks) {
        managerCallbacks = callbacks;

        // Main container
        elements.container = Utils.createElement('div', { id: 'editor-container', className: 'editor-container' });

        // Header and Toolbar
        elements.fileName = Utils.createElement('div', { className: 'editor-filename' });
        elements.wordWrapButton = Utils.createElement('button', { className: 'btn', textContent: 'Wrap' });
        elements.previewButton = Utils.createElement('button', { className: 'btn', textContent: 'Preview' });
        const toolbar = Utils.createElement('div', { className: 'editor-toolbar' }, [elements.wordWrapButton, elements.previewButton]);
        elements.header = Utils.createElement('header', { className: 'editor-header' }, [elements.fileName, toolbar]);

        // Main content area (split pane)
        elements.lineNumbers = Utils.createElement('div', { className: 'editor-linenumbers' });
        elements.textArea = Utils.createElement('textarea', { className: 'editor-textarea', spellcheck: 'false' });
        const editorWrapper = Utils.createElement('div', { className: 'editor-pane-wrapper' }, [elements.lineNumbers, elements.textArea]);

        elements.previewPane = Utils.createElement('div', { className: 'editor-preview' });
        elements.mainArea = Utils.createElement('main', { className: 'editor-main' }, [editorWrapper, elements.previewPane]);

        // Status Bar
        elements.statusBar = Utils.createElement('div', { className: 'editor-statusbar' });
        elements.statusFileName = Utils.createElement('span');
        elements.statusDirty = Utils.createElement('span', { className: 'editor-dirty-indicator' });
        elements.statusInfo = Utils.createElement('span');
        elements.statusBar.append(elements.statusFileName, elements.statusDirty, elements.statusInfo);

        // Assemble the container
        elements.container.append(elements.header, elements.mainArea, elements.statusBar);

        _addEventListeners();
        _render(initialState); // Initial render with state

        AppLayerManager.show(elements.container);
        elements.textArea.focus();
    }

    function hideAndReset() {
        if (elements.container) {
            elements.container.remove();
        }
        elements = {};
        managerCallbacks = {};
    }

    function _render(state) {
        elements.fileName.textContent = state.currentFilePath;
        elements.textArea.value = state.currentContent;
        updateStatusBar(state);
        updateLineNumbers(state.currentContent);
        renderPreview(state.fileMode, state.currentContent);
        applySettings(state.editorSettings);
        applyViewMode(state.viewMode);
    }

    function updateStatusBar(state) {
        if (!elements.statusFileName) return;
        elements.statusFileName.textContent = state.currentFilePath;
        elements.statusDirty.textContent = state.isDirty ? '*' : '';
        const lineCount = state.currentContent.split('\n').length;
        const wordCount = state.currentContent.trim().split(/\s+/).filter(Boolean).length;
        elements.statusInfo.textContent = `Lines: ${lineCount}, Words: ${wordCount}, Chars: ${state.currentContent.length}`;

        if (state.statusMessage) {
            elements.statusInfo.textContent += ` | ${state.statusMessage}`;
            setTimeout(() => {
                if (elements.statusInfo && !state.statusMessage.startsWith("Error")) {
                    updateStatusBar({ ...state, statusMessage: null });
                }
            }, 3000);
        }
    }

    function updateLineNumbers(content) {
        if (!elements.lineNumbers) return;
        const lineCount = content.split('\n').length || 1;
        elements.lineNumbers.innerHTML = Array.from({ length: lineCount }, (_, i) => `<span>${i + 1}</span>`).join('');
    }

    function renderPreview(fileMode, content) {
        if (!elements.previewPane) return;
        if (fileMode === 'markdown') {
            const dirtyHTML = marked.parse(content);
            elements.previewPane.innerHTML = DOMPurify.sanitize(dirtyHTML);
        } else if (fileMode === 'html') {
            // Basic sandboxing for HTML preview
            elements.previewPane.innerHTML = `<iframe srcdoc="${DOMPurify.sanitize(content)}" class="editor-html-preview" sandbox></iframe>`;
        } else {
            elements.previewPane.innerHTML = '';
        }
    }

    function applySettings(settings) {
        if (!elements.textArea) return;
        elements.textArea.style.whiteSpace = settings.wordWrap ? 'pre-wrap' : 'pre';
        elements.textArea.style.wordBreak = settings.wordWrap ? 'break-all' : 'normal';
        elements.wordWrapButton.classList.toggle('active', settings.wordWrap);
    }

    function applyViewMode(viewMode) {
        if (!elements.mainArea) return;
        elements.mainArea.dataset.viewMode = viewMode; // Use data-attribute for CSS styling
        elements.previewButton.classList.toggle('active', viewMode !== 'editor');
    }

    function setContent(content) {
        if (!elements.textArea) return;
        const cursorPos = elements.textArea.selectionStart;
        elements.textArea.value = content;
        elements.textArea.selectionStart = elements.textArea.selectionEnd = cursorPos;
        // Trigger necessary updates after setting content programmatically
        managerCallbacks.onContentUpdate(content);
    }

    function _addEventListeners() {
        elements.textArea.addEventListener('input', () => {
            managerCallbacks.onContentUpdate(elements.textArea.value);
        });

        // Sync scrolling for line numbers
        elements.textArea.addEventListener('scroll', () => {
            elements.lineNumbers.scrollTop = elements.textArea.scrollTop;
        });

        // Toolbar buttons
        elements.wordWrapButton.addEventListener('click', () => managerCallbacks.onToggleWordWrap());
        elements.previewButton.addEventListener('click', () => managerCallbacks.onToggleViewMode());

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
                    case 'p':
                        e.preventDefault();
                        managerCallbacks.onToggleViewMode();
                        break;
                }
            } else if (e.key === 'Escape') {
                e.preventDefault();
                managerCallbacks.onExitRequest();
            }
        });
    }

    return { buildAndShow, hideAndReset, updateStatusBar, setContent, applySettings, applyViewMode, renderPreview, updateLineNumbers };
})();