/**
 * @file Manages the Oopis Basic IDE application.
 * This file contains the UI and Manager modules for the BASIC app.
 * @author The Engineer
 */

const BasicUI = (() => {
    "use strict";
    let elements = {};
    let callbacks = {};

    function buildLayout(cb) {
        callbacks = cb;
        // Re-using styles from the adventure game for a retro feel.
        elements.output = Utils.createElement('div', { id: 'basic-app-output', className: 'basic-app__output' });
        elements.input = Utils.createElement('input', { id: 'basic-app-input', className: 'basic-app__input', type: 'text', spellcheck: 'false', autocapitalize: 'none' });
        const inputContainer = Utils.createElement('div', { className: 'basic-app__input-line' },
            Utils.createElement('span', { textContent: '>' }),
            elements.input
        );

        elements.exitBtn = Utils.createElement('button', {
            className: 'basic-app__exit-btn',
            textContent: '×',
            title: 'Exit BASIC (EXIT)',
            eventListeners: { click: () => callbacks.onExit() }
        });

        const header = Utils.createElement('header', { className: 'basic-app__header' },
            Utils.createElement('h2', { className: 'basic-app__title', textContent: 'Oopis BASIC v1.0' }),
            elements.exitBtn
        );

        elements.container = Utils.createElement('div', { id: 'basic-app-container', className: 'basic-app__container' }, header, elements.output, inputContainer);

        elements.input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                const command = elements.input.value;
                elements.input.value = '';
                callbacks.onInput(command);
            }
        });

        return elements.container;
    }

    function appendOutput(text, withNewline = true) {
        if (!elements.output) return;
        // BASIC interpreter expects raw text, not styled paragraphs.
        elements.output.textContent += text + (withNewline ? '\n' : '');
        elements.output.scrollTop = elements.output.scrollHeight;
    }

    function write(text) {
        appendOutput(text, false);
    }

    function writeln(text) {
        appendOutput(text, true);
    }

    function focusInput() {
        if (elements.input) {
            elements.input.focus();
        }
    }

    function reset() {
        elements = {};
        callbacks = {};
    }

    return { buildLayout, write, writeln, focusInput, reset };
})();


const BasicManager = (() => {
    "use strict";
    let isActive = false;
    let interpreter = new BasicInterpreter();
    let programBuffer = new Map();
    let onInputPromiseResolver = null;
    let loadOptions = {};

    const callbacks = {
        onInput: async (command) => {
            if (isActive) {
                await _handleIdeInput(command);
            }
        },
        onExit: () => {
            exit();
        }
    };

    function enter(context, options) {
        if (isActive) return;
        isActive = true;

        loadOptions = options; // Store file data
        const layout = BasicUI.buildLayout(callbacks);
        AppLayerManager.show(layout);
        document.addEventListener('keydown', handleKeyDown, true); // Capture keys globally

        _init();
    }

    function exit() {
        if (!isActive) return;

        document.removeEventListener('keydown', handleKeyDown, true);
        AppLayerManager.hide();
        BasicUI.reset();

        // Reset state
        isActive = false;
        interpreter = new BasicInterpreter();
        programBuffer.clear();
        onInputPromiseResolver = null;
        loadOptions = {};
    }

    function _init() {
        BasicUI.writeln('Oopis BASIC [Version 1.0]');
        BasicUI.writeln('(c) 2025 Oopis Systems. All rights reserved.');
        BasicUI.writeln('');

        if (loadOptions.content) {
            _loadContentIntoBuffer(loadOptions.content);
            BasicUI.writeln(`Loaded "${loadOptions.path}".`);
        }

        BasicUI.writeln('READY.');
        BasicUI.focusInput();
    }

    function _loadContentIntoBuffer(content) {
        programBuffer.clear();
        const lines = content.split('\n');
        for (const line of lines) {
            if (line.trim() === '') continue;
            const match = line.match(/^(\d+)\s*(.*)/);
            if (match) {
                const lineNumber = parseInt(match[1], 10);
                const lineContent = match[2].trim();
                if (lineContent) {
                    programBuffer.set(lineNumber, lineContent);
                }
            }
        }
    }

    async function _handleIdeInput(command) {
        command = command.trim();
        BasicUI.writeln(`> ${command}`);

        if (onInputPromiseResolver) {
            onInputPromiseResolver(command);
            onInputPromiseResolver = null;
            return;
        }

        if (command === '') {
            BasicUI.writeln('READY.');
            return;
        };

        const lineMatch = command.match(/^(\d+)(.*)/);
        if (lineMatch) {
            const lineNumber = parseInt(lineMatch[1], 10);
            const lineContent = lineMatch[2].trim();
            if (lineContent === '') {
                programBuffer.delete(lineNumber);
            } else {
                programBuffer.set(lineNumber, lineContent);
            }
        } else {
            // Intelligently parse the command from its arguments before uppercasing.
            const firstSpaceIndex = command.indexOf(' ');
            let cmd, argsStr;

            if (firstSpaceIndex === -1) {
                // No arguments, the whole string is the command.
                cmd = command.toUpperCase();
                argsStr = '';
            } else {
                // Split command and arguments, uppercasing only the command.
                cmd = command.substring(0, firstSpaceIndex).toUpperCase();
                argsStr = command.substring(firstSpaceIndex + 1).trim();
            }
            await _executeIdeCommand(cmd, argsStr);
        }
        if (isActive) { // Check if not exited
            BasicUI.writeln('READY.');
        }
    }

    async function _executeIdeCommand(cmd, argsStr) {
        switch (cmd) {
            case 'RUN':
                await _runProgram();
                break;
            case 'LIST':
                _listProgram();
                break;
            case 'NEW':
                programBuffer.clear();
                loadOptions = {}; // Clear file info
                BasicUI.writeln('OK');
                break;
            case 'SAVE':
                await _saveProgram(argsStr);
                break;
            case 'LOAD':
                await _loadProgram(argsStr);
                break;
            case 'EXIT':
                exit();
                break;
            default:
                BasicUI.writeln('SYNTAX ERROR');
                break;
        }
    }

    function _getProgramText() {
        const sortedLines = Array.from(programBuffer.keys()).sort((a, b) => a - b);
        return sortedLines.map(lineNum => `${lineNum} ${programBuffer.get(lineNum)}`).join('\n');
    }

    function _listProgram() {
        const sortedLines = Array.from(programBuffer.keys()).sort((a, b) => a - b);
        sortedLines.forEach(lineNum => {
            BasicUI.writeln(`${lineNum} ${programBuffer.get(lineNum)}`);
        });
        BasicUI.writeln('OK');
    }

    async function _runProgram() {
        const programText = _getProgramText();
        if (programText.length === 0) {
            BasicUI.writeln('OK');
            return;
        }
        try {
            await interpreter.run(programText, {
                // This callback now respects the 'withNewline' flag passed by the interpreter.
                outputCallback: (text, withNewline = true) => {
                    if (withNewline) {
                        BasicUI.writeln(text);
                    } else {
                        BasicUI.write(text);
                    }
                },
                // This callback's only job is to wait for and return user input.
                // The interpreter handles printing the prompt via the outputCallback.
                inputCallback: async () => {
                    return new Promise(resolve => {
                        onInputPromiseResolver = resolve;
                    });
                }
            });
        } catch (error) {
            BasicUI.writeln(`\nRUNTIME ERROR: ${error.message}`);
        }
        BasicUI.writeln('');
    }

    async function _saveProgram(filePathArg) {
        let savePath = filePathArg ? filePathArg.replace(/["']/g, '') : loadOptions.path;
        if (!savePath) {
            BasicUI.writeln("?NO FILENAME SPECIFIED");
            return;
        }
        if (!savePath.endsWith('.bas')) {
            savePath += '.bas';
        }
        const content = _getProgramText();
        const absPath = FileSystemManager.getAbsolutePath(savePath);
        const currentUser = UserManager.getCurrentUser().name;
        const primaryGroup = UserManager.getPrimaryGroupForUser(currentUser);

        const saveResult = await FileSystemManager.createOrUpdateFile(absPath, content, { currentUser, primaryGroup });
        if (saveResult.success) {
            if (await FileSystemManager.save()) {
                loadOptions.path = savePath; // Update the current path
                BasicUI.writeln('OK');
            } else {
                BasicUI.writeln("?FILESYSTEM SAVE FAILED");
            }
        } else {
            BasicUI.writeln(`?ERROR SAVING FILE: ${saveResult.error}`);
        }
    }

    async function _loadProgram(filePathArg) {
        if (!filePathArg) {
            BasicUI.writeln("?FILENAME REQUIRED");
            return;
        }
        const path = filePathArg.replace(/["']/g, '');
        const pathValidation = FileSystemManager.validatePath("basic load", path, {expectedType: 'file'});
        if (pathValidation.error) {
            BasicUI.writeln(`?ERROR: ${pathValidation.error}`);
            return;
        }
        const node = pathValidation.node;
        if (!FileSystemManager.hasPermission(node, UserManager.getCurrentUser().name, 'read')) {
            BasicUI.writeln("?PERMISSION DENIED");
            return;
        }
        _loadContentIntoBuffer(node.content);
        loadOptions = { path: path, content: node.content };
        BasicUI.writeln("OK");
    }

    function handleKeyDown(e) {
        if (!isActive) return;
        // Allows the app to handle all keydown events it needs
        if (e.key === 'Escape') {
            exit();
        }
    }

    return { enter, exit, isActive: () => isActive };
})();