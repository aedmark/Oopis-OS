const EditorAppConfig = {
    EDITOR: {
        DEBOUNCE_DELAY_MS: 450,
        FIND_DEBOUNCE_DELAY_MS: 250,
        TAB_REPLACEMENT: "    ",
        DEFAULT_MODE: "text",
        MODES: { TEXT: "text", MARKDOWN: "markdown", HTML: "html", JAVASCRIPT: "javascript", CSS: "css", SHELL: "shell" },
        EXTENSIONS_MAP: { md: "markdown", html: "html", htm: "html", js: "javascript", css: "css", sh: "shell" },
        VIEW_MODES: { SPLIT: "split", EDIT_ONLY: "edit", PREVIEW_ONLY: "preview" },
        WORD_WRAP_DEFAULT_ENABLED: false,
    },
    STORAGE_KEYS: {
        EDITOR_WORD_WRAP_ENABLED: "oopisOsEditorWordWrapEnabled",
    },
};
const EditorUtils = (() => {
    "use strict";
    function determineMode(filePath) {
        const extension = Utils.getFileExtension(filePath);
        return (EditorAppConfig.EDITOR.EXTENSIONS_MAP[extension] || EditorAppConfig.EDITOR.DEFAULT_MODE);
    }

    function calculateStatusBarInfo(text, selectionStart) {
        const lines = text.split("\n");
        const lineCount = lines.length;
        const charCount = text.length;
        const wordCount = text.trim() === "" ? 0 : text.trim().split(/\s+/).filter(Boolean).length;
        let currentLineNum = 0;
        let currentColNum = 0;
        let charCounter = 0;
        for (let i = 0; i < lines.length; i++) {
            const lineLengthWithNewline = lines[i].length + 1;
            if (selectionStart >= charCounter && selectionStart < charCounter + lineLengthWithNewline) {
                currentLineNum = i;
                currentColNum = selectionStart - charCounter;
                break;
            }
            charCounter += lineLengthWithNewline;
        }
        if (selectionStart === text.length && !text.endsWith("\n")) {
            currentLineNum = lines.length - 1;
            currentColNum = lines[lines.length - 1].length;
        } else if (selectionStart === text.length && text.endsWith("\n")) {
            currentLineNum = lines.length - 1;
            currentColNum = 0;
        }
        return {
            lines: lineCount,
            words: wordCount,
            chars: charCount,
            cursor: {
                line: currentLineNum + 1,
                col: currentColNum + 1
            },
        };
    }
    function generateLineNumbersArray(text) {
        const lines = text.split("\n").length;
        return Array.from({ length: lines }, (_, i) => i + 1);
    }
    return { determineMode, calculateStatusBarInfo, generateLineNumbersArray };
})();

const EditorUI = (() => {
    "use strict";
    let elements = {};
    let eventCallbacks = {};
    let previewDebounceTimer = null;
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
        if (elements.textarea && elements.highlighterContent) {
            const whiteSpaceStyle = isWordWrapActive ? "pre-wrap" : "pre";
            elements.textarea.style.whiteSpace = whiteSpaceStyle;
            elements.highlighterContent.style.whiteSpace = whiteSpaceStyle;
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
        const isHtml = mode === EditorAppConfig.EDITOR.MODES.HTML;
        if (elements.formattingToolbar) {
            elements.formattingToolbar.classList.toggle('hidden', !isMarkdown);
        }
        if (elements.htmlFormattingToolbar) {
            elements.htmlFormattingToolbar.classList.toggle('hidden', !isHtml);
        }
    }
    function calculateVisibleRange() {
        if (!elements.textarea) {
            return { startLine: 0, endLine: 25, visibleLines: 25, paddingTop: 0 };
        }
        const lineHeight = Utils.getCharacterDimensions(getComputedStyle(elements.textarea).font).height || 16;
        const scrollTop = elements.textarea.scrollTop;
        const clientHeight = elements.textarea.clientHeight;

        const startLine = Math.floor(scrollTop / lineHeight);
        const visibleLines = Math.ceil(clientHeight / lineHeight);
        const endLine = startLine + visibleLines + 1; // +1 for buffer

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
        if (elements.lineGutter) {
            const numbers = Array.from({ length: end - start }, (_, i) => start + i + 1).join('\n');
            elements.lineGutter.textContent = numbers;
            elements.lineGutter.style.paddingTop = `${paddingTop}px`;
            elements.lineGutter.style.height = `${totalHeight}px`;
        }
    }

    function updateFindBar(findState) {
        if (!elements.findBar) return;
        elements.findBar.classList.toggle('hidden', !findState.isOpen);
        if (!findState.isOpen) return;

        elements.replaceInput.classList.toggle('hidden', !findState.isReplace);
        elements.replaceBtn.classList.toggle('hidden', !findState.isReplace);
        elements.replaceAllBtn.classList.toggle('hidden', !findState.isReplace);

        if (findState.query) {
            elements.findMatchesDisplay.textContent = `${findState.activeIndex + 1} / ${findState.matches.length}`;
        } else {
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
                } else if (mode === EditorAppConfig.EDITOR.MODES.HTML) {
                    const iframe = Utils.createElement("iframe", {
                        style: { width: "100%", height: "100%", border: "none" },
                        sandbox: "allow-scripts"
                    });
                    elements.previewPane.innerHTML = '';
                    elements.previewPane.appendChild(iframe);
                    const iframeDoc = iframe.contentWindow.document;
                    iframeDoc.open();
                    iframeDoc.write(iframeStyles + text);
                    iframeDoc.close();
                }
            } catch (e) {
                elements.previewPane.textContent = `Preview failed: ${e.message}`;
            }
            applyPreviewWordWrap(isWordWrapActive, mode);
        }, EditorAppConfig.EDITOR.DEBOUNCE_DELAY_MS);
    }

    function buildLayout(callbacks) {
        eventCallbacks = callbacks;

        // --- 1. Define All Element Properties First ---
        elements.highlighterContent = Utils.createElement("div", { className: "editor__highlighter-content" });
        elements.highlighter = Utils.createElement("div", { id: "editor-highlighter", className: "editor__highlighter" }, elements.highlighterContent);
        elements.textarea = Utils.createElement("div", {
            id: "editor-textarea",
            className: "editor__input",
            contenteditable: "true", // The key change to make it an editable div
            spellcheck: "false",
            autocapitalize: "none",
            eventListeners: {
                input: eventCallbacks.onInput,
                click: eventCallbacks.onSelectionChange,
                keyup: eventCallbacks.onSelectionChange,
                keydown: eventCallbacks.onKeydown
            }
        });

        // For elements.textareaWrapper:
        elements.textareaWrapper = Utils.createElement("div", {
            id: "editor-textarea-wrapper",
            className: "editor__textarea-wrapper",
            // ADD THE SCROLL LISTENER HERE
            eventListeners: {
                scroll: eventCallbacks.onScroll
            }
        }, elements.highlighter, elements.textarea);
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
        elements.lineGutter = Utils.createElement("div", { id: "editor-line-gutter", className: "editor__gutter" });
        elements.previewPane = Utils.createElement("div", { id: "editor-preview-content", className: "editor__preview-content" });
        elements.previewWrapper = Utils.createElement("div", { id: "editor-preview-wrapper", className: "editor__preview-wrapper" }, elements.previewPane);
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

        const mdButtonDetails = [{ name: 'undoButton', iconHTML: '<svg fill="#000000" height="200px" width="200px" id="Layer_1" viewBox="0 0 24 24" xml:space="preserve"><g id="SVGRepo_bgCarrier" stroke-width="0"></g><g id="SVGRepo_tracerCarrier" stroke-linecap="round" stroke-linejoin="round"></g><g id="SVGRepo_iconCarrier"> <polygon points="20,6 20,5 19,5 19,4 18,4 18,3 8,3 8,4 7,4 7,5 6,5 6,6 5,6 5,5 5,4 3,4 3,10 9,10 9,8 7,8 7,7 8,7 8,6 9,6 9,5 16,5 16,6 17,6 17,7 18,7 18,8 19,8 19,16 18,16 18,17 17,17 17,18 16,18 16,19 9,19 9,18 8,18 8,17 7,17 7,16 6,16 6,15 4,15 4,18 5,18 5,19 6,19 6,20 7,20 7,21 18,21 18,20 19,20 19,19 20,19 20,18 21,18 21,6 "></polygon> </g></svg>', title: 'Undo (Ctrl+Z)', callbackName: 'onUndo' }, { name: 'redoButton', iconHTML: '<svg fill="#000000" height="200px" width="200px" id="Layer_1" viewBox="0 0 24 24" xml:space="preserve"><g id="SVGRepo_bgCarrier" stroke-width="0"></g><g id="SVGRepo_tracerCarrier" stroke-linecap="round" stroke-linejoin="round"></g><g id="SVGRepo_iconCarrier"> <polygon points="4,6 4,5 5,5 5,4 6,4 6,3 16,3 16,4 17,4 17,5 18,5 18,6 19,6 19,5 19,4 21,4 21,10 15,10 15,8 17,8 17,7 16,7 16,6 15,6 15,5 8,5 8,6 7,6 7,7 6,7 6,8 5,8 5,16 6,16 6,17 7,17 7,18 8,18 8,19 15,19 15,18 16,18 16,17 17,17 17,16 18,16 18,15 20,15 20,18 19,18 19,19 18,19 18,20 17,20 17,21 6,21 6,20 5,20 5,19 4,19 4,18 3,18 3,6 "></polygon> </g></svg>', title: 'Redo (Ctrl+Y / Ctrl+Shift+Z)', callbackName: 'onRedo' }, { name: 'boldButton', iconHTML: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="1em" height="1em"><path d="M18,11v-1h-2V4h-1V3H5v18h13v-1h1v-9H18z M17,18h-1v1H7v-7h9v1h1V18z M7,5h6v1h1v3h-1v1H7V5z"></path></svg>', title: 'Bold (Ctrl+B)', callbackName: 'onFormatBold' }, { name: 'italicButton', iconHTML: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="1em" height="1em"><polygon points="8,3 8,5 12,5 12,8 11,8 11,11 10,11 10,14 9,14 9,17 8,17 8,19 4,19 4,21 15,21 15,20 15,19 11,19 11,16 12,16 12,13 13,13 13,10 14,10 14,7 15,7 15,5 19,5 19,3 "></polygon></svg>', title: 'Italic (Ctrl+I)', callbackName: 'onFormatItalic' }, { name: 'linkButton', iconHTML: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" width="1em" height="1em"><path d="M7.05025 1.53553C8.03344 0.552348 9.36692 0 10.7574 0C13.6528 0 16 2.34721 16 5.24264C16 6.63308 15.4477 7.96656 14.4645 8.94975L12.4142 11L11 9.58579L13.0503 7.53553C13.6584 6.92742 14 6.10264 14 5.24264C14 3.45178 12.5482 2 10.7574 2C9.89736 2 9.07258 2.34163 8.46447 2.94975L6.41421 5L5 3.58579L7.05025 1.53553Z"></path> <path d="M7.53553 13.0503L9.58579 11L11 12.4142L8.94975 14.4645C7.96656 15.4477 6.63308 16 5.24264 16C2.34721 16 0 13.6528 0 10.7574C0 9.36693 0.552347 8.03344 1.53553 7.05025L3.58579 5L5 6.41421L2.94975 8.46447C2.34163 9.07258 2 9.89736 2 10.7574C2 12.5482 3.45178 14 5.24264 14C6.10264 14 6.92742 13.6584 7.53553 13.0503Z"></path> <path d="M5.70711 11.7071L11.7071 5.70711L10.2929 4.29289L4.29289 10.2929L5.70711 11.7071Z"></path></svg>', title: 'Insert Link', callbackName: 'onFormatLink' }, { name: 'quoteButton', iconHTML: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="1em" height="1em"><path d="M14,17H17L19,13V7H13V13H16M6,17H9L11,13V7H5V13H8L6,17Z"/></svg>', title: 'Blockquote', callbackName: 'onFormatQuote' }, { name: 'codeButton', iconHTML: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="1em" height="1em"><path d="M9.4,16.6L4.8,12L9.4,7.4L8,6L2,12L8,18L9.4,16.6M14.6,16.6L19.2,12L14.6,7.4L16,6L22,12L16,18L14.6,16.6Z"/></svg>', title: 'Inline Code', callbackName: 'onFormatCode' }, { name: 'codeBlockButton', iconHTML: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" width="1em" height="1em"><path id="Vector" d="M3 6H3.01919M3.01919 6H20.9809M3.01919 6C3 6.31438 3 6.70191 3 7.2002V16.8002C3 17.9203 3 18.4796 3.21799 18.9074C3.40973 19.2837 3.71547 19.5905 4.0918 19.7822C4.51921 20 5.079 20 6.19694 20L17.8031 20C18.921 20 19.48 20 19.9074 19.7822C20.2837 19.5905 20.5905 19.2837 20.7822 18.9074C21 18.48 21 17.921 21 16.8031L21 7.19691C21 6.70021 21 6.31368 20.9809 6M3.01919 6C3.04314 5.60768 3.09697 5.3293 3.21799 5.0918C3.40973 4.71547 3.71547 4.40973 4.0918 4.21799C4.51962 4 5.08009 4 6.2002 4H17.8002C18.9203 4 19.4796 4 19.9074 4.21799C20.2837 4.40973 20.5905 4.71547 20.7822 5.0918C20.9032 5.3293 20.957 5.60768 20.9809 6M20.9809 6H21M14 11L16 13L14 15M10 15L8 13L10 11" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>', title: 'Code Block', callbackName: 'onFormatCodeBlock' }, { name: 'ulButton', iconHTML: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="1em" height="1em"><path d="M7,5H21V7H7V5M7,11H21V13H7V11M7,17H21V19H7V17M4,4.5A1.5,1.5 0 0,1 5.5,6A1.5,1.5 0 0,1 4,7.5A1.5,1.5 0 0,1 2.5,6A1.5,1.5 0 0,1 4,4.5M4,10.5A1.5,1.5 0 0,1 5.5,12A1.5,1.5 0 0,1 4,13.5A1.5,1.5 0 0,1 2.5,12A1.5,1.5 0 0,1 4,10.5M4,16.5A1.5,1.5 0 0,1 5.5,18A1.5,1.5 0 0,1 4,19.5A1.5,1.5 0 0,1 2.5,18A1.5,1.5 0 0,1 4,16.5Z"/></svg>', title: 'Unordered List', callbackName: 'onFormatUl' }, { name: 'olButton', iconHTML: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="1em" height="1em"><path d="M2 17h2v.5H3v1h1v.5H2v1h3v-4H2v1zm1-9h1V4H2v1h1v3zm-1 3h1.8L2 13.1v.9h3v-1H3.2L5 10.9V10H2v1zm5-6v2h14V5H7zm0 14h14v-2H7v2zm0-6h14v-2H7v2z"/></svg>', title: 'Ordered List', callbackName: 'onFormatOl' }];
        mdButtonDetails.forEach(detail => {
            elements[detail.name] = Utils.createElement("button", {
                className: "editor-btn editor-btn--format",
                innerHTML: detail.iconHTML.replace(/#3eca02/g, 'currentColor'),
                title: detail.title,
                eventListeners: { click: eventCallbacks[detail.callbackName] }
            });
            elements.formattingToolbar.appendChild(elements[detail.name]);
        });

        const htmlButtonDetails = [ { name: 'h1Button', text: 'H1', title: 'Header 1', callbackName: 'onFormatH1' }, { name: 'pButton', text: 'P', title: 'Paragraph', callbackName: 'onFormatP' }, { name: 'aButton', text: 'A', title: 'Link', callbackName: 'onFormatA' }, { name: 'bButton', text: 'B', title: 'Bold', callbackName: 'onFormatB' }, { name: 'iButton', text: 'I', title: 'Italic', callbackName: 'onFormatI_html' } ];
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

        elements.mainArea = Utils.createElement("div", { id: "editor-main-area", className: "editor__main-area" },
            elements.lineGutter,
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
            elements.lineGutter.classList.toggle("hidden", !visible);
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

        // Helper to traverse text nodes and find the correct character offsets
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
                    if (findNode(node.childNodes[i])) return true; // Stop if both found
                }
            }
            return startNode && endNode;
        }

        findNode(editorInput);

        // Fallback to end of content if nodes aren't found (e.g., empty div)
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
            // Synchronize scroll positions as a fallback for full updates
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

        if (viewToggleButton) {
            viewToggleButton.classList.toggle('hidden', !isPreviewable);
        }
        if (exportButton) {
            exportButton.classList.toggle('hidden', !isPreviewable);
        }

        editorPane.classList.add('hidden');
        previewPane.classList.add('hidden');

        if (!isPreviewable) {
            editorPane.classList.remove('hidden');
            editorPane.style.width = '100%';
            return;
        }

        switch (viewMode) {
            case EditorAppConfig.EDITOR.VIEW_MODES.EDIT_ONLY:
                editorPane.classList.remove('hidden');
                editorPane.style.width = '100%';
                if (viewToggleButton) viewToggleButton.textContent = "Preview";
                break;
            case EditorAppConfig.EDITOR.VIEW_MODES.PREVIEW_ONLY:
                previewPane.classList.remove('hidden');
                previewPane.style.width = '100%';
                if (viewToggleButton) viewToggleButton.textContent = "Split";
                break;
            case EditorAppConfig.EDITOR.VIEW_MODES.SPLIT:
            default:
                editorPane.classList.remove('hidden');
                previewPane.classList.remove('hidden');
                editorPane.style.width = '50%';
                previewPane.style.width = '50%';
                if (viewToggleButton) viewToggleButton.textContent = "Editor";
                break;
        }
        applyPreviewWordWrap(isWordWrapActive, fileMode);
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