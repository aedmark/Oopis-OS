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

        elements.container = Utils.createElement('div', { id: 'editor-container', className: 'editor-container' });

        // Header and Toolbar
        elements.fileName = Utils.createElement('div', { className: 'editor-filename' });
        elements.wordWrapButton = Utils.createElement('button', { className: 'btn', textContent: 'Wrap' });
        elements.previewButton = Utils.createElement('button', { className: 'btn', textContent: 'Preview' });
        elements.findButton = Utils.createElement('button', { className: 'btn', textContent: 'Find' });

        // Build the formatting toolbar (initially hidden)
        _buildFormattingToolbar();

        const rightToolbar = Utils.createElement('div', { className: 'editor-toolbar' }, [elements.findButton, elements.wordWrapButton, elements.previewButton]);
        elements.header = Utils.createElement('header', { className: 'editor-header' }, [elements.fileName, elements.formattingToolbar, rightToolbar]);


        // Find/Replace Bar
        _buildFindBar();

        // Main content area
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

        elements.container.append(elements.header, elements.findBar, elements.mainArea, elements.statusBar);

        _addEventListeners();
        _render(initialState);

        AppLayerManager.show(elements.container);
        elements.textArea.focus();
    }

    function _buildFormattingToolbar() {
        const createButton = (text, title, action) => {
            const button = Utils.createElement('button', { className: 'btn', textContent: text, title });
            button.addEventListener('click', action);
            return button;
        };

        elements.formattingToolbar = Utils.createElement('div', { className: 'editor-toolbar editor-format-toolbar hidden' }, [
            createButton('B', 'Bold (Ctrl+B)', () => _wrapSelection('**')),
            createButton('I', 'Italic (Ctrl+I)', () => _wrapSelection('*')),
            createButton('H', 'Heading (Ctrl+H)', () => _prefixLine('# ')),
            createButton('“', 'Blockquote', () => _prefixLine('> ')),
            createButton('🔗', 'Link', () => _insertLink()),
            createButton('img', 'Image', () => _insertImage()),
        ]);
    }


    function _buildFindBar() {
        elements.findInput = Utils.createElement('input', { type: 'text', placeholder: 'Find...', className: 'editor-find-input' });
        elements.replaceInput = Utils.createElement('input', { type: 'text', placeholder: 'Replace...', className: 'editor-find-input' });
        elements.findNextButton = Utils.createElement('button', { className: 'btn', textContent: 'Next' });
        elements.findPrevButton = Utils.createElement('button', { className: 'btn', textContent: 'Prev' });
        elements.replaceButton = Utils.createElement('button', { className: 'btn', textContent: 'Replace' });
        elements.replaceAllButton = Utils.createElement('button', { className: 'btn', textContent: 'All' });
        elements.findCloseButton = Utils.createElement('button', { className: 'btn', textContent: '×' });
        elements.findInfo = Utils.createElement('span', { className: 'editor-find-info' });
        elements.findError = Utils.createElement('span', { className: 'editor-find-error' });
        elements.caseSensitiveToggle = Utils.createElement('button', { className: 'btn', textContent: 'Aa', title: 'Case Sensitive' });
        elements.regexToggle = Utils.createElement('button', { className: 'btn', textContent: '.*', title: 'Use Regular Expression' });

        elements.findBar = Utils.createElement('div', { className: 'editor-findbar hidden' }, [
            elements.findInput, elements.findPrevButton, elements.findNextButton, elements.findInfo,
            elements.replaceInput, elements.replaceButton, elements.replaceAllButton,
            elements.caseSensitiveToggle, elements.regexToggle, elements.findError,
            elements.findCloseButton
        ]);
    }

    function hideAndReset() {
        if (elements.container) elements.container.remove();
        elements = {};
        managerCallbacks = {};
    }

    function _render(state) {
        elements.fileName.textContent = state.currentFilePath;
        elements.textArea.value = state.currentContent;
        elements.formattingToolbar.classList.toggle('hidden', state.fileMode !== 'markdown');
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
        const cursorPos = elements.textArea ? `Ln ${elements.textArea.value.substring(0, elements.textArea.selectionStart).split('\n').length}, Col ${elements.textArea.selectionStart - elements.textArea.value.lastIndexOf('\n', elements.textArea.selectionStart - 1)}` : '';

        elements.statusInfo.textContent = `Lines: ${lineCount} | Words: ${wordCount} | ${cursorPos}`;

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
            elements.previewPane.innerHTML = DOMPurify.sanitize(marked.parse(content));
        } else if (fileMode === 'html') {
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
        elements.mainArea.dataset.viewMode = viewMode;
        elements.previewButton.classList.toggle('active', viewMode !== 'editor');
    }

    function setContent(content) {
        if (!elements.textArea) return;
        const cursorPos = elements.textArea.selectionStart;
        elements.textArea.value = content;
        elements.textArea.selectionStart = elements.textArea.selectionEnd = cursorPos;
        managerCallbacks.onContentUpdate(content);
    }

    function _wrapSelection(wrapper, defaultText = 'text') {
        const { textArea } = elements;
        const start = textArea.selectionStart;
        const end = textArea.selectionEnd;
        const text = textArea.value;
        const selectedText = text.substring(start, end);

        const textToInsert = selectedText || defaultText;
        const newText = `${text.substring(0, start)}${wrapper}${textToInsert}${wrapper}${text.substring(end)}`;

        setContent(newText);

        // After setting content, re-focus and select the inserted text
        setTimeout(() => {
            textArea.focus();
            if (selectedText) {
                textArea.setSelectionRange(start + wrapper.length, start + wrapper.length + selectedText.length);
            } else {
                textArea.setSelectionRange(start + wrapper.length, start + wrapper.length + defaultText.length);
            }
        }, 0);
    }

    function _prefixLine(prefix) {
        const { textArea } = elements;
        const start = textArea.selectionStart;
        const text = textArea.value;
        const lineStart = text.lastIndexOf('\n', start - 1) + 1;

        const newText = `${text.substring(0, lineStart)}${prefix}${text.substring(lineStart)}`;
        setContent(newText);

        setTimeout(() => {
            textArea.focus();
            textArea.setSelectionRange(start + prefix.length, start + prefix.length);
        }, 0);
    }

    async function _insertLink() {
        const url = await new Promise(r => ModalManager.request({ context: 'graphical-input', messageLines: ["Enter URL:"], onConfirm: r, onCancel: () => r(null)}));
        if(!url) return;
        _wrapSelection(`[`, `link text](${url})`);
    }

    async function _insertImage() {
        const url = await new Promise(r => ModalManager.request({ context: 'graphical-input', messageLines: ["Enter Image URL:"], onConfirm: r, onCancel: () => r(null)}));
        if(!url) return;
        _wrapSelection(`![`, `alt text](${url})`);
    }


    function highlightMatch(match) {
        if (!elements.textArea || !match) return;
        elements.textArea.focus();
        elements.textArea.setSelectionRange(match.start, match.end);
        const lines = elements.textArea.value.substring(0, match.start).split('\n').length;
        const lineHeight = elements.textArea.scrollHeight / elements.textArea.value.split('\n').length;
        elements.textArea.scrollTop = (lines - 5) * lineHeight;
    }

    function updateFindUI(findState) {
        const { matches, currentIndex, error } = findState;
        if (matches.length > 0) {
            elements.findInfo.textContent = `${currentIndex + 1} / ${matches.length}`;
            elements.findInfo.classList.remove('no-match');
        } else {
            elements.findInfo.textContent = 'No results';
            elements.findInfo.classList.add('no-match');
        }
        if (error) {
            elements.findError.textContent = error;
            elements.findError.classList.add('visible');
        } else {
            elements.findError.classList.remove('visible');
        }
    }

    function _addEventListeners() {
        elements.textArea.addEventListener('input', () => managerCallbacks.onContentUpdate(elements.textArea.value));
        elements.textArea.addEventListener('scroll', () => { elements.lineNumbers.scrollTop = elements.textArea.scrollTop; });
        elements.textArea.addEventListener('keyup', () => updateStatusBar(managerCallbacks.getState ? managerCallbacks.getState() : {}));
        elements.textArea.addEventListener('click', () => updateStatusBar(managerCallbacks.getState ? managerCallbacks.getState() : {}));

        // Toolbar
        elements.findButton.addEventListener('click', () => {
            elements.findBar.classList.toggle('hidden');
            if (!elements.findBar.classList.contains('hidden')) {
                elements.findInput.focus();
                elements.findInput.select();
            }
        });
        elements.wordWrapButton.addEventListener('click', () => managerCallbacks.onToggleWordWrap());
        elements.previewButton.addEventListener('click', () => managerCallbacks.onToggleViewMode());

        // Find Bar
        const triggerFind = () => {
            managerCallbacks.onFind(elements.findInput.value, {
                isCaseSensitive: elements.caseSensitiveToggle.classList.contains('active'),
                isRegex: elements.regexToggle.classList.contains('active')
            });
        };
        elements.findInput.addEventListener('input', triggerFind);
        elements.findInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); managerCallbacks.onFindNext(); }});
        elements.findNextButton.addEventListener('click', () => managerCallbacks.onFindNext());
        elements.findPrevButton.addEventListener('click', () => managerCallbacks.onFindPrev());
        elements.replaceButton.addEventListener('click', () => managerCallbacks.onReplace(elements.replaceInput.value));
        elements.replaceAllButton.addEventListener('click', () => managerCallbacks.onReplaceAll(elements.replaceInput.value));
        elements.caseSensitiveToggle.addEventListener('click', (e) => { e.currentTarget.classList.toggle('active'); triggerFind(); });
        elements.regexToggle.addEventListener('click', (e) => { e.currentTarget.classList.toggle('active'); triggerFind(); });
        elements.findCloseButton.addEventListener('click', () => elements.findBar.classList.add('hidden'));

        // Keyboard shortcuts
        elements.container.addEventListener('keydown', (e) => {
            if (e.ctrlKey || e.metaKey) {
                switch (e.key.toLowerCase()) {
                    case 's': e.preventDefault(); managerCallbacks.onSaveRequest(); break;
                    case 'o': e.preventDefault(); managerCallbacks.onExitRequest(); break;
                    case 'z': e.preventDefault(); e.shiftKey ? managerCallbacks.onRedoRequest() : managerCallbacks.onUndoRequest(); break;
                    case 'y': e.preventDefault(); managerCallbacks.onRedoRequest(); break;
                    case 'p': e.preventDefault(); managerCallbacks.onToggleViewMode(); break;
                    case 'f':
                        e.preventDefault();
                        elements.findBar.classList.toggle('hidden');
                        if (!elements.findBar.classList.contains('hidden')) {
                            elements.findInput.focus();
                            elements.findInput.select();
                        }
                        break;
                    case 'b': e.preventDefault(); _wrapSelection('**'); break;
                    case 'i': e.preventDefault(); _wrapSelection('*'); break;
                    case 'h': e.preventDefault(); _prefixLine('# '); break;
                }
            } else if (e.key === 'Escape') {
                if (!elements.findBar.classList.contains('hidden')) {
                    e.preventDefault();
                    elements.findBar.classList.add('hidden');
                } else {
                    managerCallbacks.onExitRequest();
                }
            }
        });
    }

    return { buildAndShow, hideAndReset, updateStatusBar, setContent, applySettings, applyViewMode, renderPreview, updateLineNumbers, highlightMatch, updateFindUI };
})();