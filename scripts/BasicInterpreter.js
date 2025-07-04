/**
 * @file Implements the Oopis Basic Interpreter.
 * This module is responsible for parsing and executing BASIC code, including
 * custom system integration commands. It is designed to be used by a UI/application layer.
 * @author The Engineer
 */

const BasicInterpreter = (() => {
    "use strict";

    let variables = {};
    let gosubStack = [];
    let outputCallback = () => {};
    let inputCallback = async () => "";
    let program = {};

    // --- Parser ---
    function parseLine(line) {
        const trimmedLine = line.trim();
        const parts = trimmedLine.match(/^(\d+)\s*(.*)$/);
        if (!parts) return null;

        const lineNumber = parseInt(parts[1], 10);
        const statement = parts[2].trim();

        const commandMatch = statement.match(/^[A-Z_]+/i);
        const command = commandMatch ? commandMatch[0].toUpperCase() : null;

        const tokens = statement.match(/(?:[^\s"]+|"[^"]*")+/g) || [];

        return { lineNumber, command, statement, tokens };
    }

    // --- Expression Evaluator ---
    async function evaluateExpression(expr) {
        const trimmedExpr = expr.trim();

        const sysCmdMatch = trimmedExpr.match(/^SYS_CMD\((.*)\)$/i);
        if (sysCmdMatch) {
            const argExpr = sysCmdMatch[1];
            const cmdToRun = await evaluateExpression(argExpr);
            const cmdResult = await CommandExecutor.processSingleCommand(cmdToRun, { isInteractive: false });
            return cmdResult.output || cmdResult.error || "";
        }

        const sysReadMatch = trimmedExpr.match(/^SYS_READ\((.*)\)$/i);
        if (sysReadMatch) {
            const argExpr = sysReadMatch[1];
            const path = await evaluateExpression(argExpr);
            const fileNode = FileSystemManager.getNodeByPath(path);
            if (!fileNode) throw new Error(`Runtime error: File not found '${path}'`);
            if (!FileSystemManager.hasPermission(fileNode, UserManager.getCurrentUser().name, "read")) {
                throw new Error(`Runtime error: Permission denied for '${path}'`);
            }
            return fileNode.content || "";
        }

        if (trimmedExpr.startsWith('"') && trimmedExpr.endsWith('"')) {
            return trimmedExpr.slice(1, -1);
        }

        if (variables.hasOwnProperty(trimmedExpr)) {
            return variables[trimmedExpr];
        }

        if (trimmedExpr.includes('+')) {
            const parts = trimmedExpr.split('+').map(p => p.trim());
            const evaluatedParts = await Promise.all(parts.map(p => evaluateExpression(p)));
            return evaluatedParts.join('');
        }

        const num = parseFloat(trimmedExpr);
        if (!isNaN(num) && !/[A-Z]/i.test(trimmedExpr)) return num;

        return trimmedExpr;
    }

    async function evaluateCondition(condition) {
        const operators = ['<>', '>=', '<=', '=', '>', '<'];
        let operator = null;
        let parts = [];

        for (const op of operators) {
            if (condition.includes(op)) {
                operator = op;
                parts = condition.split(op).map(p => p.trim());
                break;
            }
        }

        if (!operator || parts.length !== 2) throw new Error(`Syntax error in condition: ${condition}`);

        const left = await evaluateExpression(parts[0]);
        const right = await evaluateExpression(parts[1]);

        switch (operator) {
            case '=': return left == right;
            case '<>': return left != right;
            case '>': return left > right;
            case '<': return left < right;
            case '>=': return left >= right;
            case '<=': return left <= right;
            default: throw new Error(`Syntax error: Unknown operator '${operator}'`);
        }
    }

    // --- Execution Engine ---
    async function executeStatement(parsedLine) {
        const { command } = parsedLine;

        switch (command) {
            case "REM":
                break;
            case "PRINT":
                let printArgStr = parsedLine.statement.substring(command.length).trim();
                if (printArgStr.endsWith(';')) {
                    printArgStr = printArgStr.slice(0, -1).trim();
                }
                const printValue = await evaluateExpression(printArgStr);
                outputCallback(printValue);
                break;
            case "INPUT":
                const inputArgStr = parsedLine.statement.substring(command.length).trim();
                const commaIndex = inputArgStr.lastIndexOf(',');
                let promptText = "? ";
                let variableName;

                if (commaIndex !== -1) {
                    promptText = await evaluateExpression(inputArgStr.substring(0, commaIndex).trim());
                    variableName = inputArgStr.substring(commaIndex + 1).trim();
                } else {
                    variableName = inputArgStr;
                }

                if (!/^[A-Z][A-Z0-9_]*\$?$/.test(variableName)) throw new Error(`Syntax error: Invalid variable name '${variableName}'`);

                const inputValue = await inputCallback(promptText);

                if (inputValue === null) throw new Error("Execution halted by user.");
                variables[variableName] = variableName.endsWith('$') ? inputValue : parseFloat(inputValue);
                break;
            case "LET":
                const letStatementStr = parsedLine.statement.substring(command.length).trim();
                const eqIndex = letStatementStr.indexOf('=');
                if (eqIndex === -1) throw new Error("Syntax error: Missing '=' in LET statement");

                const letVar = letStatementStr.substring(0, eqIndex).trim();
                if (!/^[A-Z][A-Z0-9_]*\$?$/.test(letVar)) throw new Error(`Syntax error: Invalid variable name '${letVar}'`);

                const letExpr = letStatementStr.substring(eqIndex + 1).trim();
                variables[letVar] = await evaluateExpression(letExpr);
                break;
            case "IF":
                const thenIndex = parsedLine.statement.toUpperCase().indexOf("THEN");
                if (thenIndex === -1) throw new Error("Syntax error: Missing THEN in IF statement");
                const condition = parsedLine.statement.substring(command.length, thenIndex).trim();
                const action = parsedLine.statement.substring(thenIndex + 4).trim();

                if (await evaluateCondition(condition)) {
                    if (action.toUpperCase().startsWith("GOTO")) {
                        const targetLine = parseInt(action.split(/\s+/)[1], 10);
                        return targetLine;
                    }
                }
                break;
            case "GOTO":
                return parseInt(parsedLine.tokens[1], 10);
            case "GOSUB":
                gosubStack.push(parsedLine.lineNumber);
                return parseInt(parsedLine.tokens[1], 10);
            case "RETURN":
                if (gosubStack.length === 0) throw new Error("Runtime error: RETURN without GOSUB");
                const returnToLine = gosubStack.pop();
                const lineNumbers = Object.keys(program).map(Number).sort((a, b) => a - b);
                const returnToIndex = lineNumbers.indexOf(returnToLine);
                return lineNumbers[returnToIndex + 1];
            case "SYS_WRITE":
                const writeArgStr = parsedLine.statement.substring(command.length).trim();
                const writeArgParts = writeArgStr.split(',');

                if(writeArgParts.length !== 2) throw new Error("Syntax error: SYS_WRITE requires two arguments: a filepath and content.");

                const evaluatedPath = await evaluateExpression(writeArgParts[0].trim());
                const evaluatedContent = await evaluateExpression(writeArgParts[1].trim());

                await FileSystemManager.createOrUpdateFile(evaluatedPath, evaluatedContent, { currentUser: UserManager.getCurrentUser().name, primaryGroup: UserManager.getPrimaryGroupForUser(UserManager.getCurrentUser().name) });
                await FileSystemManager.save();
                break;
            default:
                throw new Error(`Syntax error: Unknown command '${command}'`);
        }
        return null;
    }

    // --- Public Interface ---
    return {
        loadProgram: (programText) => {
            program = {};
            variables = {};
            gosubStack = [];
            programText.split('\n').forEach(line => {
                if (line.trim()) {
                    const parsed = parseLine(line);
                    if (parsed) program[parsed.lineNumber] = parsed;
                }
            });
        },
        run: async (outputCb, inputCb) => {
            outputCallback = outputCb;
            inputCallback = inputCb;
            variables = {};
            gosubStack = [];

            const lineNumbers = Object.keys(program).map(Number).sort((a, b) => a - b);
            let pc = 0;

            while (pc < lineNumbers.length) {
                const currentLineNumber = lineNumbers[pc];
                const parsedLine = program[currentLineNumber];

                try {
                    const nextLineNumber = await executeStatement(parsedLine);
                    if (typeof nextLineNumber === 'string') {
                        outputCallback(nextLineNumber);
                        pc++;
                    } else if (nextLineNumber !== null) {
                        const nextPc = lineNumbers.indexOf(nextLineNumber);
                        if (nextPc === -1) throw new Error(`Runtime error: GOTO to non-existent line ${nextLineNumber}`);
                        pc = nextPc;
                    } else {
                        pc++;
                    }
                } catch (e) {
                    outputCallback(`ERROR IN LINE ${currentLineNumber}: ${e.message}`);
                    return;
                }
            }
        },
        getProgram: () => program,
        clearProgram: () => {
            program = {};
            variables = {};
            gosubStack = [];
        },
        parseLine,
    };
})();