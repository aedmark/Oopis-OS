import { EditorState } from '@codemirror/state';
import { EditorView, keymap } from '@codemirror/view';
import { defaultKeymap } from '@codemirror/commands';
import { javascript } from '@codemirror/lang-javascript';
import { html } from '@codemirror/lang-html';
import { json } from '@codemirror/lang-json';
import { markdown, markdownLanguage } from './lang-markdown.js'; // Assuming you have this file locally
import { StreamLanguage } from '@codemirror/language';
import { shell, basic } from '@codemirror/legacy-modes/mode';

const EditorManager = (() => {
    "use strict";

    let isActiveState = false, currentFilePath = null, currentFileMode = EditorAppConfig.EDITOR.DEFAULT_MODE,
        currentViewMode = EditorAppConfig.EDITOR.VIEW_MODES.SPLIT, isWordWrapActive = EditorAppConfig.EDITOR.WORD_WRAP_DEFAULT_ENABLED,
        originalContent = "", isDirty = false, undoStack = [], redoStack = [],
        saveUndoStateTimeout = null, onSaveCallback = null, _exitPromiseResolve = null;
    codeMirrorView = null;
    const MAX_UNDO_STATES = 100;

    let findState = {
        isOpen: false,
        isReplace: false,
        query: '',
        matches: [],
        activeIndex: -1,
    };

    let findDebounceTimer = null; // Debounce timer for find input

    function _loadWordWrapSetting() {
        const savedSetting = StorageManager.loadItem(EditorAppConfig.STORAGE_KEYS.EDITOR_WORD_WRAP_ENABLED, "Editor word wrap setting");
        isWordWrapActive = savedSetting !== null ? savedSetting : EditorAppConfig.EDITOR.WORD_WRAP_DEFAULT_ENABLED;
    }
    function _saveWordWrapSetting() {
        StorageManager.saveItem(EditorAppConfig.STORAGE_KEYS.EDITOR_WORD_WRAP_ENABLED, isWordWrapActive, "Editor word wrap setting");
    }
    function _toggleWordWrap() {
        if (!isActiveState) return;
        isWordWrapActive = !isWordWrapActive;
        _saveWordWrapSetting();
        EditorUI.applyTextareaWordWrap(isWordWrapActive);
        EditorUI.applyPreviewWordWrap(isWordWrapActive, currentFileMode);
        if (currentFileMode === EditorAppConfig.EDITOR.MODES.HTML) {
            EditorUI.renderPreview(EditorUI.getTextareaContent(), currentFileMode, isWordWrapActive);
        }
        EditorUI.updateWordWrapButtonText(isWordWrapActive);
        EditorUI.setEditorFocus();
        EditorUI.setGutterVisibility(!isWordWrapActive);
    }
    function _updateFullEditorUI() {
        if (!isActiveState) return;
        const textContent = EditorUI.getTextareaContent();
        isDirty = textContent !== _getPatchedContent(); // Updated isDirty check
        EditorUI.updateFilenameDisplay(currentFilePath, isDirty);
        EditorUI.updateLineNumbers(textContent);
        const selection = EditorUI.getTextareaSelection();
        EditorUI.updateStatusBar(textContent, selection.start);
        if (currentFileMode === EditorAppConfig.EDITOR.MODES.MARKDOWN || currentFileMode === EditorAppConfig.EDITOR.MODES.HTML) {
            EditorUI.renderPreview(textContent, currentFileMode, isWordWrapActive);
        }
        EditorUI.renderHighlights(textContent, findState.matches, findState.activeIndex);
        EditorUI.syncScrolls();
    }
    function _handleEditorInput() {
        if (!isActiveState) return;
        const currentContent = EditorUI.getTextareaContent();
        if (saveUndoStateTimeout) clearTimeout(saveUndoStateTimeout);
        saveUndoStateTimeout = setTimeout(() => {
            _saveUndoState(currentContent);
            saveUndoStateTimeout = null;
        }, EditorAppConfig.EDITOR.DEBOUNCE_DELAY_MS + 50);
        isDirty = currentContent !== _getPatchedContent();
        _updateFullEditorUI();
        _debouncedFind();
    }
    function _handleEditorScroll() { if (isActiveState) EditorUI.syncScrolls(); }
    function _handleEditorSelectionChange() {
        if (!isActiveState) return;
        const textContent = EditorUI.getTextareaContent();
        const selection = EditorUI.getTextareaSelection();
        EditorUI.updateStatusBar(textContent, selection.start);
    }
    async function exportPreviewAsHtml() {
        if (!isActiveState) return;
        const baseName = (currentFilePath || "untitled").split('/').pop().split('.').slice(0, -1).join('.') || "export";
        let blob;
        let fileName;

        if (currentFileMode === EditorAppConfig.EDITOR.MODES.TEXT) {
            const rawContent = EditorUI.getTextareaContent();
            blob = new Blob([rawContent], { type: 'text/plain;charset=utf-8' });
            fileName = `${baseName}.txt`;
        } else { // Handles 'markdown' and 'html'
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

        await OutputManager.appendToOutput(`Successfully exported content as '${fileName}'. Check your browser downloads.`, { typeClass: 'text-success' });
    }

    // --- REFACTORED UNDO/REDO LOGIC ---

    function _getPatchedContent() {
        if (undoStack.length === 0) return "";
        let content = undoStack[0];
        for (let i = 1; i < undoStack.length; i++) {
            content = PatchUtils.applyPatch(content, undoStack[i]);
        }
        return content;
    }

    function _saveUndoState(currentContent) {
        const lastKnownState = _getPatchedContent();
        const patch = PatchUtils.createPatch(lastKnownState, currentContent);

        if (patch) {
            undoStack.push(patch);
            if (undoStack.length > MAX_UNDO_STATES + 1) { // +1 for original content
                // To keep memory usage down, we'd need to occasionally re-base
                // For now, just cap the stack
                undoStack.shift();
                undoStack[0] = _getPatchedContent(); // Re-base
                const rebasePatches = undoStack.slice(1);
                undoStack = [undoStack[0], ...rebasePatches];
            }
            redoStack = [];
            _updateUndoRedoButtonStates();
        }
    }

    function _performUndo() {
        if (undoStack.length <= 1) return;
        const patchToUndo = undoStack.pop();
        redoStack.push(patchToUndo);

        const currentContent = EditorUI.getTextareaContent();
        const previousContent = PatchUtils.applyInverse(currentContent, patchToUndo);

        EditorUI.setTextareaContent(previousContent);
        isDirty = (previousContent !== originalContent); // Simple check is okay here because we reverted to a known state
        _updateFullEditorUI();
        _updateUndoRedoButtonStates();
        EditorUI.setTextareaSelection(previousContent.length, previousContent.length);
        EditorUI.setEditorFocus();
    }

    function _performRedo() {
        if (redoStack.length === 0) return;
        const patchToRedo = redoStack.pop();
        undoStack.push(patchToRedo);

        const currentContent = EditorUI.getTextareaContent();
        const nextContent = PatchUtils.applyPatch(currentContent, patchToRedo);

        EditorUI.setTextareaContent(nextContent);
        isDirty = (nextContent !== originalContent);
        _updateFullEditorUI();
        _updateUndoRedoButtonStates();
        EditorUI.setTextareaSelection(nextContent.length, nextContent.length);
        EditorUI.setEditorFocus();
    }

    // --- END REFACTORED LOGIC ---

    function _updateUndoRedoButtonStates() {
        if (EditorUI.elements.undoButton) EditorUI.elements.undoButton.disabled = undoStack.length <= 1;
        if (EditorUI.elements.redoButton) EditorUI.elements.redoButton.disabled = redoStack.length === 0;
    }
    async function _applyTextManipulation(type) {
        if (!isActiveState || !EditorUI.elements.textarea) return;

        const textarea = EditorUI.elements.textarea;
        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const text = textarea.value;
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
        EditorUI.renderHighlights(EditorUI.getTextareaContent(), [], -1); // Clear highlights
        EditorUI.setEditorFocus();
    }

    function _debouncedFind() {
        if (findDebounceTimer) clearTimeout(findDebounceTimer);
        findDebounceTimer = setTimeout(() => {
            _find();
            findDebounceTimer = null;
        }, EditorAppConfig.EDITOR.FIND_DEBOUNCE_DELAY_MS);
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
        EditorUI.renderHighlights(EditorUI.getTextareaContent(), findState.matches, findState.activeIndex);
        _scrollToMatch(findState.activeIndex, false); // FIX: Do not focus textarea on find
    }

    function _goToNextMatch() {
        if (findState.matches.length === 0) return;
        findState.activeIndex = (findState.activeIndex + 1) % findState.matches.length;
        EditorUI.updateFindBar(findState);
        EditorUI.renderHighlights(EditorUI.getTextareaContent(), findState.matches, findState.activeIndex);
        _scrollToMatch(findState.activeIndex, true); // FIX: Focus on explicit navigation
    }

    function _goToPrevMatch() {
        if (findState.matches.length === 0) return;
        findState.activeIndex = (findState.activeIndex - 1 + findState.matches.length) % findState.matches.length;
        EditorUI.updateFindBar(findState);
        EditorUI.renderHighlights(EditorUI.getTextareaContent(), findState.matches, findState.activeIndex);
        _scrollToMatch(findState.activeIndex, true); // FIX: Focus on explicit navigation
    }

    function _scrollToMatch(index, shouldFocusTextarea = true) { // FIX: Added parameter
        if (index === -1) return;
        const match = findState.matches[index];
        const textarea = EditorUI.elements.textarea;

        if (shouldFocusTextarea) { // FIX: Conditional focus
            textarea.focus();
        }

        textarea.setSelectionRange(match.index, match.index + match[0].length);
        const textToMatch = textarea.value.substring(0, match.index);
        const lineBreaks = (textToMatch.match(/\n/g) || []).length;
        textarea.scrollTop = lineBreaks * 16;
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
    function enter(filePath, content, callback = null) {
        if (isActiveState) {
            void OutputManager.appendToOutput("Editor already active.", { typeClass: 'text-info' });
            return Promise.resolve();
        }
        return new Promise(resolve => {
            _exitPromiseResolve = resolve;
            _loadWordWrapSetting();
            isActiveState = true;
            currentFilePath = filePath;
            currentFileMode = EditorUtils.determineMode(filePath);
            originalContent = content;
            isDirty = false;
            onSaveCallback = callback;
            undoStack = [content]; // Start with the full original content
            redoStack = [];
            findState = { isOpen: false, isReplace: false, query: '', matches: [], activeIndex: -1 };

            const isPreviewable = currentFileMode === EditorAppConfig.EDITOR.MODES.MARKDOWN || currentFileMode === EditorAppConfig.EDITOR.MODES.HTML;
            document.addEventListener('keydown', handleKeyDown);
            const editorCallbacks = {
                onInput: _handleEditorInput.bind(this),
                onScroll: _handleEditorScroll.bind(this),
                onSelectionChange: _handleEditorSelectionChange.bind(this),
                onViewToggle: _toggleViewModeHandler.bind(this),
                onExportPreview: exportPreviewAsHtml.bind(this),
                onWordWrapToggle: _toggleWordWrap.bind(this),
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
                onFindInputChange: _debouncedFind.bind(this),
                onFindNext: _goToNextMatch.bind(this),
                onFindPrev: _goToPrevMatch.bind(this),
                onReplace: _replace.bind(this),
                onReplaceAll: _replaceAll.bind(this),
                onFindBarKeyDown: (e) => {
                    if (e.key === 'Enter' && e.shiftKey) { e.preventDefault(); _goToPrevMatch(); }
                    else if (e.key === 'Enter') { e.preventDefault(); _goToNextMatch(); }
                    else if (e.key === 'Escape') { e.preventDefault(); _closeFindBar(); }
                }
            };
            let languageExtension;
            const mode = EditorUtils.determineMode(filePath);
            switch (mode) {
                case 'markdown':
                    languageExtension = markdown({ base: markdownLanguage });
                    break;
                case 'html':
                    languageExtension = html();
                    break;
                case 'javascript':
                    languageExtension = javascript();
                    break;
                case 'json':
                    languageExtension = json();
                    break;
                case 'shell':
                    languageExtension = StreamLanguage.define(shell);
                    break;
                case 'basic':
                    languageExtension = StreamLanguage.define(basic);
                    break;
                default:
                    languageExtension = [];
            }
            const editorElement = EditorUI.buildLayout(editorCallbacks);
            AppLayerManager.show(editorElement);
            const startState = EditorState.create({
                doc: content,
                extensions: [
                    EditorView.lineWrapping,
                    keymap.of(defaultKeymap),
                    languageExtension
                ]
            });
            codeMirrorView = new EditorView({
                state: startState,
                parent: elements.textareaWrapper
            });
            EditorUI.setGutterVisibility(!isWordWrapActive);
            currentViewMode = EditorAppConfig.EDITOR.VIEW_MODES.EDIT_ONLY;
            EditorUI.setViewMode(currentViewMode, currentFileMode, isPreviewable, isWordWrapActive);
            EditorUI.applyTextareaWordWrap(isWordWrapActive);
            EditorUI.updateWordWrapButtonText(isWordWrapActive);
            EditorUI.setTextareaContent(content);
            EditorUI.setTextareaSelection(0, 0);
            EditorUI._updateFormattingToolbarVisibility(currentFileMode);
            _updateFullEditorUI();
            EditorUI.setEditorFocus();
            _updateUndoRedoButtonStates();
        });
    }
    async function _performExitActions() {
        document.removeEventListener('keydown', handleKeyDown);
        AppLayerManager.hide();
        EditorUI.destroyLayout();
        isActiveState = false; currentFilePath = null; currentFileMode = EditorAppConfig.EDITOR.DEFAULT_MODE;
        isDirty = false; originalContent = ""; onSaveCallback = null; undoStack = []; redoStack = []; saveUndoStateTimeout = null;
    }
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
                    confirmText: "Discard Changes", cancelText: "Keep Editing",
                    onConfirm: () => resolve(true), onCancel: () => resolve(false)
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
            if (_exitPromiseResolve) { _exitPromiseResolve(); _exitPromiseResolve = null; }
            return true;
        } else {
            EditorUI.setEditorFocus();
            return false;
        }
    }
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
                case "s": event.preventDefault(); await exit(true); break;
                case "o": event.preventDefault(); await exit(false); break;
                case "p": event.preventDefault(); _toggleViewModeHandler(); break;
                case "f": event.preventDefault(); _openFindBar(false); break;
                case "h": event.preventDefault(); _openFindBar(true); break;
                case "b": if (currentFileMode !== 'text') { event.preventDefault(); _applyTextManipulation('bold'); } break;
                case "i": if (!event.shiftKey && currentFileMode !== 'text') { event.preventDefault(); _applyTextManipulation('italic'); } break;
                case "z": event.preventDefault(); event.shiftKey ? _performRedo() : _performUndo(); break;
                case "y": event.preventDefault(); _performRedo(); break;
            }
        }
        setTimeout(_handleEditorSelectionChange, 0);
    }

    return { isActive: () => isActiveState, enter, exit };
})();