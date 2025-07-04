/**
 * Oopis Basic Interpreter
 * DECLARED IN GLOBAL SCOPE. This script must be loaded before basic_app.js.
 * @class BasicInterpreter
 */
class BasicInterpreter {
    constructor() {
        // ... (The constructor and all other methods remain identical) ...
        this.variables = new Map();
        this.gosubStack = [];
        this.program = new Map();
        this.programCounter = null;
        this.outputCallback = (text) => console.log(text);
        this.inputCallback = async () => "? ";
    }

    _initializeState() {
        this.variables.clear();
        this.gosubStack = [];
        this.program.clear();
        this.programCounter = null;
    }

    _parseProgram(programText) {
        const lines = programText.split('\n');
        let firstLine = Infinity;

        for (const line of lines) {
            if (line.trim() === '') continue;
            const match = line.match(/^(\d+)\s+(.*)/);
            if (match) {
                const lineNumber = parseInt(match[1], 10);
                const statement = match[2].trim();
                this.program.set(lineNumber, statement);
                if (lineNumber < firstLine) {
                    firstLine = lineNumber;
                }
            }
        }
        this.programCounter = firstLine === Infinity ? null : firstLine;
    }

    async run(programText, { outputCallback, inputCallback }) {
        // ... (This entire method remains identical) ...
        this._initializeState();
        this.outputCallback = outputCallback;
        this.inputCallback = inputCallback;
        this._parseProgram(programText);

        const sortedLines = Array.from(this.program.keys()).sort((a, b) => a - b);

        while (this.programCounter !== null) {
            if (!this.program.has(this.programCounter)) {
                this.outputCallback(`Error: Line number ${this.programCounter} not found.`);
                return;
            }

            const statement = this.program.get(this.programCounter);
            const currentLineIndex = sortedLines.indexOf(this.programCounter);

            const nextLineIndex = currentLineIndex + 1;
            this.programCounter = nextLineIndex < sortedLines.length ? sortedLines[nextLineIndex] : null;

            await this.executeStatement(statement);
        }
    }

    async executeStatement(statement) {
        // ... (This entire method and its switch case remain identical) ...
        const parts = statement.split(/\s+/);
        const command = parts[0].toUpperCase();

        switch (command) {
            case 'PRINT':
                const printContent = statement.substring(statement.search(/\S/g));
                this.outputCallback(this._evaluateExpression(printContent.substring(printContent.indexOf(' ')+1)));
                break;
            case 'LET':
                const [_, varName, equals, ...exprParts] = parts;
                if (equals !== '=') throw new Error("Syntax Error in LET statement");
                this.variables.set(varName.toUpperCase(), this._evaluateExpression(exprParts.join(' ')));
                break;
            case 'INPUT':
                const varNames = statement.substring(5).trim().split(',').map(v => v.trim().toUpperCase());
                for (const vName of varNames) {
                    this.outputCallback('? ', false);
                    const userInput = await this.inputCallback();
                    const value = parseFloat(userInput);
                    this.variables.set(vName, isNaN(value) ? 0 : value);
                }
                break;
            // ... all other cases (GOTO, IF, GOSUB, etc.) are the same
            case 'GOTO':
                this.programCounter = parseInt(parts[1], 10);
                break;
            case 'IF': {
                const thenIndex = parts.indexOf('THEN');
                const conditionPart = parts.slice(1, thenIndex).join(' ');
                const actionPart = parts.slice(thenIndex + 1).join(' ');
                if (this._evaluateCondition(conditionPart)) {
                    await this.executeStatement(actionPart);
                }
            }
                break;
            case 'GOSUB':
                this.gosubStack.push(this.programCounter);
                this.programCounter = parseInt(parts[1], 10);
                break;
            case 'RETURN':
                if (this.gosubStack.length === 0) throw new Error("RETURN without GOSUB");
                this.programCounter = this.gosubStack.pop();
                break;
            case 'REM':
                break;
            case 'END':
                this.programCounter = null;
                break;
            default:
                if (parts[1] === '=') {
                    await this.executeStatement(`LET ${statement}`);
                } else {
                    this.outputCallback(`Syntax Error: Unknown command '${command}'`);
                    this.programCounter = null;
                }
                break;
        }
    }

    _evaluateExpression(expression) {
        // ... (This method remains identical) ...
        if (expression.startsWith('"') && expression.endsWith('"')) {
            return expression.substring(1, expression.length - 1);
        }
        const upperExpr = expression.trim().toUpperCase();
        if (this.variables.has(upperExpr)) {
            return this.variables.get(upperExpr);
        }
        try {
            const sanitized = expression.replace(/[A-Z_][A-Z0-9_]*/gi, (match) => {
                return this.variables.get(match.toUpperCase()) || '0';
            });
            return eval(sanitized);
        } catch (e) {
            return 0;
        }
    }

    _evaluateCondition(condition) {
        // ... (This method remains identical) ...
        const operators = ['<=', '>=', '<>', '<', '>', '='];
        let operator = null;
        for (const op of operators) {
            if (condition.includes(op)) {
                operator = op;
                break;
            }
        }
        if (!operator) return false;
        const parts = condition.split(operator).map(p => p.trim());
        const left = this._evaluateExpression(parts[0]);
        const right = this._evaluateExpression(parts[1]);
        switch (operator) {
            case '=': return left == right;
            case '<>': return left != right;
            case '<': return left < right;
            case '>': return left > right;
            case '<=': return left <= right;
            case '>=': return left >= right;
            default: return false;
        }
    }
}