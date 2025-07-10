// scripts/apps/code/code_ui.js
const CodeUI = (() => {
    "use strict";

    let elements = {};
    let callbacks = {};
    let onReadyCallback = null;

    function buildAndShow(initialState, onReady, cb) {
        callbacks = cb;
        onReadyCallback = onReady;

        elements.titleInput = Utils.createElement('input', {
            id: 'code-editor-title',
            className: 'code-editor-title-input',
            type: 'text',
            value: initialState.filePath || 'Untitled'
        });

        const saveBtn = Utils.createElement('button', {className: 'btn btn--confirm', textContent: 'Save & Exit'});
        const exitBtn = Utils.createElement('button', {className: 'btn btn--cancel', textContent: 'Exit'});
        saveBtn.addEventListener('click', () => callbacks.onSave(elements.titleInput.value, elements.editor.innerText));
        exitBtn.addEventListener('click', () => callbacks.onExit());
        const header = Utils.createElement('header', {className: 'code-editor-header'}, [elements.titleInput, Utils.createElement('div', {className: 'editor-toolbar-group'}, [saveBtn, exitBtn])]);

        elements.editor = Utils.createElement('div', {
            className: 'code-editor',
            contentEditable: 'true',
            spellcheck: 'false'
        });

        const main = Utils.createElement('main', {className: 'code-editor-main'}, elements.editor);
        elements.container = Utils.createElement('div', {
            id: 'code-editor-container',
            className: 'code-editor-container'
        }, [header, main]);

        // Defer setup that depends on the editor element
        _setupEditor(initialState.fileContent);
        _addEventListeners();

        AppLayerManager.show(elements.container);
        elements.editor.focus();
    }

    function hideAndReset() {
        AppLayerManager.hide();
        elements = {};
        callbacks = {};
        onReadyCallback = null;
    }

    function _setupEditor(content) {
        const lines = content.split('\n');
        elements.editor.innerHTML = ''; // Clear previous content
        if (lines.length === 0 || (lines.length === 1 && lines[0] === '')) {
            elements.editor.appendChild(Utils.createElement('div'));
        } else {
            lines.forEach(line => {
                // Use a non-breaking space for empty lines to ensure the div has height
                elements.editor.appendChild(Utils.createElement('div', {textContent: line || '\u00A0'}));
            });
        }
        // Notify the manager that the editor element is ready
        if (typeof onReadyCallback === 'function') {
            onReadyCallback(elements.editor);
        }
    }

    function _addEventListeners() {
        elements.editor.addEventListener('keydown', e => {
            if (e.key === 'Tab') {
                e.preventDefault();
                callbacks.onTab();
            }
        });

        // Use the 'input' event as it's more comprehensive for content changes.
        elements.editor.addEventListener('input', () => {
            // Ensure empty lines are handled correctly for display
            for (const child of elements.editor.children) {
                if (child.innerHTML === '<br>') {
                    child.innerHTML = '';
                }
                if (child.textContent.length === 0) {
                    child.innerHTML = '&nbsp;';
                }
            }
            callbacks.onInput(elements.editor);
        });
    }

    return {buildAndShow, hideAndReset};
})();