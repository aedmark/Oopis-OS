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
    let program = {}; // LineNumber -> { statement, tokens }

    // --- Parser ---
    function parseLine(line) {
        const trimmedLine = line.trim();
        const parts = trimmedLine.match(/^(\d+)\s+(.*)$/);
        if (!parts) return null;

        const lineNumber = parseInt(parts[1], 10);
        const statement = parts[2].trim();
        const tokens = statement.match(/(?:[^\s"]+|"[^"]*")+/g) || [];
        const command = tokens[0]?.toUpperCase();

        return { lineNumber, command, statement, tokens };
    }

    // --- Execution Engine ---
    async function executeStatement(parsedLine) {
        const { command, tokens, statement } = parsedLine;
        const args = tokens.slice(1);

        switch (command) {
            case "REM":
                // Comment, do nothing
                break;
            case "PRINT":
                const printValue = evaluateExpression(args.join(" "));
                outputCallback(printValue);
                break;
            case "INPUT":
                const prompt = args.length > 1 ? evaluateExpression(args.slice(1).join(" ")) : "? ";
                const varName = args[0];
                if (!/^[A-Z]\$?$/.test(varName)) throw new Error(`Syntax error: Invalid variable name '${varName}'`);
                const inputValue = await inputCallback(prompt);
                variables[varName] = varName.endsWith('$') ? inputValue : parseFloat(inputValue);
                break;
            case "LET":
                const eqIndex = args.indexOf("=");
                if (eqIndex === -1) throw new Error("Syntax error: Missing '=' in LET statement");
                const letVar = args[eqIndex - 1];
                const letExpr = args.slice(eqIndex + 1).join(" ");
                variables[letVar] = evaluateExpression(letExpr);
                break;
            case "IF":
                const thenIndex = args.indexOf("THEN");
                if (thenIndex === -1) throw new Error("Syntax error: Missing THEN in IF statement");
                const condition = args.slice(0, thenIndex).join(" ");
                const action = args.slice(thenIndex + 1).join(" ");
                if (evaluateCondition(condition)) {
                    // Primitive support for GOTO in IF...THEN
                    if (action.toUpperCase().startsWith("GOTO")) {
                        const targetLine = parseInt(action.split(/\s+/)[1], 10);
                        return targetLine;
                    }
                }
                break;
            case "GOTO":
                return parseInt(args[0], 10);
            case "GOSUB":
                gosubStack.push(parsedLine.lineNumber);
                return parseInt(args[0], 10);
            case "RETURN":
                if (gosubStack.length === 0) throw new Error("Runtime error: RETURN without GOSUB");
                const returnToLine = gosubStack.pop();
                const lineNumbers = Object.keys(program).map(Number).sort((a, b) => a - b);
                const returnToIndex = lineNumbers.indexOf(returnToLine);
                return lineNumbers[returnToIndex + 1];
            case "SYS_CMD":
                const cmdResult = await CommandExecutor.processSingleCommand(evaluateExpression(args.join(" ")), { isInteractive: false });
                return cmdResult.output || cmdResult.error || "";
            case "SYS_READ":
                const filePathRead = evaluateExpression(args.join(" "));
                const fileNode = FileSystemManager.getNodeByPath(filePathRead);
                if (!fileNode) throw new Error(`Runtime error: File not found '${filePathRead}'`);
                return fileNode.content;
            case "SYS_WRITE":
                const [filePathWrite, ...contentParts] = args;
                const evaluatedPath = evaluateExpression(filePathWrite.replace(/,$/, ''));
                const evaluatedContent = evaluateExpression(contentParts.join(" "));
                await FileSystemManager.createOrUpdateFile(evaluatedPath, evaluatedContent, { currentUser: UserManager.getCurrentUser().name, primaryGroup: UserManager.getPrimaryGroupForUser(UserManager.getCurrentUser().name) });
                await FileSystemManager.save();
                break;
            default:
                throw new Error(`Syntax error: Unknown command '${command}'`);
        }
        return null; // Go to next line
    }

    function evaluateExpression(expr) {
        // String literal
        if (expr.startsWith('"') && expr.endsWith('"')) {
            return expr.slice(1, -1);
        }
        // Variable
        if (variables.hasOwnProperty(expr)) {
            return variables[expr];
        }
        // Basic string concatenation
        if (expr.includes('+')) {
            return expr.split('+').map(p => evaluateExpression(p.trim())).join('');
        }
        // Number literal
        const num = parseFloat(expr);
        if (!isNaN(num)) return num;
        return expr; // Return as is if un-evaluatable
    }

    function evaluateCondition(condition) {
        const parts = condition.match(/(.+?)\s*([=<>]+)\s*(.+)/);
        if (!parts) throw new Error("Syntax error in condition");
        const left = evaluateExpression(parts[1].trim());
        const op = parts[2];
        const right = evaluateExpression(parts[3].trim());
        switch (op) {
            case '=': return left == right;
            case '<>': return left != right;
            case '>': return left > right;
            case '<': return left < right;
            case '>=': return left >= right;
            case '<=': return left <= right;
            default: throw new Error(`Syntax error: Unknown operator '${op}'`);
        }
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
            let pc = 0; // Program counter index

            while (pc < lineNumbers.length) {
                const currentLineNumber = lineNumbers[pc];
                const parsedLine = program[currentLineNumber];

                try {
                    const nextLineNumber = await executeStatement(parsedLine);
                    if (typeof nextLineNumber === 'string') { // SYS_CMD and SYS_READ return strings
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
                    return; // Halt execution
                }
            }
        },
        getProgram: () => program,
        clearProgram: () => {
            program = {};
            variables = {};
            gosubStack = [];
        }
    };
})();