/**
 * A stateful host for the Oopis Basic Interpreter.
 * NOTE: This class `extends App` and creates a `new BasicInterpreter()`.
 * It relies on `app.js` and `BasicInterpreter.js` being loaded first.
 * @class BasicApp
 * @extends {App}
 */
class BasicApp extends App {
    constructor(term, context) {
        super(term, context); // 'App' is expected to be in the global scope
        this.interpreter = new BasicInterpreter(); // 'BasicInterpreter' is also global
        this.programBuffer = new Map();
        this.onInputPromiseResolver = null;
    }

    _init() {
        this.term.writeln('Oopis BASIC [Version 1.0]');
        this.term.writeln('(c) 2025 Oopis Systems. All rights reserved.');
        this.term.writeln('');
        this.term.write('READY.\r\n> ');
    }

    async _handleInput(command) {
        // ... (This entire method and the rest of the class remain identical) ...
        command = command.trim();
        if (command === '') {
            this.term.write('> ');
            return;
        };

        if (this.onInputPromiseResolver) {
            this.onInputPromiseResolver(command);
            this.onInputPromiseResolver = null;
            return;
        }

        const lineMatch = command.match(/^(\d+)(.*)/);
        if (lineMatch) {
            const lineNumber = parseInt(lineMatch[1], 10);
            const lineContent = lineMatch[2].trim();
            if (lineContent === '') {
                this.programBuffer.delete(lineNumber);
            } else {
                this.programBuffer.set(lineNumber, lineContent);
            }
        } else {
            await this._executeIdeCommand(command.toUpperCase());
        }
        this.term.write('READY.\r\n> ');
    }

    async _executeIdeCommand(command) {
        switch (command) {
            case 'RUN':
                await this._runProgram();
                break;
            case 'LIST':
                this._listProgram();
                break;
            case 'NEW':
                this.programBuffer.clear();
                this.term.writeln('OK');
                break;
            case 'SAVE':
                this.term.writeln('SAVE is not yet implemented.');
                break;
            case 'LOAD':
                this.term.writeln('LOAD is not yet implemented.');
                break;
            case 'EXIT':
                this.exit();
                break;
            default:
                this.term.writeln('SYNTAX ERROR');
                break;
        }
    }

    _getProgramText() {
        const sortedLines = Array.from(this.programBuffer.keys()).sort((a, b) => a - b);
        return sortedLines.map(lineNum => `${lineNum} ${this.programBuffer.get(lineNum)}`).join('\n');
    }

    _listProgram() {
        this.term.writeln(this._getProgramText());
    }

    async _runProgram() {
        this.term.writeln('RUNNING...');
        const programText = this._getProgramText();
        if (programText.length === 0) {
            this.term.writeln('');
            return;
        }
        try {
            await this.interpreter.run(programText, {
                outputCallback: (text, newline = true) => {
                    if (newline) {
                        this.term.writeln(text);
                    } else {
                        this.term.write(text);
                    }
                },
                inputCallback: () => {
                    return new Promise(resolve => {
                        this.onInputPromiseResolver = resolve;
                    });
                }
            });
        } catch (error) {
            this.term.writeln(`\r\nRUNTIME ERROR: ${error.message}`);
        }
        this.term.writeln('');
    }
}