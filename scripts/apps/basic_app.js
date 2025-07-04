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

    function _buildLayout() {
        // --- REFACTORED: Use more semantic, style-friendly structure ---
        const header = Utils.createElement('header', { className: 'basic-app__header' },
            Utils.createElement('h2', { className: 'basic-app__title', textContent: 'Oopis Basic v1.0' }),
            Utils.createElement('button', {
                className: 'basic-app__exit-btn',
                textContent: '×',
                title: 'Exit BASIC (Esc)',
                eventListeners: { click: () => exit() }
            })
        );

        elements.output = Utils.createElement('div', { id: 'basic-output', className: 'basic-app__output' });
        elements.input = Utils.createElement('input', {
            id: 'basic-input',
            className: 'basic-app__input',
            type: 'text',
            spellcheck: 'false',
            autocapitalize: 'none',
            autocomplete: 'off'
        });

        const inputLine = Utils.createElement('div', { className: 'basic-app__input-line' },
            Utils.createElement('span', { textContent: ']' }),
            elements.input
        );

        elements.container = Utils.createElement('div', { id: 'basic-app-container', className: 'basic-app__container' },
            header,
            elements.output,
            inputLine
        );

        return elements.container;
    }


    function _print(text) {
        // Ensure text is treated as a single block of text content
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

        if (parsed) {
            programBuffer[parsed.lineNumber] = parsed.statement;
            return;
        }

        const tokens = inputString.trim().toUpperCase().split(/\s+/);
        const command = tokens[0];
        const arg = tokens.slice(1).join(" ").replace(/["']/g, '');

        switch (command) {
            case "RUN":
                BasicInterpreter.loadProgram(Object.entries(programBuffer).map(([ln, st]) => `${ln} ${st}`).join('\n'));
                elements.input.disabled = true; // Disable input during run
                await BasicInterpreter.run(_print, (prompt) => {
                    return new Promise(resolve => {
                        _print(prompt);
                        elements.input.disabled = false;
                        elements.input.focus();
                        elements.input.onkeydown = (e) => {
                            if (e.key === 'Enter') {
                                const val = elements.input.value;
                                _print(val);
                                elements.input.value = '';
                                // Restore original event listener
                                elements.input.onkeydown = (e) => { if(e.key === 'Enter') _handleInput(e.target.value); };
                                resolve(val);
                            }
                        };
                    });
                });
                elements.input.disabled = false;
                elements.input.focus();
                _print("\nReady.");
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
                await FileSystemManager.createOrUpdateFile(arg, contentToSave, { currentUser: UserManager.getCurrentUser().name, primaryGroup: UserManager.getPrimaryGroupForUser(UserManager.getCurrentUser().name) });
                await FileSystemManager.save();
                _print(`Saved to ${arg}.`);
                break;
            case "LOAD":
                if (!arg) { _print("?SYNTAX ERROR: LOAD requires a filename."); break; }
                const node = FileSystemManager.getNodeByPath(arg);
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
        elements.input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
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