/**
 * Oopis Basic Interpreter
 * DECLARED IN GLOBAL SCOPE. This script must be loaded before basic_app.js.
 * @class BasicInterpreter
 */
class BasicInterpreter {
    constructor() {
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

            // Stash the next line number before executing the statement,
            // as GOTO/GOSUB will overwrite this.programCounter
            const nextCounter = nextLineIndex < sortedLines.length ? sortedLines[nextLineIndex] : null;

            await this.executeStatement(statement);

            // Only advance if program counter wasn't changed by GOTO/GOSUB
            if (this.program.has(this.programCounter)) {
                // no-op
            } else {
                this.programCounter = nextCounter;
            }
        }
    }

    _parseFunctionArgs(statement) {
        const openParen = statement.indexOf('(');
        const closeParen = statement.lastIndexOf(')');
        if (openParen === -1 || closeParen === -1) return [];
        const argsStr = statement.substring(openParen + 1, closeParen);
        // This is a simple split, doesn't handle nested commas in strings, but is sufficient for this BASIC dialect.
        return argsStr.split(',').map(s => s.trim());
    }

    async executeStatement(statement) {
        const parts = statement.split(/\s+/);
        const command = parts[0].toUpperCase();

        switch (command) {
            case 'PRINT': {
                const valueToPrint = await this._evaluateExpression(statement.substring(5).trim());
                this.outputCallback(valueToPrint);
                break;
            }
            case 'LET': {
                const eqIndex = statement.indexOf('=');
                const varName = statement.substring(3, eqIndex).trim();
                const expr = statement.substring(eqIndex + 1).trim();
                const valueToLet = await this._evaluateExpression(expr);
                this.variables.set(varName.toUpperCase(), valueToLet);
                break;
            }
            case 'INPUT': {
                let restOfStatement = statement.substring(5).trim();
                let prompt = '? ';

                if (restOfStatement.startsWith('"')) {
                    const endQuoteIndex = restOfStatement.indexOf('"', 1);
                    if (endQuoteIndex !== -1) {
                        prompt = restOfStatement.substring(1, endQuoteIndex) + ' ';
                        restOfStatement = restOfStatement.substring(endQuoteIndex + 1).trim();
                        if (restOfStatement.startsWith(',')) {
                            restOfStatement = restOfStatement.substring(1).trim();
                        }
                    }
                }
                const varNames = restOfStatement.split(',').map(v => v.trim());
                for (let i = 0; i < varNames.length; i++) {
                    const vName = varNames[i];
                    if (!vName) continue;
                    const currentPrompt = (i === 0) ? prompt : '? ';
                    this.outputCallback(currentPrompt, false);
                    const userInput = await this.inputCallback();
                    const isStringVariable = vName.endsWith('$');
                    const upperVarName = vName.toUpperCase();
                    if (isStringVariable) {
                        this.variables.set(upperVarName, userInput);
                    } else {
                        const value = parseFloat(userInput);
                        this.variables.set(upperVarName, isNaN(value) ? 0 : value);
                    }
                }
                break;
            }
            case 'GOTO':
                this.programCounter = parseInt(parts[1], 10);
                break;
            case 'IF': {
                const thenIndex = statement.toUpperCase().indexOf('THEN');
                const conditionPart = statement.substring(2, thenIndex).trim();
                const actionPart = statement.substring(thenIndex + 4).trim();
                if (await this._evaluateCondition(conditionPart)) {
                    await this.executeStatement(actionPart);
                }
            }
                break;
            case 'GOSUB':
                const nextLineIndex = Array.from(this.program.keys()).sort((a,b) => a-b).indexOf(this.programCounter) + 1;
                this.gosubStack.push(Array.from(this.program.keys()).sort((a,b) => a-b)[nextLineIndex-1]);
                this.programCounter = parseInt(parts[1], 10);
                break;
            case 'RETURN':
                if (this.gosubStack.length === 0) throw new Error("RETURN without GOSUB");
                this.programCounter = this.gosubStack.pop();
                break;
            case 'SYS_WRITE': {
                const sysWriteArgs = this._parseFunctionArgs(statement);
                if (sysWriteArgs.length !== 2) throw new Error("SYS_WRITE requires 2 arguments: filepath and content");
                const filePath = await this._evaluateExpression(sysWriteArgs[0]);
                const content = await this._evaluateExpression(sysWriteArgs[1]);
                const currentUser = UserManager.getCurrentUser().name;
                const primaryGroup = UserManager.getPrimaryGroupForUser(currentUser);
                const absPath = FileSystemManager.getAbsolutePath(filePath);
                const saveResult = await FileSystemManager.createOrUpdateFile(absPath, content, { currentUser, primaryGroup });
                if (!saveResult.success) throw new Error(`Failed to write to file: ${saveResult.error}`);
                await FileSystemManager.save();
                break;
            }
            case 'REM':
                break;
            case 'END':
                this.programCounter = null;
                break;
            default:
                if (statement.includes('=')) {
                    await this.executeStatement(`LET ${statement}`);
                } else {
                    throw new Error(`Syntax Error: Unknown command '${command}'`);
                }
                break;
        }
    }

    async _evaluateExpression(expression) {
        // Handle system function calls first
        const sysCmdMatch = expression.match(/SYS_CMD\((.*)\)/i);
        if (sysCmdMatch) {
            const cmd = await this._evaluateExpression(sysCmdMatch[1]);
            const result = await CommandExecutor.processSingleCommand(cmd, { isInteractive: false });
            return result.output || "";
        }

        const sysReadMatch = expression.match(/SYS_READ\((.*)\)/i);
        if (sysReadMatch) {
            const path = await this._evaluateExpression(sysReadMatch[1]);
            const pathValidation = FileSystemManager.validatePath("basic_read", path, { expectedType: 'file' });
            if (pathValidation.error) throw new Error(pathValidation.error);
            const node = pathValidation.node;
            if (!FileSystemManager.hasPermission(node, UserManager.getCurrentUser().name, 'read')) throw new Error("Permission denied");
            return node.content || "";
        }

        // Handle arithmetic and string concatenation
        const parts = expression.split('+').map(p => p.trim());
        let result = '';
        let isNumeric = true;

        for (let i = 0; i < parts.length; i++) {
            let part = parts[i];
            let value;

            if (part.startsWith('"') && part.endsWith('"')) {
                value = part.substring(1, part.length - 1);
                isNumeric = false;
            } else if (part.endsWith('$')) {
                value = this.variables.get(part.toUpperCase()) || "";
                isNumeric = false;
            } else {
                const varValue = this.variables.get(part.toUpperCase());
                if (varValue !== undefined) {
                    value = varValue;
                } else {
                    value = parseFloat(part);
                    if (isNaN(value)) {
                        value = 0; // Default to 0 if not a number or defined variable
                    }
                }
            }

            if (i === 0) {
                result = value;
            } else {
                if(isNumeric) {
                    result += value;
                } else {
                    result = String(result) + String(value);
                }
            }
        }
        return result;
    }

    async _evaluateCondition(condition) {
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
        const left = await this._evaluateExpression(parts[0]);
        const right = await this._evaluateExpression(parts[1]);
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