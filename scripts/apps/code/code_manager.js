// scripts/apps/code/code_manager.js
const CodeManager = (() => {
    "use strict";

    let state = {};
    let editorInstance; // Will be initialized in enter()

    const defaultState = {
        isActive: false,
        filePath: null,
        originalContent: "",
    };

    // This is the syntax highlighter, with corrected regex.
    const jsHighlighter = el => {
        for (const node of el.children) {
            const s = (node.innerText || ' ')
                .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;') // Basic HTML escaping
                .replace(/(\/\/. *)/g, '<em>$1</em>') // Comments
                .replace(/\b(new|if|else|do|while|switch|for|in|of|continue|break|return|typeof|function|var|const|let|async|await|class|extends|true|false|null)(?=[^\w])/g, '<strong>$1</strong>') // Keywords
                .replace(/(".*?"|'.*?'|`.*?`)/g, '<strong><em>$1</em></strong>') // Strings
                .replace(/\b(\d+)/g, '<em><strong>$1</strong></em>'); // Numbers
            node.innerHTML = s.split('\n').join('<br/>');
        }
    };

    const editorHandler = (el, highlight, tab) => {
        const caret = () => {
            if (!window.getSelection().rangeCount) return 0;
            const range = window.getSelection().getRangeAt(0);
            const prefix = range.cloneRange();
            prefix.selectNodeContents(el);
            prefix.setEnd(range.endContainer, range.endOffset);
            return prefix.toString().length;
        };

        const setCaret = (pos, parent = el) => {
            for (const node of parent.childNodes) {
                if (node.nodeType === Node.TEXT_NODE) {
                    if (node.length >= pos) {
                        const range = document.createRange();
                        const sel = window.getSelection();
                        range.setStart(node, pos);
                        range.collapse(true);
                        sel.removeAllRanges();
                        sel.addRange(range);
                        return -1;
                    } else {
                        pos -= node.length;
                    }
                } else {
                    pos = setCaret(pos, node);
                    if (pos < 0) return pos;
                }
            }
            return pos;
        };

        const handleTab = () => {
            const pos = caret() + tab.length;
            const range = window.getSelection().getRangeAt(0);
            range.deleteContents();
            range.insertNode(document.createTextNode(tab));
            highlight(el);
            setCaret(pos);
        };

        const highlightWithCaret = () => {
            const pos = caret();
            highlight(el);
            setCaret(pos);
        };

        return {handleTab, highlightWithCaret, highlight};
    };

    const debouncedHighlight = Utils.debounce((editorEl) => {
        if (editorInstance) {
            editorInstance.highlightWithCaret(editorEl);
        }
    }, 500);

    function enter(filePath, fileContent) {
        if (state.isActive) return;
        state = {...defaultState, isActive: true, filePath, originalContent: fileContent || ""};

        // Initialize editorInstance here so it has access to the correct element
        editorInstance = null; // Clear previous instance

        CodeUI.buildAndShow({filePath, fileContent: fileContent || ""}, (editorEl) => {
            // This callback is invoked by CodeUI once the element is created
            editorInstance = editorHandler(editorEl, jsHighlighter, '  ');
            callbacks.onHighlight(editorEl); // Initial highlight
        }, callbacks);
    }

    async function exit() {
        if (!state.isActive) return;
        _performExit();
    }

    function _performExit() {
        CodeUI.hideAndReset();
        state = {};
        editorInstance = null;
    }

    const callbacks = {
        onSave: async (filePath, content) => {
            if (!filePath) {
                // This should be handled by a proper status bar in the UI, but for now, an OS-level message will suffice.
                await OutputManager.appendToOutput("Error: Filename cannot be empty.", {typeClass: 'text-error'});
                return;
            }
            const currentUser = UserManager.getCurrentUser().name;
            const primaryGroup = UserManager.getPrimaryGroupForUser(currentUser);
            const saveResult = await FileSystemManager.createOrUpdateFile(filePath, content, {
                currentUser,
                primaryGroup
            });

            if (saveResult.success && await FileSystemManager.save()) {
                _performExit();
            } else {
                await OutputManager.appendToOutput(`Error saving file: ${saveResult.error || "Filesystem error"}`, {typeClass: 'text-error'});
            }
        },
        onExit: exit,
        onTab: () => {
            if (editorInstance) editorInstance.handleTab();
        },
        onHighlight: (el) => {
            if (editorInstance) editorInstance.highlight(el);
        },
        onInput: (editorEl) => {
            debouncedHighlight(editorEl);
        }
    };

    return {enter, exit, isActive: () => state.isActive};
})();