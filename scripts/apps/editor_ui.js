const EditorUI = (() => {
    "use strict";
    let elements = {};
    let eventCallbacks = {};
    let previewDebounceTimer;
    const iframeStyles = `
    <style>
      body { font-family: 'Inter', sans-serif; line-height: 1.5; color: #e5e7eb; background-color: #212121; margin: 1rem; }
      h1, h2, h3, h4, h5, h6 { color: #38bdf8; border-bottom: 1px solid #52525b; margin-top: 1.5rem; margin-bottom: 1rem; padding-bottom: 0.25rem; }
      p { margin-bottom: 1rem; } a { color: #2dd4bf; text-decoration: underline; } a:hover { color: #5eead4; }
      ul, ol { padding-left: 2rem; margin-bottom: 1rem; }
      blockquote { border-left: 4px solid #38bdf8; padding-left: 1rem; margin-left: 0; font-style: italic; color: #737373; }
      code:not(pre > code) { background-color: #27272a; color: #fde047; padding: 0.2rem 0.4rem; border-radius: 0.25rem; font-family: 'VT323', monospace; font-size: 0.9em; }
      pre { background-color: #0a0a0a; padding: 1rem; border-radius: 0.25rem; overflow-x: auto; border: 1px solid #3f3f46; font-family: 'VT323', monospace; color: #e5e7eb; }
      pre > code { padding: 0; background-color: transparent; color: inherit; font-size: 1em; }
      table { width: 100%; border-collapse: collapse; margin-bottom: 1rem; }
      th, td { border: 1px solid #52525b; padding: 0.5rem; text-align: left; }
      th { background-color: #3f3f46; } img { max-width: 100%; height: auto; display: block; margin: 0.5rem 0; }
    </style>`;

    function applyTextareaWordWrap(isWordWrapActive) {
        if (elements.textarea && elements.highlighter) {
            // Toggle the specific classes for wrapping behavior
            elements.textarea.classList.toggle('editor__input--no-wrap', !isWordWrapActive);
            elements.highlighter.classList.toggle('editor__highlighter--no-wrap', !isWordWrapActive);

            // Also toggle the visibility of the line number gutter, which is hidden when wrapping
            setGutterVisibility(!isWordWrapActive);
        }
    }

    function applyPreviewWordWrap(isWordWrapActive, fileMode) {
        if (elements.previewPane) {
            elements.previewPane.style.wordBreak = isWordWrapActive ? "break-all" : "normal";
        }
    }

    function updateWordWrapButtonText(isWordWrapActive) {
        if (elements.wordWrapToggleButton) {
            elements.wordWrapToggleButton.textContent = isWordWrapActive ? "Wrap: On" : "Wrap: Off";
        }
    }

    function getPreviewPaneHTML() {
        return elements.previewPane ? elements.previewPane.innerHTML : "";
    }

    function _updateFormattingToolbarVisibility(mode) {
        const isMarkdown = mode === EditorAppConfig.EDITOR.MODES.MARKDOWN;
        const isHtml = mode === EditorAppConfig.EDITOR.MODES.TEXT;
        if (elements.formattingToolbar) {
            elements.formattingToolbar.classList.toggle('hidden', !isMarkdown);
        }
        if (elements.htmlFormattingToolbar) {
            elements.htmlFormattingToolbar.classList.toggle('hidden', !isHtml);
        }
    }

    /**
     * Parses a string of HTML, removes potentially harmful elements like <script>
     * and <style>, and returns the sanitized HTML string.
     * @private
     * @param {string} dirtyHtml - The potentially unsafe HTML content from the user.
     * @returns {string} The sanitized HTML string.
     */
    function _sanitizeHtml(dirtyHtml) {
        // Use the browser's built-in parser to create a document fragment
        const parser = new DOMParser();
        const doc = parser.parseFromString(dirtyHtml, 'text/html');

        // Find and remove all script and style tags
        doc.querySelectorAll('script, style').forEach(el => el.remove());

        // Return the inner HTML of the sanitized body
        return doc.body.innerHTML;
    }

    function calculateVisibleRange() {
        if (!elements.textareaWrapper) {
            return { startLine: 0, endLine: 25, visibleLines: 25, paddingTop: 0 };
        }
        const lineHeight = Utils.getCharacterDimensions(getComputedStyle(elements.textarea).font).height || 16;
        const scrollTop = elements.textareaWrapper.scrollTop;
        const clientHeight = elements.textareaWrapper.clientHeight;
        const startLine = Math.floor(scrollTop / lineHeight);
        const visibleLines = Math.ceil(clientHeight / lineHeight);
        const endLine = startLine + visibleLines + 2; // +2 for buffer

        return {
            startLine,
            endLine,
            visibleLines,
            paddingTop: startLine * lineHeight
        };
    }

    function renderVisibleContent(html, paddingTop, totalHeight) {
        if (elements.highlighterContent) {
            elements.highlighterContent.innerHTML = html;
            elements.highlighterContent.style.paddingTop = `${paddingTop}px`;
        }
        if (elements.highlighter) {
            elements.highlighter.style.height = `${totalHeight}px`;
        }
    }

    function updateVisibleLineNumbers(start, end, paddingTop, totalHeight) {
        if (elements.lineGutterContent) {
            const numbers = Array.from({ length: (end - start) + 1 }, (_, i) => start + i + 1).join('\n');
            elements.lineGutterContent.textContent = numbers;
            // No longer need to set paddingTop and height here, it's handled by scroll sync
        }
    }

    function updateFindBar(findState) {
        if (!elements.findBar) return;
        elements.findBar.classList.toggle('hidden', !findState.isOpen);
        if (!findState.isOpen) return;

        elements.replaceInput.classList.toggle('hidden', !findState.isReplace);
        elements.replaceBtn.classList.toggle('hidden', !findState.isReplace);
        elements.replaceAllBtn.classList.toggle('hidden', !findState.isReplace);

        if (findState.query && findState.matches.length > 0) {
            elements.findMatchesDisplay.textContent = `${findState.activeIndex + 1} / ${findState.matches.length}`;
        } else if (findState.query) {
            elements.findMatchesDisplay.textContent = '0 / 0';
        }
        else {
            elements.findMatchesDisplay.textContent = '';
        }
    }

    function getFindQuery() {
        return elements.findInput ? elements.findInput.value : "";
    }

    function getReplaceQuery() {
        return elements.replaceInput ? elements.replaceInput.value : "";
    }

    function renderPreview(text, mode, isWordWrapActive) {
        if (previewDebounceTimer) clearTimeout(previewDebounceTimer);
        previewDebounceTimer = setTimeout(() => {
            if (!elements.previewPane) return;
            try {
                if (mode === EditorAppConfig.EDITOR.MODES.MARKDOWN) {
                    elements.previewPane.innerHTML = `<div class="markdown-preview">${marked.parse(text)}</div>`;
                } else if (mode === EditorAppConfig.EDITOR.MODES.TEXT) {
                    // 1. Sanitize the user's HTML to remove unsafe tags
                    const sanitizedUserHtml = _sanitizeHtml(text);

                    // 2. Combine our safe styles with the user's sanitized content
                    const fullHtml = iframeStyles + sanitizedUserHtml;

                    // 3. Create the iframe and set its srcdoc attribute
                    const iframe = Utils.createElement("iframe", {
                        style: { width: "100%", height: "100%", border: "none" },
                        sandbox: "allow-scripts", // Keep sandbox for an extra layer of security
                        srcdoc: fullHtml // Use srcdoc to safely render the content
                    });

                    elements.previewPane.innerHTML = ''; // Clear the preview pane
                    elements.previewPane.appendChild(iframe); // Add our new iframe
                }
            } catch (e) {
                elements.previewPane.textContent = `Preview failed: ${e.message}`;
            }
            applyPreviewWordWrap(isWordWrapActive, mode);
        }, EditorAppConfig.EDITOR.DEBOUNCE_DELAY_MS);
    }

// In scripts/apps/editor_ui.js

    function buildLayout(callbacks) {
        eventCallbacks = callbacks;

        // --- 1. Define ALL elements first (this part is correct) ---
        elements.highlighterContent = Utils.createElement("div", { className: "editor__highlighter-content" });
        elements.highlighter = Utils.createElement("div", { id: "editor-highlighter", className: "editor__highlighter" }, elements.highlighterContent);
        elements.textarea = Utils.createElement("div", {
            id: "editor-textarea", className: "editor__input", contenteditable: "true", spellcheck: "false", autocapitalize: "none",
            eventListeners: {
                input: eventCallbacks.onInput, click: eventCallbacks.onSelectionChange, keyup: eventCallbacks.onSelectionChange, keydown: eventCallbacks.onKeydown,
                dragstart: (e) => e.preventDefault(), drag: (e) => e.preventDefault(), dragend: (e) => e.preventDefault(),
                dragenter: (e) => e.preventDefault(), dragleave: (e) => e.preventDefault(), dragover: (e) => e.preventDefault(), drop: (e) => e.preventDefault()
            }
        });
        elements.lineGutterContent = Utils.createElement("div", { className: "editor__gutter-content" });
        elements.lineGutter = Utils.createElement("div", { id: "editor-line-gutter", className: "editor__gutter" }, elements.lineGutterContent);
        elements.previewPane = Utils.createElement("div", { id: "editor-preview-content", className: "editor__preview-content" });
        elements.previewWrapper = Utils.createElement("div", { id: "editor-preview-wrapper", className: "editor__preview-wrapper" }, elements.previewPane);
        elements.findInput = Utils.createElement("input", { className: "find-bar__input", placeholder: "Find...", eventListeners: { input: eventCallbacks.onFindInputChange, keydown: eventCallbacks.onFindBarKeyDown } });
        elements.replaceInput = Utils.createElement("input", { className: "find-bar__input", placeholder: "Replace...", eventListeners: { keydown: eventCallbacks.onFindBarKeyDown } });
        elements.findMatchesDisplay = Utils.createElement("span", { className: "find-bar__matches" });
        elements.prevBtn = Utils.createElement("button", { className: "find-bar__btn", textContent: "▲", title: "Previous Match (Shift+Enter)", eventListeners: { click: eventCallbacks.onFindPrev } });
        elements.nextBtn = Utils.createElement("button", { className: "find-bar__btn", textContent: "▼", title: "Next Match (Enter)", eventListeners: { click: eventCallbacks.onFindNext } });
        elements.replaceBtn = Utils.createElement("button", { className: "find-bar__btn", textContent: "Replace", eventListeners: { click: eventCallbacks.onReplace } });
        elements.replaceAllBtn = Utils.createElement("button", { className: "find-bar__btn", textContent: "All", eventListeners: { click: eventCallbacks.onReplaceAll } });
        elements.closeFindBtn = Utils.createElement("button", { className: "find-bar__btn find-bar__btn--close", textContent: "×", title: "Close (Esc)", eventListeners: { click: eventCallbacks.onFindBarClose } });
        elements.formattingToolbar = Utils.createElement("div", { className: `editor__toolbar hidden` });
        elements.htmlFormattingToolbar = Utils.createElement("div", { className: "editor__toolbar hidden" });
        elements.wordWrapToggleButton = Utils.createElement("button", { id: "editor-word-wrap-toggle", className: "editor-btn", eventListeners: { click: eventCallbacks.onWordWrapToggle } });
        elements.highlightToggleButton = Utils.createElement("button", { id: "editor-highlight-toggle", className: "editor-btn", eventListeners: { click: eventCallbacks.onHighlightToggle } });
        elements.viewToggleButton = Utils.createElement("button", { id: "editor-view-toggle", className: "editor-btn", eventListeners: { click: eventCallbacks.onViewToggle } });
        elements.exportPreviewButton = Utils.createElement("button", { id: "editor-export-preview", className: "editor-btn", textContent: "Export", eventListeners: { click: eventCallbacks.onExportPreview } });
        elements.exitButton = Utils.createElement("button", { id: "editor-exit-btn", className: "editor-btn", textContent: "Exit", title: "Exit (prompts to save if unsaved)", eventListeners: { click: eventCallbacks.onExitButtonClick } });
        elements.filenameDisplay = Utils.createElement("span", { id: "editor-filename-display" });
        elements.statusBarCursorPos = Utils.createElement("span", { id: "status-cursor" });
        elements.statusBarLineCount = Utils.createElement("span", { id: "status-lines" });
        elements.statusBarWordCount = Utils.createElement("span", { id: "status-words" });
        elements.statusBarCharCount = Utils.createElement("span", { id: "status-chars" });
        elements.instructionsFooter = Utils.createElement("div", { id: "editor-instructions-footer", className: "editor__footer", textContent: `Ctrl+S: Save | Ctrl+O: Exit | Ctrl+P: Preview | Ctrl+F: Find | Ctrl+H: Replace` });

        // --- 2. Assemble Complex Components ---
        const findNavGroup = Utils.createElement("div", { className: "find-bar__button-group" }, elements.prevBtn, elements.nextBtn);
        const replaceGroup = Utils.createElement("div", { className: "find-bar__button-group" }, elements.replaceBtn, elements.replaceAllBtn);
        elements.findBar = Utils.createElement("div", { id: "editor-find-bar", className: "editor__find-bar hidden" },
            elements.findInput, findNavGroup, elements.findMatchesDisplay, elements.replaceInput, replaceGroup, elements.closeFindBtn
        );

        const mdButtonDetails = [
            { name: 'undoButton', iconHTML: '<svg ... (content omitted for brevity) ... </svg>', title: 'Undo (Ctrl+Z)', callbackName: 'onUndo' },
            { name: 'redoButton', iconHTML: '<svg ... (content omitted for brevity) ... </svg>', title: 'Redo (Ctrl+Y / Ctrl+Shift+Z)', callbackName: 'onRedo' },
            { name: 'boldButton', iconHTML: '<svg ... (content omitted for brevity) ... </svg>', title: 'Bold (Ctrl+B)', callbackName: 'onFormatBold' },
            { name: 'italicButton', iconHTML: '<svg ... (content omitted for brevity) ... </svg>', title: 'Italic (Ctrl+I)', callbackName: 'onFormatItalic' },
            { name: 'linkButton', iconHTML: '<svg ... (content omitted for brevity) ... </svg>', title: 'Insert Link', callbackName: 'onFormatLink' },
            { name: 'quoteButton', iconHTML: '<svg ... (content omitted for brevity) ... </svg>', title: 'Blockquote', callbackName: 'onFormatQuote' },
            { name: 'codeButton', iconHTML: '<svg ... (content omitted for brevity) ... </svg>', title: 'Inline Code', callbackName: 'onFormatCode' },
            { name: 'codeBlockButton', iconHTML: '<svg ... (content omitted for brevity) ... </svg>', title: 'Code Block', callbackName: 'onFormatCodeBlock' },
            { name: 'ulButton', iconHTML: '<svg ... (content omitted for brevity) ... </svg>', title: 'Unordered List', callbackName: 'onFormatUl' },
            { name: 'olButton', iconHTML: '<svg ... (content omitted for brevity) ... </svg>', title: 'Ordered List', callbackName: 'onFormatOl' }
        ];
        mdButtonDetails.forEach(detail => {
            elements[detail.name] = Utils.createElement("button", {
                className: "editor-btn editor-btn--format",
                innerHTML: detail.iconHTML.replace(/#3eca02/g, 'currentColor'),
                title: detail.title,
                eventListeners: { click: eventCallbacks[detail.callbackName] }
            });
            elements.formattingToolbar.appendChild(elements[detail.name]);
        });

        const htmlButtonDetails = [
            { name: 'h1Button', text: 'H1', title: 'Header 1', callbackName: 'onFormatH1' },
            { name: 'pButton', text: 'P', title: 'Paragraph', callbackName: 'onFormatP' },
            { name: 'aButton', text: 'A', title: 'Link', callbackName: 'onFormatA' },
            { name: 'bButton', text: 'B', title: 'Bold', callbackName: 'onFormatB' },
            { name: 'iButton', text: 'I', title: 'Italic', callbackName: 'onFormatI_html' }
        ];
        htmlButtonDetails.forEach(detail => {
            elements[detail.name] = Utils.createElement("button", {
                className: "editor-btn editor-btn--format",
                textContent: detail.text,
                title: detail.title,
                eventListeners: { click: eventCallbacks[detail.callbackName] }
            });
            elements.htmlFormattingToolbar.appendChild(elements[detail.name]);
        });

        const controlsLeftGroup = Utils.createElement("div", { className: "editor__controls-group" }, elements.formattingToolbar, elements.htmlFormattingToolbar);
        const controlsRightGroup = Utils.createElement("div", { className: "editor__controls-group" }, elements.wordWrapToggleButton, elements.highlightToggleButton, elements.viewToggleButton, elements.exportPreviewButton, elements.exitButton);
        elements.controlsDiv = Utils.createElement("div", { id: "editor-controls", className: "editor__controls" }, controlsLeftGroup, controlsRightGroup);

        const statusBarLeft = Utils.createElement("div", { className: "editor__status-bar-group" }, elements.statusBarCursorPos, elements.statusBarLineCount);
        const statusBarRight = Utils.createElement("div", { className: "editor__status-bar-group" }, elements.statusBarWordCount, elements.statusBarCharCount);
        elements.statusBar = Utils.createElement("div", { id: "editor-status-bar", className: "editor__status-bar" }, statusBarLeft, elements.filenameDisplay, statusBarRight);

        const gridContainer = Utils.createElement("div", {
            style: { position: 'relative', flexGrow: 1, display: 'grid' }
        }, [elements.highlighter, elements.textarea]);

        elements.textareaWrapper = Utils.createElement("div", {
            id: "editor-textarea-wrapper",
            className: "editor__textarea-wrapper",
            eventListeners: { scroll: eventCallbacks.onScroll }
        }, [elements.lineGutter, gridContainer]);

        elements.mainArea = Utils.createElement("div", { id: "editor-main-area", className: "editor__main-area" },
            elements.textareaWrapper,
            elements.previewWrapper
        );

        elements.editorContainer = Utils.createElement("div", { id: "editor-container", className: "editor-container" },
            elements.controlsDiv,
            elements.findBar,
            elements.mainArea,
            elements.statusBar,
            elements.instructionsFooter
        );

        return elements.editorContainer;
    }

    function setGutterVisibility(visible) {
        if (elements.lineGutter) {
            elements.lineGutter.classList.toggle('editor__gutter--hidden-by-wrap', !visible);
        }
    }

    function destroyLayout() {
        if (previewDebounceTimer) clearTimeout(previewDebounceTimer);
        previewDebounceTimer = null;
        elements = {};
        eventCallbacks = {};
    }

    function updateFilenameDisplay(filePath, isDirty) {
        if (elements.filenameDisplay) {
            elements.filenameDisplay.textContent = `File: ${filePath || "Untitled"}${isDirty ? "*" : ""}`;
        }
    }

    function updateStatusBar(text, selectionStart) {
        if (!elements.textarea || !elements.statusBar) return;
        const stats = EditorUtils.calculateStatusBarInfo(text, selectionStart);
        if (elements.statusBarLineCount) elements.statusBarLineCount.textContent = `Lines: ${stats.lines}`;
        if (elements.statusBarWordCount) elements.statusBarWordCount.textContent = `Words: ${stats.words} `;
        if (elements.statusBarCharCount) elements.statusBarCharCount.textContent = `Chars: ${stats.chars}`;
        if (elements.statusBarCursorPos) elements.statusBarCursorPos.textContent = `Ln: ${stats.cursor.line}, Col: ${stats.cursor.col} `;
    }

    function updateLineNumbers(text, startLine, endLine, paddingTop, totalHeight) {
        if (!elements.textarea || !elements.lineGutter) return;

        const totalLines = text.split('\n').length;
        const numbersToRender = Array.from({ length: (endLine - startLine) }, (_, i) => startLine + i + 1);

        elements.lineGutter.textContent = numbersToRender.join('\n');
        elements.lineGutter.style.paddingTop = `${paddingTop}px`;
        elements.lineGutter.style.height = `${totalHeight}px`;
    }

    function syncScrolls() {
        if (elements.textarea && elements.highlighter) {
            eventCallbacks.onScroll();
        }
    }

    function getInputContent() {
        return elements.textarea ? elements.textarea.textContent : "";
    }

    function setInputContent(text) {
        if (elements.textarea) elements.textarea.textContent = text;
    }

    function setInputFocus() {
        if (elements.textarea) elements.textarea.focus();
    }

    function getInputSelection() {
        const sel = window.getSelection();
        const editorInput = elements.textarea;
        if (!editorInput || !sel.rangeCount || !editorInput.contains(sel.anchorNode)) {
            const len = editorInput.textContent.length;
            return { start: len, end: len };
        }
        const range = sel.getRangeAt(0);
        const preSelectionRange = range.cloneRange();
        preSelectionRange.selectNodeContents(editorInput);
        preSelectionRange.setEnd(range.startContainer, range.startOffset);
        const start = preSelectionRange.toString().length;
        return { start: start, end: start + range.toString().length };
    }

    function setInputSelection(start, end) {
        const editorInput = elements.textarea;
        if (!editorInput || typeof start !== 'number' || typeof end !== 'number') return;
        const range = document.createRange();
        const sel = window.getSelection();
        let charCount = 0;
        let startNode, startOffset, endNode, endOffset;

        function findNode(node) {
            if (node.nodeType === Node.TEXT_NODE) {
                const nextCharCount = charCount + node.length;
                if (!startNode && start >= charCount && start <= nextCharCount) {
                    startNode = node;
                    startOffset = start - charCount;
                }
                if (!endNode && end >= charCount && end <= nextCharCount) {
                    endNode = node;
                    endOffset = end - charCount;
                }
                charCount = nextCharCount;
            } else {
                for (let i = 0; i < node.childNodes.length; i++) {
                    if (findNode(node.childNodes[i])) return true;
                }
            }
            return startNode && endNode;
        }

        findNode(editorInput);

        if (!startNode || !endNode) {
            range.selectNodeContents(editorInput);
            range.collapse(false);
        } else {
            range.setStart(startNode, startOffset);
            range.setEnd(endNode, endOffset);
        }

        if (sel) {
            sel.removeAllRanges();
            sel.addRange(range);
        }
    }

    function renderHighlights(htmlContent) {
        if (elements.highlighterContent) {
            elements.highlighterContent.innerHTML = htmlContent;
            if (elements.textarea && elements.highlighter) {
                elements.highlighter.scrollTop = elements.textarea.scrollTop;
            }
        }
    }

    function setViewMode(viewMode, fileMode, isPreviewable, isWordWrapActive) {
        if (!elements.mainArea || !elements.textareaWrapper || !elements.previewWrapper) return;

        const editorPane = elements.textareaWrapper;
        const previewPane = elements.previewWrapper;
        const viewToggleButton = elements.viewToggleButton;
        const exportButton = elements.exportPreviewButton;

        if (viewToggleButton) viewToggleButton.classList.toggle('hidden', !isPreviewable);
        if (exportButton) exportButton.classList.toggle('hidden', !isPreviewable);

        editorPane.style.display = 'none';
        previewPane.style.display = 'none';

        setGutterVisibility(!isWordWrapActive);

        if (!isPreviewable) {
            editorPane.style.display = 'flex';
            return;
        }

        switch (viewMode) {
            case EditorAppConfig.EDITOR.VIEW_MODES.EDIT_ONLY:
                editorPane.style.display = 'flex';
                if (viewToggleButton) viewToggleButton.textContent = "Preview";
                break;
            case EditorAppConfig.EDITOR.VIEW_MODES.PREVIEW_ONLY:
                previewPane.style.display = 'flex';
                setGutterVisibility(false);
                if (viewToggleButton) viewToggleButton.textContent = "Split";
                break;
            case EditorAppConfig.EDITOR.VIEW_MODES.SPLIT:
            default:
                editorPane.style.display = 'flex';
                previewPane.style.display = 'flex';
                if (viewToggleButton) viewToggleButton.textContent = "Editor";
                break;
        }
    }

    function updateHighlightButtonText(isHighlightingActive) {
        if (elements.highlightToggleButton) {
            elements.highlightToggleButton.textContent = isHighlightingActive ? "Syntax: On" : "Syntax: Off";
        }
    }

    return {
        buildLayout,
        destroyLayout,
        updateFilenameDisplay,
        updateStatusBar,
        updateLineNumbers,
        calculateVisibleRange,
        renderVisibleContent,
        updateVisibleLineNumbers,
        syncScrolls,
        setTextareaContent: setInputContent,
        getTextareaContent: getInputContent,
        setEditorFocus: setInputFocus,
        getTextareaSelection: getInputSelection,
        setTextareaSelection: setInputSelection,
        applyTextareaWordWrap,
        applyPreviewWordWrap,
        updateWordWrapButtonText,
        renderPreview,
        setViewMode,
        getPreviewPaneHTML,
        setGutterVisibility,
        elements,
        _updateFormattingToolbarVisibility,
        iframeStyles,
        updateFindBar,
        getFindQuery,
        getReplaceQuery,
        renderHighlights,
        updateHighlightButtonText
    };
})();