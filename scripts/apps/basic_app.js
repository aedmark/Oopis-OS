/**
 * @file Oopis Basic Application UI. Manages the full-screen REPL environment,
 * program buffer, and interaction with the BasicInterpreter and FileSystemManager.
 * @author The Engineer
 */

const BasicApp = (() => {
    "use strict";

    let isActive = false;
    let elements = {};
    let programBuffer = {};
    // This is no longer a shared state variable, but the concept is moved into a temporary listener.

    function _buildLayout() {
        // This function remains the same as your correct version.
        const exitBtn = Utils.createElement('button', {
            className: 'basic-app__exit-btn',
            textContent: '×',
            title: 'Exit BASIC (Esc)',
            eventListeners: { click: () => exit() }
        });
        const leftSpacer = Utils.createElement('div', { className: 'basic-app__header-spacer' });
        const title = Utils.createElement('h2', { className: 'basic-app__title', textContent: 'Oopis Basic v1.0' });
        const header = Utils.createElement('header', { className: 'basic-app__header' },
            leftSpacer,
            title,
            exitBtn
        );
        setTimeout(() => {
            if (exitBtn && leftSpacer) {
                leftSpacer.style.width = `${exitBtn.offsetWidth}px`;
            }
        }, 0);
        elements.output = Utils.createElement('div', { id: 'basic-output', className: 'basic-app__output' });
        elements.input = Utils.createElement('input', { id: 'basic-input', className: 'basic-app__input', type: 'text', spellcheck: 'false', autocapitalize: 'none', autocomplete: 'off' });
        const inputLine = Utils.createElement('div', { className: 'basic-app__input-line' },
            Utils.createElement('span', { textContent: ']' }),
            elements.input
        );
        elements.container = Utils.createElement('div', { id: 'basic-app-container', className: 'basic-app__container' }, header, elements.output, inputLine);
        return elements.container;
    }

    function _print(text) {
        const line = Utils.createElement('div', { textContent: text });
        elements.output.appendChild(line);
        elements.output.scrollTop = elements.output.scrollHeight;
    }

    function _clearScreen() {
        elements.output.innerHTML = '';
        _print("Oopis Basic v1.0");
        _print("Ready.");
    }

    async function _handleInput(inputString) {
        _print(`] ${inputString}`);
        const parsed = BasicInterpreter.parseLine(inputString);

        if (parsed && parsed.lineNumber) {
            if (parsed.statement.toUpperCase().replace(parsed.lineNumber, '').trim() === '') {
                // If line is just a number, delete it
                delete programBuffer[parsed.lineNumber];
                return;
            }
            programBuffer[parsed.lineNumber] = parsed.statement;
            return;
        }

        const tokens = inputString.trim().toUpperCase().split(/\s+/);
        const command = tokens[0];
        const arg = tokens.slice(1).join(" ").replace(/["']/g, '');

        switch (command) {
            case "RUN":
                BasicInterpreter.loadProgram(Object.entries(programBuffer).map(([ln, st]) => `${ln} ${st}`).join('\n'));
                elements.input.disabled = true;
                try {
                    // This is the new, more robust input handling logic.
                    await BasicInterpreter.run(_print, (prompt) => {
                        return new Promise(resolve => {
                            _print(prompt);
                            elements.input.disabled = false;
                            elements.input.focus();

                            const temporaryListener = (e) => {
                                if (e.key === 'Enter') {
                                    e.preventDefault();
                                    const value = elements.input.value;
                                    elements.input.removeEventListener('keydown', temporaryListener);
                                    elements.input.value = '';
                                    _print(value); // Echo the user's input
                                    elements.input.disabled = true;
                                    resolve(value);
                                }
                            };
                            elements.input.addEventListener('keydown', temporaryListener);
                        });
                    });
                } catch (e) {
                    _print(`FATAL INTERPRETER ERROR: ${e.message}`);
                } finally {
                    elements.input.disabled = false;
                    elements.input.focus();
                    _print("\nReady.");
                }
                break;
            case "LIST":
                const sortedLines = Object.keys(programBuffer).map(Number).sort((a,b) => a - b);
                sortedLines.forEach(ln => _print(`${ln} ${programBuffer[ln]}`));
                break;
            case "NEW":
                programBuffer = {};
                BasicInterpreter.clearProgram();
                _clearScreen();
                break;
            case "SAVE":
                if (!arg) { _print("?SYNTAX ERROR: SAVE requires a filename."); break; }
                const contentToSave = Object.entries(programBuffer).map(([ln, st]) => `${ln} ${st}`).join('\n');
                const absSavePath = FileSystemManager.getAbsolutePath(arg);
                await FileSystemManager.createOrUpdateFile(absSavePath, contentToSave, { currentUser: UserManager.getCurrentUser().name, primaryGroup: UserManager.getPrimaryGroupForUser(UserManager.getCurrentUser().name) });
                await FileSystemManager.save();
                _print(`Saved to ${arg}.`);
                break;
            case "LOAD":
                if (!arg) { _print("?SYNTAX ERROR: LOAD requires a filename."); break; }
                const absLoadPath = FileSystemManager.getAbsolutePath(arg);
                const node = FileSystemManager.getNodeByPath(absLoadPath);
                if (!node || node.type !== 'file') { _print(`?FILE NOT FOUND: ${arg}`); break; }
                programBuffer = {};
                (node.content || "").split('\n').forEach(line => {
                    const p = BasicInterpreter.parseLine(line);
                    if (p) programBuffer[p.lineNumber] = p.statement;
                });
                _print(`Loaded ${arg}.`);
                break;
            case "EXIT":
                exit();
                break;
            default:
                _print("?SYNTAX ERROR");
        }
    }

    function _setupEventListeners() {
        // This listener is now only for IDE commands. Program INPUT is handled by the temporary listener.
        elements.input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !elements.input.disabled) {
                e.preventDefault();
                const command = elements.input.value;
                elements.input.value = '';
                _handleInput(command);
            }
        });
        document.addEventListener('keydown', _handleGlobalKeys);
    }

    function _handleGlobalKeys(e) {
        if (isActive && e.key === 'Escape') {
            exit();
        }
    }

    function exit() {
        if (!isActive) return;
        document.removeEventListener('keydown', _handleGlobalKeys);
        AppLayerManager.hide();
        isActive = false;
        elements = {};
        programBuffer = {};
    }

    return {
        enter: (fileContent) => {
            if (isActive) return;
            isActive = true;
            programBuffer = {};

            const appElement = _buildLayout();
            AppLayerManager.show(appElement);
            elements.input.focus();
            _setupEventListeners();
            _clearScreen();

            if(fileContent) {
                fileContent.split('\n').forEach(line => {
                    const p = BasicInterpreter.parseLine(line);
                    if(p) programBuffer[p.lineNumber] = p.statement;
                });
                _print("Loaded program.");
            }
        },
        exit
    };
})();