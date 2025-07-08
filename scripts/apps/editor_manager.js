const EditorManager = (() => {
    "use strict";
    let isActiveState = false, currentFilePath = null, currentFileMode = EditorAppConfig.EDITOR.DEFAULT_MODE,
        currentViewMode = EditorAppConfig.EDITOR.VIEW_MODES.SPLIT, isWordWrapActive = EditorAppConfig.EDITOR.WORD_WRAP_DEFAULT_ENABLED,
        originalContent = "", isDirty = false, undoStack = [], redoStack = [],
        onSaveCallback = null, _exitPromiseResolve = null;
    const MAX_UNDO_STATES = 100;

    // --- Command Pattern for Undo/Redo ---
    class Command {
        execute() { throw new Error("Execute method not implemented."); }
        unexecute() { throw new Error("Unexecute method not implemented."); }
    }

    class InsertTextCommand extends Command {
        constructor(text, position, editorUI) {
            super();
            this.text = text;
            this.position = position;
            this.editorUI = editorUI;
        }

        execute() {
            const content = this.editorUI.getTextareaContent();
            const newContent = content.slice(0, this.position) + this.text + content.slice(this.position);
            this.editorUI.setTextareaContent(newContent);
            this.editorUI.setTextareaSelection(this.position + this.text.length, this.position + this.text.length);
        }

        unexecute() {
            const content = this.editorUI.getTextareaContent();
            const newContent = content.slice(0, this.position) + content.slice(this.position + this.text.length);
            this.editorUI.setTextareaContent(newContent);
            this.editorUI.setTextareaSelection(this.position, this.position);
        }
    }

    class DeleteTextCommand extends Command {
        constructor(text, position, editorUI) {
            super();
            this.text = text;
            this.position = position;
            this.editorUI = editorUI;
        }

        execute() {
            const content = this.editorUI.getTextareaContent();
            const newContent = content.slice(0, this.position) + content.slice(this.position + this.text.length);
            this.editorUI.setTextareaContent(newContent);
            this.editorUI.setTextareaSelection(this.position, this.position);
        }

        unexecute() {
            const content = this.editorUI.getTextareaContent();
            const newContent = content.slice(0, this.position) + this.text + content.slice(this.position);
            this.editorUI.setTextareaContent(newContent);
            this.editorUI.setTextareaSelection(this.position + this.text.length, this.position + this.text.length);
        }
    }

    function _executeCommand(command) {
        command.execute();
        undoStack.push(command);
        redoStack = [];
        if (undoStack.length > MAX_UNDO_STATES) {
            undoStack.shift();
        }
        _updateUndoRedoButtonStates();
        _handleEditorInput();
    }


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
        isDirty = textContent !== originalContent;
        EditorUI.updateFilenameDisplay(currentFilePath, isDirty);
        EditorUI.updateLineNumbers(textContent);
        const selection = EditorUI.getTextareaSelection();
        EditorUI.updateStatusBar(textContent, selection.start);
        if (currentFileMode === EditorAppConfig.EDITOR.MODES.MARKDOWN || currentFileMode === EditorAppConfig.EDITOR.MODES.HTML) {
            EditorUI.renderPreview(textContent, currentFileMode, isWordWrapActive);
        }
        EditorUI.syncScrolls();
    }
    function _handleEditorInput() {
        if (!isActiveState) return;
        isDirty = EditorUI.getTextareaContent() !== originalContent;
        _updateFullEditorUI();
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

    function _performUndo() {
        if (undoStack.length === 0) return;
        const command = undoStack.pop();
        command.unexecute();
        redoStack.push(command);
        _updateUndoRedoButtonStates();
        _handleEditorInput();
        EditorUI.setEditorFocus();
    }

    function _performRedo() {
        if (redoStack.length === 0) return;
        const command = redoStack.pop();
        command.execute();
        undoStack.push(command);
        _updateUndoRedoButtonStates();
        _handleEditorInput();
        EditorUI.setEditorFocus();
    }

    function _updateUndoRedoButtonStates() {
        if (EditorUI.elements.undoButton) EditorUI.elements.undoButton.disabled = undoStack.length === 0;
        if (EditorUI.elements.redoButton) EditorUI.elements.redoButton.disabled = redoStack.length === 0;
    }
    async function _applyTextManipulation(type) {
        if (!isActiveState || !EditorUI.elements.textarea) return;

        const textarea = EditorUI.elements.textarea;
        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const selectedText = EditorUI.getTextareaContent().substring(start, end);

        let prefix = '';
        let suffix = '';
        let requiresInput = false;

        switch (type) {
            case 'bold': prefix = '**'; suffix = '**'; break;
            case 'italic': prefix = '*'; suffix = '*'; break;
            case 'code': prefix = '`'; suffix = '`'; break;
            case 'quote': prefix = '> '; suffix = ''; break;
            case 'codeblock': prefix = '```\n'; suffix = '\n```'; break;
            case 'ul': prefix = '- '; suffix = ''; break;
            case 'ol': prefix = '1. '; suffix = ''; break;
            case 'h1': prefix = '<h1>'; suffix = '</h1>'; break;
            case 'p': prefix = '<p>'; suffix = '</p>'; break;
            case 'b': prefix = '<b>'; suffix = '</b>'; break;
            case 'i_html': prefix = '<i>'; suffix = '</i>'; break;
            case 'link':
            case 'a':
                requiresInput = true;
                break;
            default:
                return;
        }

        if (requiresInput) {
            const url = await new Promise(resolve => {
                ModalManager.request({
                    context: 'graphical-input',
                    messageLines: ["Enter URL:"],
                    placeholder: "https://example.com",
                    onConfirm: value => resolve(value.trim() || null),
                    onCancel: () => resolve(null)
                });
            });

            if (url) {
                if (type === 'link') {
                    prefix = `[${selectedText}](`;
                    suffix = `)`;
                } else { // 'a'
                    prefix = `<a href="${url}">`;
                    suffix = `</a>`;
                }
                _executeCommand(new InsertTextCommand(prefix + url + suffix, start, EditorUI));
            }
        } else {
            let replacementText = prefix + selectedText + suffix;
            if (type === 'quote' || type === 'ul' || type === 'ol') {
                const lines = selectedText.split('\n');
                replacementText = lines.map(line => prefix + line).join('\n');
            }
            _executeCommand(new DeleteTextCommand(selectedText, start, EditorUI));
            _executeCommand(new InsertTextCommand(replacementText, start, EditorUI));
        }
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
            undoStack = [];
            redoStack = [];

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
            };
            const editorElement = EditorUI.buildLayout(editorCallbacks);
            AppLayerManager.show(editorElement);
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
        isDirty = false; originalContent = ""; onSaveCallback = null; undoStack = []; redoStack = [];
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

        const textarea = EditorUI.elements.textarea;
        if (event.key === "Tab" && document.activeElement === textarea) {
            event.preventDefault();
            const selection = EditorUI.getTextareaSelection();
            _executeCommand(new InsertTextCommand(EditorAppConfig.EDITOR.TAB_REPLACEMENT, selection.start, EditorUI));
            return;
        }
        if (event.ctrlKey || event.metaKey) {
            switch (event.key.toLowerCase()) {
                case "s": event.preventDefault(); await exit(true); break;
                case "o": event.preventDefault(); await exit(false); break;
                case "p": event.preventDefault(); _toggleViewModeHandler(); break;
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