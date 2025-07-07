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
        if (this.programCounter === null) {
            return; // No program to run
        }

        let currentIndex = sortedLines.indexOf(this.programCounter);

        while (currentIndex < sortedLines.length && currentIndex > -1) {
            this.programCounter = sortedLines[currentIndex];
            const pcBeforeExecute = this.programCounter;

            const statement = this.program.get(this.programCounter);
            await this.executeStatement(statement);

            if (this.programCounter === null) { // END statement was hit
                break;
            }

            // If program counter was changed by GOTO, GOSUB, etc., find the new index.
            if (this.programCounter !== pcBeforeExecute) {
                const newIndex = sortedLines.indexOf(this.programCounter);
                if (newIndex === -1) {
                    this.outputCallback(`\nError: GOTO/GOSUB to non-existent line ${this.programCounter}`);
                    return;
                }
                currentIndex = newIndex;
            } else {
                // Otherwise, just advance to the next line.
                currentIndex++;
            }
        }
    }

    _parseFunctionArgs(statement) {
        const openParen = statement.indexOf('(');
        const closeParen = statement.lastIndexOf(')');
        if (openParen === -1 || closeParen === -1) return [];

        const argsStr = statement.substring(openParen + 1, closeParen);
        const args = [];
        let inQuote = false;
        let currentArg = '';

        for (let i = 0; i < argsStr.length; i++) {
            const char = argsStr[i];

            if (char === '"') {
                inQuote = !inQuote;
            }

            if (char === ',' && !inQuote) {
                args.push(currentArg.trim());
                currentArg = '';
            } else {
                currentArg += char;
            }
        }
        // Add the final argument after the loop
        args.push(currentArg.trim());

        return args;
    }

    async executeStatement(statement) {
        // Regex to robustly capture the command and the rest of the statement.
        const match = statement.match(/^([a-zA-Z_]+)\s*(.*)/s);

        // If no standard command is found, it might be an implicit LET.
        if (!match) {
            if (statement.includes('=')) {
                await this.executeStatement(`LET ${statement}`);
            } else if (statement.trim()) { // Avoid errors on empty lines
                throw new Error(`Syntax Error: Invalid statement format '${statement}'`);
            }
            return;
        }

        const command = match[1].toUpperCase();
        const rest = match[2].trim();

        switch (command) {
            case 'PRINT': {
                const valueToPrint = await this._evaluateExpression(rest);
                this.outputCallback(valueToPrint);
                break;
            }
            case 'LET': {
                const eqIndex = rest.indexOf('=');
                const varName = rest.substring(0, eqIndex).trim();
                const expr = rest.substring(eqIndex + 1).trim();
                const valueToLet = await this._evaluateExpression(expr);
                this.variables.set(varName.toUpperCase(), valueToLet);
                break;
            }
            case 'INPUT': {
                let restOfStatement = rest; // Use the already-parsed 'rest'
                let prompt = '? ';
                // ... (rest of INPUT logic remains the same)
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
                this.programCounter = parseInt(rest, 10);
                break;
            case 'IF': {
                const thenIndex = rest.toUpperCase().indexOf('THEN');
                const conditionPart = rest.substring(0, thenIndex).trim();
                const actionPart = rest.substring(thenIndex + 4).trim();
                if (await this._evaluateCondition(conditionPart)) {
                    await this.executeStatement(actionPart);
                }
            }
                break;
            case 'GOSUB': {
                const sortedLines = Array.from(this.program.keys()).sort((a,b)=>a-b);
                const currentIndex = sortedLines.indexOf(this.programCounter);
                const nextLine = sortedLines[currentIndex + 1];
                if (nextLine) {
                    this.gosubStack.push(nextLine);
                } else {
                    this.gosubStack.push(null); // Return to end of program
                }
                this.programCounter = parseInt(rest, 10);
                break;
            }
            case 'RETURN':
                if (this.gosubStack.length === 0) throw new Error("RETURN without GOSUB");
                this.programCounter = this.gosubStack.pop();
                break;
            case 'SYS_WRITE': {
                const sysWriteArgs = this._parseFunctionArgs(rest);
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
                throw new Error(`Syntax Error: Unknown command '${command}'`);
        }
    }

    async _evaluateExpression(expression) {
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

        const parts = expression.split('+').map(p => p.trim());
        let result = '';
        let resultIsNumeric = true;

        if (parts.length > 1) { // If there's concatenation, treat as string unless all parts are numeric
            let tempResult = "";
            for (const part of parts) {
                let value = this._evaluateSinglePart(part);
                tempResult += String(value);
            }
            return tempResult;
        } else {
            return this._evaluateSinglePart(expression);
        }
    }

    _evaluateSinglePart(part) {
        part = part.trim();
        if (part.startsWith('"') && part.endsWith('"')) {
            return part.substring(1, part.length - 1);
        }
        if (this.variables.has(part.toUpperCase())) {
            return this.variables.get(part.toUpperCase());
        }
        const num = parseFloat(part);
        if (!isNaN(num) && part.trim() !== '') {
            return num;
        }
        return part; // Return as-is if it's not a known var or number
    }

    /**
     * Evaluates a conditional expression from an IF statement.
     * @param {string} condition - The conditional string to evaluate (e.g., "A > 10", "N$ = \"YES\"").
     * @returns {Promise<boolean>} A promise that resolves to true if the condition is met, false otherwise.
     * @private
     * @description This function intentionally uses loose equality operators (`==`, `!=`)
     * instead of strict equality (`===`, `!==`). This is a deliberate design choice to
     * emulate the behavior of classic BASIC interpreters, which were not strictly typed
     * and would often coerce types during comparison (e.g., treating the number 10
     * as equal to the string "10"). This preserves the nostalgic, quirky behavior
     * expected by users familiar with the language's history.
     */
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