/**
 * A stateful host for the Oopis Basic Interpreter.
 * @class BasicApp
 * @extends {App}
 */
class BasicApp extends App {
    constructor(context, loadOptions = {}) {
        super(context); // Passes the full context to the parent App class.
        this.interpreter = new BasicInterpreter();
        this.programBuffer = new Map();
        this.onInputPromiseResolver = null;
        this.loadOptions = loadOptions; // Save the file data.
    }

    static enter(context, loadOptions) {
        return new BasicApp(context, loadOptions);
    }

    _init() {
        this.term.writeln('Oopis BASIC [Version 1.0]');
        this.term.writeln('(c) 2025 Oopis Systems. All rights reserved.');
        this.term.writeln('');

        // Check if there's file content to load on startup.
        if (this.loadOptions.content) {
            this._loadContentIntoBuffer(this.loadOptions.content);
            this.term.writeln(`Loaded "${this.loadOptions.path}".`);
        }

        this.term.write('READY.\r\n> ');
    }

    // Helper function to parse file content into the program buffer.
    _loadContentIntoBuffer(content) {
        this.programBuffer.clear();
        const lines = content.split('\n');
        for (const line of lines) {
            if (line.trim() === '') continue;
            const match = line.match(/^(\d+)\s*(.*)/);
            if (match) {
                const lineNumber = parseInt(match[1], 10);
                const lineContent = match[2].trim();
                if (lineContent) {
                    this.programBuffer.set(lineNumber, lineContent);
                }
            }
        }
    }

    async _handleInput(command) {
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
        return sortedLines.map(lineNum => `${this.programBuffer.get(lineNum)}`).join('\n');
    }

    _listProgram() {
        const sortedLines = Array.from(this.programBuffer.keys()).sort((a, b) => a - b);
        sortedLines.forEach(lineNum => {
            this.term.writeln(`${lineNum} ${this.programBuffer.get(lineNum)}`);
        });
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