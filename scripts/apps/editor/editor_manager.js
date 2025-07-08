const EditorManager = (() => {
    "use strict";
    let isActiveState = false,
        currentFilePath = null,
        currentFileMode = EditorAppConfig.EDITOR.DEFAULT_MODE,
        currentViewMode = EditorAppConfig.EDITOR.VIEW_MODES.SPLIT,
        isWordWrapActive = EditorAppConfig.EDITOR.WORD_WRAP_DEFAULT_ENABLED,
        originalContent = "",
        isDirty = false,
        undoStack = [],
        redoStack = [],
        onSaveCallback = null,
        _exitPromiseResolve = null;

    let selectionAnchor = 0; // The non-moving end of a selection
    let selectionHead = 0; // The moving end of a selection (the cursor)

    const MAX_UNDO_STATES = 100;

    let findState = {
        isOpen: false,
        isReplace: false,
        query: '',
        matches: [],
        activeIndex: -1,
    };

    let findDebounceTimer = null;

    const commandExecutor = {
        execute: (command) => {
            command.execute(EditorManager);
            undoStack.push(command);
            if (undoStack.length > MAX_UNDO_STATES) undoStack.shift();
            redoStack = [];
            _updateUndoRedoButtonStates();
            _updateFullEditorUI();
        },
        undo: () => {
            if (undoStack.length > 0) {
                const command = undoStack.pop();
                command.unexecute(EditorManager);
                redoStack.push(command);
                _updateUndoRedoButtonStates();
                _updateFullEditorUI();
            }
        },
        redo: () => {
            if (redoStack.length > 0) {
                const command = redoStack.pop();
                command.execute(EditorManager);
                undoStack.push(command);
                _updateUndoRedoButtonStates();
                _updateFullEditorUI();
            }
        }
    };

    function _getSelectionRange() {
        const start = Math.min(selectionAnchor, selectionHead);
        const end = Math.max(selectionAnchor, selectionHead);
        return { start, end };
    }

    function _getSelectedText() {
        const { start, end } = _getSelectionRange();
        if (start === end) return '';
        // Use the public getContent method to ensure we have the latest text
        return EditorManager.getContent().substring(start, end);
    }

    function _handleCopy(event) {
        if (!isActiveState) return;
        event.preventDefault(); // Take control from the browser
        const selectedText = _getSelectedText();
        if (selectedText) {
            // Use the event's clipboardData to set the data
            event.clipboardData.setData('text/plain', selectedText);
        }
    }

    function _handleCut(event) {
        if (!isActiveState) return;
        event.preventDefault(); // Take control
        const { start, end } = _getSelectionRange();
        if (start === end) return; // Nothing to cut

        const selectedText = _getSelectedText();
        event.clipboardData.setData('text/plain', selectedText);

        // Use a command to delete the text, making it undoable
        const command = new DeleteRangeCommand(start, end);
        commandExecutor.execute(command);
    }

    function _handlePaste(event) {
        if (!isActiveState) return;
        event.preventDefault(); // Take control
        const pastedText = event.clipboardData.getData('text/plain');
        if (pastedText) {
            const { start, end } = _getSelectionRange();
            // Use a command to replace the selection, making it undoable
            const command = new ReplaceRangeCommand(start, end, pastedText);
            commandExecutor.execute(command);
        }
    }

    function _loadWordWrapSetting() {
        const savedSetting = StorageManager.loadItem(EditorAppConfig.STORAGE_KEYS.EDITOR_WORD_WRAP_ENABLED);
        isWordWrapActive = savedSetting !== null ? savedSetting : EditorAppConfig.EDITOR.WORD_WRAP_DEFAULT_ENABLED;
    }

    function _saveWordWrapSetting() {
        StorageManager.saveItem(EditorAppConfig.STORAGE_KEYS.EDITOR_WORD_WRAP_ENABLED, isWordWrapActive);
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
        EditorUI.setGutterVisibility(!isWordWrapActive);
    }

    function _updateFullEditorUI() {
        if (!isActiveState) return;
        const textContent = EditorUI.getTextareaContent();
        isDirty = textContent !== originalContent;
        EditorUI.updateFilenameDisplay(currentFilePath, isDirty);
        EditorUI.updateStatusBar(textContent, selectionHead);
        if (typeof EditorUI.updateCursor === 'function') {
            EditorUI.updateCursor(selectionAnchor, selectionHead);
        }
        if (currentFileMode === EditorAppConfig.EDITOR.MODES.MARKDOWN || currentFileMode === EditorAppConfig.EDITOR.MODES.HTML) {
            EditorUI.renderPreview(textContent, currentFileMode, isWordWrapActive);
        }
        // MODIFIED: Pass matches and active index to the UI module
        EditorUI.renderHighlights(findState.matches, findState.activeIndex);
    }

    function setSelection(head, anchor) {
        const textLength = EditorUI.getTextareaContent().length;
        selectionHead = Math.max(0, Math.min(head, textLength));
        selectionAnchor = anchor === undefined ? selectionHead : Math.max(0, Math.min(anchor, textLength));
        _updateFullEditorUI();
    }

    function _performUndo() { commandExecutor.undo(); }
    function _performRedo() { commandExecutor.redo(); }

    function _updateUndoRedoButtonStates() {
        if (EditorUI.elements.undoButton) EditorUI.elements.undoButton.disabled = undoStack.length === 0;
        if (EditorUI.elements.redoButton) EditorUI.elements.redoButton.disabled = redoStack.length === 0;
    }

    async function _applyTextManipulation(type) {
        if (!isActiveState) return;

        // Use the current selection state from the manager
        let start = Math.min(selectionAnchor, selectionHead);
        let end = Math.max(selectionAnchor, selectionHead);

        // If no text is selected, we do nothing for now.
        // This could be enhanced later to insert formatting characters (e.g., ****)
        // and place the cursor in the middle.
        if (start === end) return;

        const text = EditorUI.getTextareaContent();
        const selectedText = text.substring(start, end);

        let manipulatedText = '';
        // These variables track the new selection after the text is inserted.
        let newSelectionStart = start;
        let newSelectionEnd = end;

        // This is the full switch statement from the original editor.js
        switch (type) {
            case 'bold':
                manipulatedText = `**${selectedText}**`;
                // After wrapping, the new selection should be the original text
                newSelectionStart = start + 2;
                newSelectionEnd = end + 2;
                break;
            case 'italic':
                manipulatedText = `*${selectedText}*`;
                newSelectionStart = start + 1;
                newSelectionEnd = end + 1;
                break;
            case 'code':
                manipulatedText = `\`${selectedText}\``;
                newSelectionStart = start + 1;
                newSelectionEnd = end + 1;
                break;
            case 'quote':
                const lines = selectedText.split('\n');
                manipulatedText = lines.map(line => `> ${line}`).join('\n');
                newSelectionStart = start;
                newSelectionEnd = start + manipulatedText.length;
                break;
            case 'codeblock':
                manipulatedText = `\`\`\`\n${selectedText}\n\`\`\``;
                newSelectionStart = start + 3;
                newSelectionEnd = start + 3 + selectedText.length;
                break;
            case 'ul':
                const ulLines = selectedText.split('\n');
                manipulatedText = ulLines.map(line => `- ${line}`).join('\n');
                newSelectionStart = start;
                newSelectionEnd = start + manipulatedText.length;
                break;
            case 'ol':
                const olLines = selectedText.split('\n');
                manipulatedText = olLines.map((line, index) => `${index + 1}. ${line}`).join('\n');
                newSelectionStart = start;
                newSelectionEnd = start + manipulatedText.length;
                break;
            case 'h1':
                manipulatedText = `<h1>${selectedText}</h1>`;
                newSelectionStart = start + 4;
                newSelectionEnd = end + 4;
                break;
            case 'p':
                manipulatedText = `<p>${selectedText}</p>`;
                newSelectionStart = start + 3;
                newSelectionEnd = end + 3;
                break;
            case 'b':
                manipulatedText = `<b>${selectedText}</b>`;
                newSelectionStart = start + 3;
                newSelectionEnd = end + 3;
                break;
            case 'i_html':
                manipulatedText = `<i>${selectedText}</i>`;
                newSelectionStart = start + 3;
                newSelectionEnd = end + 3;
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
                    newSelectionStart = start;
                    newSelectionEnd = start + manipulatedText.length;
                } else {
                    manipulatedText = selectedText; // No change if cancelled
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
                    newSelectionStart = start + 1;
                    newSelectionEnd = start + 1 + selectedText.length;
                } else {
                    manipulatedText = selectedText; // No change if cancelled
                }
                break;
            default:
                manipulatedText = selectedText;
        }

        // If the text was changed, execute a command to replace the range.
        // This integrates the action with our undo/redo system.
        if (manipulatedText !== selectedText) {
            const command = new ReplaceRangeCommand(start, end, manipulatedText);
            commandExecutor.execute(command);

            // After executing the command, update the selection to what it should be.
            // We set a brief timeout to allow the command execution and UI update to complete.
            setTimeout(() => setSelection(newSelectionEnd, newSelectionStart), 0);
        }
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
        EditorUI.renderHighlights([], -1);
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
        EditorUI.renderHighlights(findState.matches, findState.activeIndex > -1 ? findState.matches[findState.activeIndex].index : -1);
        _scrollToMatch(findState.activeIndex);
    }

    function _goToNextMatch() {
        if (findState.matches.length === 0) return;
        findState.activeIndex = (findState.activeIndex + 1) % findState.matches.length;
        EditorUI.updateFindBar(findState);
        EditorUI.renderHighlights(findState.matches, findState.matches[findState.activeIndex].index);
        _scrollToMatch(findState.activeIndex, true);
    }

    function _goToPrevMatch() {
        if (findState.matches.length === 0) return;
        findState.activeIndex = (findState.activeIndex - 1 + findState.matches.length) % findState.matches.length;
        EditorUI.updateFindBar(findState);
        EditorUI.renderHighlights(findState.matches, findState.matches[findState.activeIndex].index);
        _scrollToMatch(findState.activeIndex, true);
    }

    function _scrollToMatch(index) {
        if (index === -1) return;
        const match = findState.matches[index];
        const { line } = EditorUI.indexToLineCol(match.index);
        const scroller = EditorUI.elements.virtualScroller;
        const targetScrollTop = line * 16; // Using hardcoded line height for now

        // Only scroll if the match is outside the current view
        if (targetScrollTop < scroller.scrollTop || targetScrollTop > scroller.scrollTop + scroller.clientHeight) {
            scroller.scrollTop = targetScrollTop;
        }
    }

    function _replace() {
        if (findState.activeIndex === -1 || !findState.isReplace) return;
        const match = findState.matches[findState.activeIndex];
        const replaceText = EditorUI.getReplaceQuery();
        const command = new ReplaceRangeCommand(match.index, match.index + match[0].length, replaceText);
        commandExecutor.execute(command);
        _find();
    }

    function _replaceAll() {
        if (findState.matches.length === 0 || !findState.isReplace) return;
        const replaceText = EditorUI.getReplaceQuery();
        const originalText = EditorUI.getTextareaContent();
        const command = new ReplaceAllCommand(findState.query, replaceText, originalText);
        commandExecutor.execute(command);
    }

    function _toggleViewModeHandler() {
        if (!isActiveState) return;
        const isPreviewable = currentFileMode === EditorAppConfig.EDITOR.MODES.MARKDOWN || currentFileMode === EditorAppConfig.EDITOR.MODES.HTML;
        if (!isPreviewable) return;
        if (currentViewMode === EditorAppConfig.EDITOR.VIEW_MODES.SPLIT) {
            currentViewMode = EditorAppConfig.EDITOR.VIEW_MODES.EDIT_ONLY;
        } else if (currentViewMode === EditorAppConfig.EDITOR.VIEW_MODES.EDIT_ONLY) {
            currentViewMode = EditorAppConfig.EDITOR.VIEW_MODES.PREVIEW_ONLY;
        } else {
            currentViewMode = EditorAppConfig.EDITOR.VIEW_MODES.SPLIT;
        }
        EditorUI.setViewMode(currentViewMode, currentFileMode, isPreviewable, isWordWrapActive);
        EditorUI.setEditorFocus();
    }

    function enter(filePath, content, callback = null) {
        if (isActiveState) return Promise.resolve();

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

            const editorCallbacks = {
                onInput: (e) => {
                    if (e.data) {
                        const command = new ReplaceRangeCommand(selectionAnchor, selectionHead, e.data);
                        commandExecutor.execute(command);
                    }
                },
                onSelectionStart: (startIndex) => {
                    setSelection(startIndex, startIndex);
                },
                onSelectionDrag: (moveIndex) => {
                    // Keep the anchor the same, but move the head
                    setSelection(moveIndex, selectionAnchor);
                },
                onKeyDown: handleKeyDown,
                onViewToggle: _toggleViewModeHandler,
                onWordWrapToggle: _toggleWordWrap,
                onExitButtonClick: () => exit(false),
                onSave: () => exit(true),
                onUndo: _performUndo,
                onRedo: _performRedo,
                onFindBarClose: _closeFindBar,
                onFindInputChange: _debouncedFind,
                onFindNext: _goToNextMatch,
                onFindPrev: _goToPrevMatch,
                onReplace: _replace,
                onReplaceAll: _replaceAll,

                onFindBarKeyDown: (e) => {
                    if (e.key === 'Enter' && e.shiftKey) { e.preventDefault(); _goToPrevMatch(); }
                    else if (e.key === 'Enter') { e.preventDefault(); _goToNextMatch(); }
                    else if (e.key === 'Escape') { e.preventDefault(); _closeFindBar(); }
                },

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

                onCopy: _handleCopy,
                onCut: _handleCut,
                onPaste: _handlePaste
            };

            const editorElement = EditorUI.buildLayout(editorCallbacks);
            AppLayerManager.show(editorElement);

            if (typeof EditorUI.initializeDimensions === 'function') {
                EditorUI.initializeDimensions();
            }

            EditorUI.setGutterVisibility(!isWordWrapActive);
            currentViewMode = EditorAppConfig.EDITOR.VIEW_MODES.EDIT_ONLY;
            EditorUI.setViewMode(currentViewMode, currentFileMode, true, isWordWrapActive);
            EditorUI.applyTextareaWordWrap(isWordWrapActive);
            EditorUI.updateWordWrapButtonText(isWordWrapActive);
            EditorUI.setTextareaContent(content);
            setSelection(0);
            EditorUI.setEditorFocus();
            if (typeof EditorUI._updateFormattingToolbarVisibility === 'function') {
                EditorUI._updateFormattingToolbarVisibility(currentFileMode);
            }
            _updateFullEditorUI();
            _updateUndoRedoButtonStates();
        });
    }

    async function exit(saveChanges = false) {
        let proceedToExit = true;
        if (isDirty && !saveChanges) {
            const confirmed = await new Promise(r => ModalManager.request({
                context: 'graphical',
                messageLines: ["You have unsaved changes. Exit and discard them?"],
                onConfirm: () => r(true), onCancel: () => r(false)
            }));
            if(!confirmed) proceedToExit = false;
        }

        if(proceedToExit) {
            if(saveChanges) {
                await _performSave(currentFilePath);
            }
            AppLayerManager.hide();
            EditorUI.destroyLayout();
            isActiveState = false;
            if (_exitPromiseResolve) _exitPromiseResolve();
        }
    }

    async function _performSave(filePath) {
        if (!filePath) return false;
        const contentToSave = EditorUI.getTextareaContent();
        const currentUser = UserManager.getCurrentUser().name;
        const primaryGroup = UserManager.getPrimaryGroupForUser(currentUser);
        const saveResult = await FileSystemManager.createOrUpdateFile(filePath, contentToSave, { currentUser, primaryGroup });
        if (saveResult.success && await FileSystemManager.save()) {
            originalContent = contentToSave;
            isDirty = false;
            _updateFullEditorUI();
            return true;
        }
        return false;
    }

    /**
     * **MODIFIED**
     * Implemented arrow key navigation and integrated commands.
     */
    function handleKeyDown(event) {
        if (!isActiveState) return;

        // Handle Ctrl/Meta key combinations first
        if (event.ctrlKey || event.metaKey) {
            switch (event.key.toLowerCase()) {
                case "s": event.preventDefault(); exit(true); break;
                case "o": event.preventDefault(); exit(false); break;
                case "p": event.preventDefault(); _toggleViewModeHandler(); break;
                case "z": event.preventDefault(); event.shiftKey ? _performRedo() : _performUndo(); break;
                case "y": event.preventDefault(); _performRedo(); break;
                case "f": event.preventDefault(); _openFindBar(false); break;
                case "h": event.preventDefault(); _openFindBar(true); break;
            }
            return;
        }

        let command = null;
        const start = Math.min(selectionAnchor, selectionHead);
        const end = Math.max(selectionAnchor, selectionHead);

        switch (event.key) {
            case "Backspace":
                event.preventDefault();
                if (start === end && start > 0) {
                    command = new DeleteRangeCommand(start - 1, start);
                } else if (start < end) {
                    command = new DeleteRangeCommand(start, end);
                }
                break;

            case "Delete":
                event.preventDefault();
                const textLength = EditorUI.getTextareaContent().length;
                if (start === end && start < textLength) {
                    command = new DeleteRangeCommand(start, start + 1);
                } else if (start < end) {
                    command = new DeleteRangeCommand(start, end);
                }
                break;

            case "Enter":
                event.preventDefault();
                command = new ReplaceRangeCommand(start, end, '\n');
                break;

            case "Tab":
                event.preventDefault();
                command = new ReplaceRangeCommand(start, end, EditorAppConfig.EDITOR.TAB_REPLACEMENT);
                break;

            case "ArrowLeft":
                event.preventDefault();
                const newPos = Math.max(0, selectionHead - 1);
                setSelection(newPos, event.shiftKey ? selectionAnchor : newPos);
                break;

            case "ArrowRight":
                event.preventDefault();
                const newPosRight = Math.min(EditorUI.getTextareaContent().length, selectionHead + 1);
                setSelection(newPosRight, event.shiftKey ? selectionAnchor : newPosRight);
                break;

            case "ArrowUp":
            case "ArrowDown":
                event.preventDefault();
                const lines = EditorUI.getLines();
                const currentPos = EditorUI.indexToLineCol(selectionHead);
                const isUp = event.key === "ArrowUp";

                if ((isUp && currentPos.line > 0) || (!isUp && currentPos.line < lines.length - 1)) {
                    const targetLine = isUp ? currentPos.line - 1 : currentPos.line + 1;
                    const targetCol = Math.min(currentPos.col, lines[targetLine].length);
                    const newIndex = EditorUtils.lineColToIndex(lines, targetLine, targetCol);
                    setSelection(newIndex, event.shiftKey ? selectionAnchor : newIndex);
                }
                break;

            default:
                // Handle printable characters
                if (!event.ctrlKey && !event.metaKey && event.key.length === 1) {
                    event.preventDefault();
                    command = new ReplaceRangeCommand(start, end, event.key);
                }
                break;
        }

        if (command) {
            commandExecutor.execute(command);
        }
    }

    // Public API
    function getContent() { return EditorUI.getTextareaContent(); }
    function setContent(newContent) { EditorUI.setTextareaContent(newContent); _updateFullEditorUI(); }
    function setCursor(position) { setSelection(position); }
    function getSelection() { return { start: selectionAnchor, end: selectionHead }; }
    function replaceRange(start, end, text) {
        const currentContent = getContent();
        const newContent = currentContent.slice(0, start) + text + currentContent.slice(end);
        setContent(newContent);
    }

    return {
        isActive: () => isActiveState,
        enter,
        exit,
        getContent,
        setContent,
        setCursor,
        getSelection,
        replaceRange
    };
})();