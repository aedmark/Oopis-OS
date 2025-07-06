/**
 * @file Manages the OopisOS full-screen text editor application.
 * This file contains the core logic for the editor, including state management,
 * event handling, text manipulation, and interaction with other OS managers.
 * @module EditorManager
 * @author Andrew Edmark, Gemini, and The Architect
 */

/**
 * Configuration object specifically for the Editor application.
 * Placing it here ensures it's defined before the EditorManager module uses it.
 */
const EditorAppConfig = {
    EDITOR: {
        DEFAULT_MODE: 'text',
        MODES: {
            TEXT: 'text',
            MARKDOWN: 'markdown',
            HTML: 'html',
            JAVASCRIPT: 'javascript',
            SHELL: 'shell',
            CSS: 'css',
        },
        VIEW_MODES: {
            EDIT_ONLY: 'edit_only',
            PREVIEW_ONLY: 'preview_only',
            SPLIT: 'split',
        },
        WORD_WRAP_DEFAULT_ENABLED: false,
        TAB_REPLACEMENT: '  ', // 2 spaces
        DEBOUNCE_DELAY_MS: 150,
        MAX_UNDO_STATES: 100,
    },
    STORAGE_KEYS: {
        EDITOR_WORD_WRAP_ENABLED: 'oopisOsEditorWordWrapEnabled',
        EDITOR_HIGHLIGHT_ENABLED: 'oopisOsEditorHighlightEnabled',
    },
};

const EditorUtils = {
    determineMode: (filePath) => {
        const extension = Utils.getFileExtension(filePath);
        switch (extension) {
            case 'md': return EditorAppConfig.EDITOR.MODES.MARKDOWN;
            case 'html': return EditorAppConfig.EDITOR.MODES.HTML;
            case 'js': return EditorAppConfig.EDITOR.MODES.JAVASCRIPT;
            case 'css': return EditorAppConfig.EDITOR.MODES.CSS;
            case 'sh': return EditorAppConfig.EDITOR.MODES.SHELL;
            default: return EditorAppConfig.EDITOR.MODES.TEXT;
        }
    },
    calculateStatusBarInfo: (text, selectionStart) => {
        const lines = text.split('\n');
        const totalLines = lines.length;
        const words = text.trim().length > 0 ? text.trim().split(/\s+/).length : 0;
        const chars = text.length;

        let lineNum = 1;
        let colNum = 1;
        let charCount = 0;
        for (let i = 0; i < lines.length; i++) {
            const lineLength = lines[i].length + 1; // +1 for the newline char
            if (charCount + lineLength > selectionStart) {
                lineNum = i + 1;
                colNum = selectionStart - charCount + 1;
                break;
            }
            charCount += lineLength;
        }
        return { lines: totalLines, words, chars, cursor: { line: lineNum, col: colNum } };
    }
};


/**
 * The EditorManager module, encapsulating all logic for the text editor.
 */
const EditorManager = (() => {
    "use strict";

    // --- Module State ---
    let isHighlightingActive = true;
    let isActiveState = false,
        currentFilePath = null,
        currentFileMode = EditorAppConfig.EDITOR.DEFAULT_MODE,
        currentViewMode = EditorAppConfig.EDITOR.VIEW_MODES.SPLIT,
        isWordWrapActive = EditorAppConfig.EDITOR.WORD_WRAP_DEFAULT_ENABLED,
        originalContent = "",
        isDirty = false,
        undoStack = [],
        redoStack = [],
        saveUndoStateTimeout = null,
        onSaveCallback = null,
        _exitPromiseResolve = null;

    let findState = {
        isOpen: false,
        isReplace: false,
        query: '',
        matches: [],
        activeIndex: -1,
    };

    let highlightDebounceTimer = null;
    let scrollDebounceTimer = null;


    // --- Private Functions ---

    /**
     * Handles the virtual rendering of the editor's content on scroll.
     * Only renders the visible portion of the text to maintain performance.
     */
    function _handleEditorScroll() {
        if (!isActiveState) return;

        requestAnimationFrame(() => {
            if (!EditorUI.elements.textarea) return;

            const { startLine, endLine, paddingTop } = EditorUI.calculateVisibleRange();
            const lineCount = SyntaxHighlighter.getLineCount();
            const lineHeight = (Utils.getCharacterDimensions(getComputedStyle(EditorUI.elements.textarea).font).height || 16);
            const totalHeight = lineCount * lineHeight;

            const visibleHtml = isHighlightingActive ?
                SyntaxHighlighter.getRenderedLinesHTML(startLine, Math.min(endLine, lineCount), findState.matches, findState.activeIndex) :
                EditorUI.getTextareaContent().split('\n').slice(startLine, Math.min(endLine, lineCount)).map(line => line.replace(/[&<>"']/g, match => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[match])).join('\n');

            EditorUI.renderVisibleContent(visibleHtml, paddingTop, totalHeight);
            EditorUI.updateVisibleLineNumbers(startLine, Math.min(endLine, lineCount), paddingTop, totalHeight);
            _syncScrolls();
        });
    }

    /**
     * Loads the user's word wrap preference from storage.
     */
    function _loadWordWrapSetting() {
        const savedSetting = StorageManager.loadItem(EditorAppConfig.STORAGE_KEYS.EDITOR_WORD_WRAP_ENABLED, "Editor word wrap setting");
        isWordWrapActive = savedSetting !== null ? savedSetting : EditorAppConfig.EDITOR.WORD_WRAP_DEFAULT_ENABLED;
    }

    /**
     * Saves the user's current word wrap preference.
     */
    function _saveWordWrapSetting() {
        StorageManager.saveItem(EditorAppConfig.STORAGE_KEYS.EDITOR_WORD_WRAP_ENABLED, isWordWrapActive, "Editor word wrap setting");
    }

    /**
     * Toggles the word wrap setting on and off.
     */
    function _toggleWordWrap() {
        if (!isActiveState) return;
        isWordWrapActive = !isWordWrapActive;
        _saveWordWrapSetting();

        const isPreviewable = currentFileMode === EditorAppConfig.EDITOR.MODES.MARKDOWN || currentFileMode === EditorAppConfig.EDITOR.MODES.HTML;

        EditorUI.setViewMode(currentViewMode, currentFileMode, isPreviewable, isWordWrapActive);
        EditorUI.applyTextareaWordWrap(isWordWrapActive);
        EditorUI.updateWordWrapButtonText(isWordWrapActive);
        EditorUI.setEditorFocus();
    }

    /**
     * Loads the user's syntax highlighting preference from storage.
     */
    function _loadHighlightingSetting() {
        const savedSetting = StorageManager.loadItem(EditorAppConfig.STORAGE_KEYS.EDITOR_HIGHLIGHT_ENABLED, "Editor highlight setting");
        isHighlightingActive = savedSetting !== null ? savedSetting : true;
    }

    /**
     * Saves the user's current syntax highlighting preference.
     */
    function _saveHighlightingSetting() {
        StorageManager.saveItem(EditorAppConfig.STORAGE_KEYS.EDITOR_HIGHLIGHT_ENABLED, isHighlightingActive, "Editor highlight setting");
    }

    /**
     * Toggles syntax highlighting on and off.
     */
    function _toggleHighlighting() {
        if (!isActiveState) return;
        isHighlightingActive = !isHighlightingActive;
        _saveHighlightingSetting();
        EditorUI.updateHighlightButtonText(isHighlightingActive);
        _updateHighlighting();
        EditorUI.setEditorFocus();
    }

    /**
     * Updates the highlighted HTML overlay based on the current text and mode.
     */
    function _updateHighlighting() {
        if (!isActiveState) return;
        const text = EditorUI.getTextareaContent();
        const selection = EditorUI.getTextareaSelection();
        let highlightedHtml;

        if (isHighlightingActive && typeof SyntaxHighlighter !== 'undefined') {
            const mode = EditorUtils.determineMode(currentFilePath);
            highlightedHtml = SyntaxHighlighter.highlight(text, mode, findState.matches, findState.activeIndex);
        } else {
            const escapeHtml = (textToEscape) => {
                return textToEscape.replace(/[&<>"']/g, (match) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[match]);
            }
            highlightedHtml = escapeHtml(text);
        }

        EditorUI.renderHighlights(highlightedHtml);
        EditorUI.setTextareaSelection(selection.start, selection.end);
    }

    /**
     * Synchronizes the width of the textarea and highlighter when word wrap is off.
     */
    function _synchronizeWidths() {
        if (!isWordWrapActive && EditorUI.elements.textarea && EditorUI.elements.highlighter) {
            const trueWidth = EditorUI.elements.textarea.scrollWidth;
            EditorUI.elements.highlighter.style.minWidth = `${trueWidth}px`;
            EditorUI.elements.textarea.style.minWidth = `${trueWidth}px`;
        } else if (EditorUI.elements.textarea && EditorUI.elements.highlighter) {
            EditorUI.elements.highlighter.style.minWidth = '100%';
            EditorUI.elements.textarea.style.minWidth = '100%';
        }
    }

    /**
     * Updates UI elements like the status bar and filename display.
     */
    function _updateAndRedraw() {
        if (!isActiveState) return;

        const textContent = EditorUI.getTextareaContent();
        isDirty = textContent !== originalContent;
        EditorUI.updateFilenameDisplay(currentFilePath, isDirty);
        const selection = EditorUI.getTextareaSelection();
        EditorUI.updateStatusBar(textContent, selection.start);

        if (currentFileMode === EditorAppConfig.EDITOR.MODES.MARKDOWN || currentFileMode === EditorAppConfig.EDITOR.MODES.HTML) {
            EditorUI.renderPreview(textContent, currentFileMode, isWordWrapActive);
        }
    }

    /**
     * Handles the editor's main input event, triggering UI updates and undo state saves.
     */
    function _handleEditorInput() {
        if (!isActiveState) return;
        _updateAndRedraw();

        if (highlightDebounceTimer) clearTimeout(highlightDebounceTimer);
        highlightDebounceTimer = setTimeout(() => {
            SyntaxHighlighter.tokenizeDocument(EditorUI.getTextareaContent(), currentFileMode);
            _synchronizeWidths();
            _handleEditorScroll();
        }, 10);

        if (saveUndoStateTimeout) clearTimeout(saveUndoStateTimeout);
        saveUndoStateTimeout = setTimeout(() => {
            _saveUndoState(EditorUI.getTextareaContent());
            saveUndoStateTimeout = null;
        }, EditorAppConfig.EDITOR.DEBOUNCE_DELAY_MS + 50);
    }

    /**
     * Overrides the default Tab key behavior to insert spaces.
     * @param {KeyboardEvent} event
     */
    function handleEditorKeyDown(event) {
        if (!isActiveState) return;
        if (event.key === "Tab") {
            event.preventDefault();
            document.execCommand('insertText', false, EditorAppConfig.EDITOR.TAB_REPLACEMENT);
        }
    }

    /**
     * Synchronizes the scroll position of the textarea, highlighter, and gutter.
     */
    function _syncScrolls() {
        if (!isActiveState) return;
        if (scrollDebounceTimer) return; // Prevent re-entry if already scheduled

        scrollDebounceTimer = requestAnimationFrame(() => {
            const wrapper = EditorUI.elements.textareaWrapper;
            const highlighter = EditorUI.elements.highlighter;
            const gutter = EditorUI.elements.lineGutter;

            if (!wrapper || !highlighter || !gutter) {
                scrollDebounceTimer = null;
                return;
            }

            const scrollTop = wrapper.scrollTop;
            const scrollLeft = wrapper.scrollLeft;

            // --- FIX: Sync gutter and highlighter scroll positions ---
            gutter.scrollTop = scrollTop;
            highlighter.scrollTop = scrollTop;
            highlighter.scrollLeft = scrollLeft;
            // The actual textarea is inside the grid, so it scrolls with its container
            // We only need to ensure the highlighter matches its horizontal scroll.
            EditorUI.elements.textarea.scrollLeft = scrollLeft;
            // --- END FIX ---

            scrollDebounceTimer = null;
        });
    }

    /**
     * Handles selection changes to update the status bar.
     */
    function _handleEditorSelectionChange() {
        if (!isActiveState) return;
        _updateAndRedraw();
    }

    /**
     * Exports the current preview pane as an HTML file.
     */
    async function exportPreviewAsHtml() {
        if (!isActiveState) return;
        const baseName = (currentFilePath || "untitled").split('/').pop().split('.').slice(0, -1).join('.') || "export";
        let blob;
        let fileName;

        if (currentFileMode === EditorAppConfig.EDITOR.MODES.TEXT) {
            const rawContent = EditorUI.getTextareaContent();
            blob = new Blob([rawContent], { type: 'text/plain;charset=utf-8' });
            fileName = `${baseName}.txt`;
        } else {
            const renderedContent = EditorUI.getPreviewPaneHTML();
            const fullHtml = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>Exported: ${baseName}</title>
    ${EditorUI.iframeStyles}
</head>
<body>
    ${renderedContent}
</body>
</html>`;
            blob = new Blob([fullHtml], { type: 'text/html;charset=utf-8' });
            fileName = `${baseName}.html`;
        }

        const url = URL.createObjectURL(blob);
        const a = Utils.createElement('a', { href: url, download: fileName });
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        await OutputManager.appendToOutput(`Successfully exported content as '${fileName}'.`, { typeClass: 'text-success' });
    }

    /**
     * Saves the current editor state to the undo stack using a patch-based approach.
     */
    function _saveUndoState(currentContent) {
        const lastKnownState = (undoStack.length > 0) ? PatchUtils.applyPatch(undoStack[0], undoStack.slice(1).join('')) : "";
        const patch = PatchUtils.createPatch(lastKnownState, currentContent);

        if (patch) {
            undoStack.push(patch);
            if (undoStack.length > EditorAppConfig.EDITOR.MAX_UNDO_STATES + 1) {
                undoStack.shift();
            }
            redoStack = [];
            _updateUndoRedoButtonStates();
        }
    }

    /**
     * Reverts the editor to the previous state in the undo stack.
     */
    function _performUndo() {
        if (undoStack.length <= 1) return;
        const patchToUndo = undoStack.pop();
        redoStack.push(patchToUndo);

        const currentContent = EditorUI.getTextareaContent();
        const previousContent = PatchUtils.applyInverse(currentContent, patchToUndo);

        EditorUI.setTextareaContent(previousContent);
        _handleEditorInput();
        _updateUndoRedoButtonStates();
        EditorUI.setTextareaSelection(previousContent.length, previousContent.length);
        EditorUI.setEditorFocus();
    }

    /**
     * Re-applies a state from the redo stack.
     */
    function _performRedo() {
        if (redoStack.length === 0) return;
        const patchToRedo = redoStack.pop();
        undoStack.push(patchToRedo);

        const currentContent = EditorUI.getTextareaContent();
        const nextContent = PatchUtils.applyPatch(currentContent, patchToRedo);

        EditorUI.setTextareaContent(nextContent);
        _handleEditorInput();
        _updateUndoRedoButtonStates();
        EditorUI.setTextareaSelection(nextContent.length, nextContent.length);
        EditorUI.setEditorFocus();
    }

    /**
     * Updates the enabled/disabled state of the undo and redo buttons.
     */
    function _updateUndoRedoButtonStates() {
        if (EditorUI.elements.undoButton) EditorUI.elements.undoButton.disabled = undoStack.length <= 1;
        if (EditorUI.elements.redoButton) EditorUI.elements.redoButton.disabled = redoStack.length === 0;
    }

    /**
     * Applies markdown or HTML formatting to the selected text.
     */
    async function _applyTextManipulation(type) {
        if (!isActiveState || !EditorUI.elements.textarea) return;
        const textarea = EditorUI.elements.textarea;
        const selection = EditorUI.getTextareaSelection();
        const start = selection.start;
        const end = selection.end;
        const text = EditorUI.getTextareaContent();
        const selectedText = text.substring(start, end);
        let manipulatedText = '';
        let newStart = start;
        let newEnd = end;

        const manipulate = async () => {
            switch (type) {
                case 'bold':
                    manipulatedText = `**${selectedText}**`;
                    newStart = start + 2;
                    newEnd = end + 2;
                    break;
                case 'italic':
                    manipulatedText = `*${selectedText}*`;
                    newStart = start + 1;
                    newEnd = end + 1;
                    break;
                case 'code':
                    manipulatedText = `\`${selectedText}\``;
                    newStart = start + 1;
                    newEnd = end + 1;
                    break;
                case 'quote':
                    const lines = selectedText.split('\n');
                    manipulatedText = lines.map(line => `> ${line}`).join('\n');
                    newStart = start;
                    newEnd = start + manipulatedText.length;
                    break;
                case 'codeblock':
                    manipulatedText = `\`\`\`\n${selectedText}\n\`\`\``;
                    newStart = start + 3;
                    newEnd = start + 3 + selectedText.length;
                    break;
                case 'ul':
                    const ulLines = selectedText.split('\n');
                    manipulatedText = ulLines.map(line => `- ${line}`).join('\n');
                    newStart = start;
                    newEnd = start + manipulatedText.length;
                    break;
                case 'ol':
                    const olLines = selectedText.split('\n');
                    manipulatedText = olLines.map((line, index) => `${index + 1}. ${line}`).join('\n');
                    newStart = start;
                    newEnd = start + manipulatedText.length;
                    break;
                case 'h1':
                    manipulatedText = `<h1>${selectedText}</h1>`;
                    newStart = start + 4;
                    newEnd = end + 4;
                    break;
                case 'p':
                    manipulatedText = `<p>${selectedText}</p>`;
                    newStart = start + 3;
                    newEnd = end + 3;
                    break;
                case 'b':
                    manipulatedText = `<b>${selectedText}</b>`;
                    newStart = start + 3;
                    newEnd = end + 3;
                    break;
                case 'i_html':
                    manipulatedText = `<i>${selectedText}</i>`;
                    newStart = start + 3;
                    newEnd = end + 3;
                    break;
                case 'a':
                    const url_html = await new Promise(resolve => {
                        ModalManager.request({
                            context: 'graphical-input',
                            messageLines: ["Enter URL for the link:"],
                            placeholder: "https://example.com",
                            onConfirm: (value) => resolve(value.trim() || null),
                            onCancel: () => resolve(null)
                        });
                    });
                    if (url_html) {
                        manipulatedText = `<a href="${url_html}">${selectedText}</a>`;
                        newStart = start;
                        newEnd = start + manipulatedText.length;
                    } else {
                        manipulatedText = selectedText;
                    }
                    break;
                case 'link':
                    const url = await new Promise(resolve => {
                        ModalManager.request({
                            context: 'graphical-input',
                            messageLines: ["Enter URL for the link:"],
                            placeholder: "https://example.com",
                            confirmText: "Insert",
                            cancelText: "Cancel",
                            onConfirm: (value) => resolve(value.trim() || null),
                            onCancel: () => resolve(null)
                        });
                    });

                    if (url) {
                        manipulatedText = `[${selectedText}](${url})`;
                        newStart = start + 1;
                        newEnd = start + 1 + selectedText.length;
                    } else {
                        manipulatedText = selectedText;
                    }
                    break;
                default:
                    manipulatedText = selectedText;
            }

            if (manipulatedText !== selectedText) {
                const newText = text.substring(0, start) + manipulatedText + text.substring(end);
                EditorUI.setTextareaContent(newText);
                _handleEditorInput();
                EditorUI.setEditorFocus();
                EditorUI.setTextareaSelection(newStart, newEnd);
            } else {
                EditorUI.setEditorFocus();
                EditorUI.setTextareaSelection(start, end);
            }
        };

        await manipulate();
    }

    // --- Find and Replace Functions ---
    function _openFindBar(isReplace = false) {
        findState.isOpen = true;
        findState.isReplace = isReplace;
        EditorUI.updateFindBar(findState);
        EditorUI.elements.findInput.focus();
        EditorUI.elements.findInput.select();
        _find();
    }

    function _closeFindBar() {
        findState.isOpen = false;
        findState.matches = [];
        findState.activeIndex = -1;
        EditorUI.updateFindBar(findState);
        _updateHighlighting();
        EditorUI.setEditorFocus();
    }

    function _find() {
        if (!findState.isOpen) return;
        const query = EditorUI.getFindQuery();
        findState.query = query;
        if (!query) {
            findState.matches = [];
            findState.activeIndex = -1;
        } else {
            const text = EditorUI.getTextareaContent();
            const regex = new RegExp(query.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&'), 'gi');
            findState.matches = [...text.matchAll(regex)];
            findState.activeIndex = findState.matches.length > 0 ? 0 : -1;
        }
        EditorUI.updateFindBar(findState);
        _updateHighlighting();
        _scrollToMatch(findState.activeIndex, false);
    }

    function _goToNextMatch() {
        if (findState.matches.length === 0) return;
        findState.activeIndex = (findState.activeIndex + 1) % findState.matches.length;
        EditorUI.updateFindBar(findState);
        _updateHighlighting();
        _scrollToMatch(findState.activeIndex, true);
    }

    function _goToPrevMatch() {
        if (findState.matches.length === 0) return;
        findState.activeIndex = (findState.activeIndex - 1 + findState.matches.length) % findState.matches.length;
        EditorUI.updateFindBar(findState);
        _updateHighlighting();
        _scrollToMatch(findState.activeIndex, true);
    }

    function _scrollToMatch(index, shouldFocusTextarea = true) {
        if (index === -1) return;
        const match = findState.matches[index];
        const textarea = EditorUI.elements.textarea;

        if (shouldFocusTextarea) {
            textarea.focus();
        }

        EditorUI.setTextareaSelection(match.index, match.index + match[0].length);
        const textToMatch = textarea.value.substring(0, match.index);
        const lineBreaks = (textToMatch.match(/\n/g) || []).length;
        textarea.scrollTop = lineBreaks * (parseInt(getComputedStyle(textarea).lineHeight, 10) || 16);
    }

    function _replace() {
        if (findState.activeIndex === -1 || !findState.isReplace) return;
        const match = findState.matches[findState.activeIndex];
        const replaceText = EditorUI.getReplaceQuery();
        const originalText = EditorUI.getTextareaContent();
        const newText = originalText.substring(0, match.index) + replaceText + originalText.substring(match.index + match[0].length);
        EditorUI.setTextareaContent(newText);
        _handleEditorInput();
    }

    function _replaceAll() {
        if (findState.matches.length === 0 || !findState.isReplace) return;
        const replaceText = EditorUI.getReplaceQuery();
        const regex = new RegExp(findState.query.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&'), 'gi');
        const newText = EditorUI.getTextareaContent().replace(regex, replaceText);
        EditorUI.setTextareaContent(newText);
        _handleEditorInput();
    }

    /**
     * Toggles the view mode between editor, preview, and split screen.
     */
    function _toggleViewModeHandler() {
        if (!isActiveState) return;
        const isPreviewable = currentFileMode === EditorAppConfig.EDITOR.MODES.MARKDOWN || currentFileMode === EditorAppConfig.EDITOR.MODES.HTML;
        if (!isPreviewable) return;
        if (currentViewMode === EditorAppConfig.EDITOR.VIEW_MODES.SPLIT) currentViewMode = EditorAppConfig.EDITOR.VIEW_MODES.EDIT_ONLY;
        else if (currentViewMode === EditorAppConfig.EDITOR.VIEW_MODES.EDIT_ONLY) currentViewMode = EditorAppConfig.EDITOR.VIEW_MODES.PREVIEW_ONLY;
        else currentViewMode = EditorAppConfig.EDITOR.VIEW_MODES.SPLIT;
        EditorUI.setViewMode(currentViewMode, currentFileMode, isPreviewable, isWordWrapActive);
        EditorUI.setEditorFocus();
    }

    /**
     * Finishes exit procedures after confirmation.
     */
    async function _performExitActions() {
        document.removeEventListener('keydown', handleKeyDown);
        AppLayerManager.hide();
        EditorUI.destroyLayout();
        isActiveState = false;
        currentFilePath = null;
        currentFileMode = EditorAppConfig.EDITOR.DEFAULT_MODE;
        isDirty = false;
        originalContent = "";
        onSaveCallback = null;
        undoStack = [];
        redoStack = [];
        saveUndoStateTimeout = null;
    }

    /**
     * Exits the editor, prompting to save if there are unsaved changes.
     */
    async function exit(saveChanges = false) {
        let proceedToExit = true;
        let saveSuccess = true;
        const currentUser = UserManager.getCurrentUser().name;
        let terminalMessage = null;
        let terminalMessageClass = null;

        if (!saveChanges && isDirty) {
            const userConfirmedDiscard = await new Promise(resolve => {
                ModalManager.request({
                    context: 'graphical',
                    messageLines: [Config.MESSAGES.EDITOR_DISCARD_CONFIRM],
                    confirmText: "Discard Changes",
                    cancelText: "Keep Editing",
                    onConfirm: () => resolve(true),
                    onCancel: () => resolve(false)
                });
            });
            if (userConfirmedDiscard) {
                terminalMessage = `Editor closed for '${currentFilePath || "Untitled"}' without saving. Changes discarded.`;
                terminalMessageClass = 'text-warning';
            } else {
                await OutputManager.appendToOutput("Exit cancelled. Continue editing.", { typeClass: 'text-info' });
                EditorUI.setEditorFocus();
                proceedToExit = false;
            }
        } else if (!saveChanges && !isDirty) {
            terminalMessage = `Editor closed for '${currentFilePath || "Untitled"}'. No changes were made.`;
            terminalMessageClass = 'text-subtle';
        }

        if (!proceedToExit) return false;

        if (saveChanges && currentFilePath) {
            const newContent = EditorUI.getTextareaContent();
            const existingNode = FileSystemManager.getNodeByPath(currentFilePath);
            const primaryGroup = UserManager.getPrimaryGroupForUser(currentUser);
            if (!primaryGroup) {
                await OutputManager.appendToOutput(`Critical Error: Could not determine primary group for '${currentUser}'. Cannot save file.`, { typeClass: 'text-error' });
                saveSuccess = false;
            } else {
                const saveResult = await FileSystemManager.createOrUpdateFile(currentFilePath, newContent, { currentUser, primaryGroup, existingNode });
                if (!saveResult.success) {
                    await OutputManager.appendToOutput(`Error saving '${currentFilePath}': ${saveResult.error}`, { typeClass: 'text-error' });
                    saveSuccess = false;
                }
            }
            if (saveSuccess) {
                if (!(await FileSystemManager.save())) {
                    await OutputManager.appendToOutput(`Error saving file system changes for '${currentFilePath}'. Changes might be lost.`, { typeClass: 'text-error' });
                    saveSuccess = false;
                } else {
                    if (onSaveCallback) await onSaveCallback(currentFilePath);
                    terminalMessage = `File '${currentFilePath}' saved. Editor closed.`;
                    terminalMessageClass = 'text-success';
                    originalContent = newContent;
                    isDirty = false;
                    EditorUI.updateFilenameDisplay(currentFilePath, isDirty);
                }
            }
        }

        if (proceedToExit && saveSuccess) {
            if (terminalMessage) await OutputManager.appendToOutput(terminalMessage, { typeClass: terminalMessageClass });
            await _performExitActions();
            if (_exitPromiseResolve) {
                _exitPromiseResolve();
                _exitPromiseResolve = null;
            }
            return true;
        } else {
            EditorUI.setEditorFocus();
            return false;
        }
    }

    /**
     * Main entry point to launch the editor.
     */
    function enter(filePath, content, callback = null) {
        if (isActiveState) {
            void OutputManager.appendToOutput("Editor already active.", { typeClass: 'text-info' });
            return Promise.resolve();
        }
        return new Promise(resolve => {
            _exitPromiseResolve = resolve;
            _loadWordWrapSetting();
            _loadHighlightingSetting();
            isActiveState = true;
            currentFilePath = filePath;
            currentFileMode = EditorUtils.determineMode(filePath);
            originalContent = content;
            isDirty = false;
            onSaveCallback = callback;
            undoStack = [content];
            redoStack = [];
            findState = { isOpen: false, isReplace: false, query: '', matches: [], activeIndex: -1 };

            document.addEventListener('keydown', handleKeyDown);

            const editorCallbacks = {
                onInput: _handleEditorInput.bind(this),
                onScroll: _handleEditorScroll.bind(this),
                onSelectionChange: _handleEditorSelectionChange.bind(this),
                onViewToggle: _toggleViewModeHandler.bind(this),
                onExportPreview: exportPreviewAsHtml.bind(this),
                onWordWrapToggle: _toggleWordWrap.bind(this),
                onHighlightToggle: _toggleHighlighting.bind(this),
                onExitButtonClick: () => exit(false),
                onFormatBold: () => _applyTextManipulation('bold'),
                onFormatItalic: () => _applyTextManipulation('italic'),
                onFormatLink: () => _applyTextManipulation('link'),
                onFormatQuote: () => _applyTextManipulation('quote'),
                onFormatCode: () => _applyTextManipulation('code'),
                onFormatCodeBlock: () => _applyTextManipulation('codeblock'),
                onFormatUl: () => _applyTextManipulation('ul'),
                onFormatOl: () => _applyTextManipulation('ol'),
                onFormatH1: () => _applyTextManipulation('h1'),
                onFormatP: () => _applyTextManipulation('p'),
                onFormatA: () => _applyTextManipulation('a'),
                onFormatB: () => _applyTextManipulation('b'),
                onFormatI_html: () => _applyTextManipulation('i_html'),
                onUndo: _performUndo.bind(this),
                onRedo: _performRedo.bind(this),
                onFindBarClose: _closeFindBar.bind(this),
                onFindInputChange: _find.bind(this),
                onFindNext: _goToNextMatch.bind(this),
                onFindPrev: _goToPrevMatch.bind(this),
                onReplace: _replace.bind(this),
                onReplaceAll: _replaceAll.bind(this),
                onFindBarKeyDown: (e) => {
                    if (e.key === 'Enter' && e.shiftKey) { e.preventDefault(); _goToPrevMatch(); }
                    else if (e.key === 'Enter') { e.preventDefault(); _goToNextMatch(); }
                    else if (e.key === 'Escape') { e.preventDefault(); _closeFindBar(); }
                },
                onKeydown: handleEditorKeyDown
            };
            const editorElement = EditorUI.buildLayout(editorCallbacks);
            AppLayerManager.show(editorElement);

            setTimeout(() => {
                if (!isActiveState) return;

                const isPreviewable = currentFileMode === EditorAppConfig.EDITOR.MODES.MARKDOWN || currentFileMode === EditorAppConfig.EDITOR.MODES.HTML;

                currentFileMode = EditorUtils.determineMode(filePath);
                EditorUI.updateWordWrapButtonText(isWordWrapActive);
                EditorUI.updateHighlightButtonText(isHighlightingActive);
                EditorUI._updateFormattingToolbarVisibility(currentFileMode);
                EditorUI.setTextareaContent(content);
                SyntaxHighlighter.tokenizeDocument(content, currentFileMode);
                _handleEditorScroll();
                EditorUI.setEditorFocus();
                EditorUI.setGutterVisibility(!isWordWrapActive);
                currentViewMode = EditorAppConfig.EDITOR.VIEW_MODES.EDIT_ONLY;
                EditorUI.setViewMode(currentViewMode, currentFileMode, isPreviewable, isWordWrapActive);
                EditorUI.applyTextareaWordWrap(isWordWrapActive);
                EditorUI.setTextareaSelection(0, 0);
                EditorUI._updateFormattingToolbarVisibility(currentFileMode);
                _updateAndRedraw();
                EditorUI.setEditorFocus();
                _updateUndoRedoButtonStates();
                _updateHighlighting();
                _synchronizeWidths();
            }, 0);
        });
    }

    /**
     * Global key handler for editor shortcuts.
     */
    async function handleKeyDown(event) {
        if (!isActiveState) return;
        if (findState.isOpen && event.key === 'Escape') {
            event.preventDefault();
            _closeFindBar();
            return;
        }
        if (event.key === "Tab" && document.activeElement === EditorUI.elements.textarea) {
            event.preventDefault();
            const selection = EditorUI.getTextareaSelection();
            const content = EditorUI.getTextareaContent();
            EditorUI.setTextareaContent(content.substring(0, selection.start) + EditorAppConfig.EDITOR.TAB_REPLACEMENT + content.substring(selection.end));
            EditorUI.setTextareaSelection(selection.start + EditorAppConfig.EDITOR.TAB_REPLACEMENT.length, selection.start + EditorAppConfig.EDITOR.TAB_REPLACEMENT.length);
            _handleEditorInput();
            return;
        }
        if (event.ctrlKey || event.metaKey) {
            switch (event.key.toLowerCase()) {
                case "s":
                    event.preventDefault();
                    await exit(true);
                    break;
                case "o":
                    event.preventDefault();
                    await exit(false);
                    break;
                case "p":
                    event.preventDefault();
                    _toggleViewModeHandler();
                    break;
                case "f":
                    event.preventDefault();
                    _openFindBar(false);
                    break;
                case "h":
                    event.preventDefault();
                    _openFindBar(true);
                    break;
                case "b":
                    if (currentFileMode !== 'text') {
                        event.preventDefault();
                        _applyTextManipulation('bold');
                    }
                    break;
                case "i":
                    if (!event.shiftKey && currentFileMode !== 'text') {
                        event.preventDefault();
                        _applyTextManipulation('italic');
                    }
                    break;
                case "z":
                    event.preventDefault();
                    event.shiftKey ? _performRedo() : _performUndo();
                    break;
                case "y":
                    event.preventDefault();
                    _performRedo();
                    break;
            }
        }
        setTimeout(_handleEditorSelectionChange, 0);
    }

    // --- Public Interface ---
    return {
        isActive: () => isActiveState,
        enter,
        exit,
    };
})();