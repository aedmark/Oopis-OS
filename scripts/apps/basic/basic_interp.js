// scripts/apps/basic/basic_interp.js

/**
 * BASIC Language Interpreter - Executes BASIC programs with extended system functions
 * @class Basic_interp
 */
window.Basic_interp = class Basic_interp {
  /**
   * Create a BASIC interpreter instance
   * @param {Object} dependencies - Required dependencies for system functions
   */
  constructor(dependencies) {
    /** @type {Object} Injected dependencies */
    this.dependencies = dependencies;
    /** @type {Map} Variable storage */
    this.variables = new Map();
    /** @type {Map} Array storage */
    this.arrays = new Map();
    /** @type {Array} GOSUB return stack */
    this.gosubStack = [];
    /** @type {Array} FOR loop stack */
    this.forLoopStack = [];
    /** @type {Map} Program lines storage */
    this.program = new Map();
    /** @type {Array} DATA statement values */
    this.data = [];
    /** @type {number} Current DATA pointer */
    this.dataPointer = 0;
    /** @type {number|null} Current program line */
    this.programCounter = null;
    /** @type {Function} Output callback function */
    this.outputCallback = (text) => console.log(text);
    /** @type {Function} Input callback function */
    this.inputCallback = async () => "? ";
    /** @type {Function} Screen poke callback function */
    this.pokeCallback = (_x, _y, _char, _color) => {};
    /** @type {number} Last random number generated */
    this.lastRnd = Math.random();
    /** @type {number} Random number seed */
    this.rndSeed = new Date().getTime();
  }

  /**
   * Initialize interpreter state
   * @private
   */
  _initializeState() {
    this.variables.clear();
    this.arrays.clear();
    this.gosubStack = [];
    this.forLoopStack = [];
    this.program.clear();
    this.data = [];
    this.dataPointer = 0;
    this.programCounter = null;
  }

  /**
   * Pre-scan program for DATA statements
   * @private
   */
  _preScanForData() {
    this.data = [];
    const sortedLines = Array.from(this.program.keys()).sort((a, b) => a - b);
    for (const lineNum of sortedLines) {
      const statement = this.program.get(lineNum);
      const match = statement.match(/^DATA\s+(.*)/i);
      if (match) {
        const values = match[1].split(",").map((v) => {
          const trimmed = v.trim();
          if (trimmed.startsWith('"') && trimmed.endsWith('"')) {
            return trimmed.substring(1, trimmed.length - 1);
          }
          return parseFloat(trimmed);
        });
        this.data.push(...values);
      }
    }
  }

  /**
   * Parse program text into line-numbered statements
   * @private
   * @param {string} programText - BASIC program source code
   */
  _parseProgram(programText) {
    const lines = programText.split("\n");
    let firstLine = Infinity;
    for (const line of lines) {
      if (line.trim() === "") continue;
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

  /**
   * Run a BASIC program
   * @param {string} programText - BASIC program source code
   * @param {Object} callbacks - Callback functions
   * @param {Function} callbacks.outputCallback - Output function
   * @param {Function} callbacks.inputCallback - Input function
   * @param {Function} callbacks.pokeCallback - Screen poke function
   */
  async run(programText, { outputCallback, inputCallback, pokeCallback }) {
    this._initializeState();
    this.outputCallback = outputCallback;
    this.inputCallback = inputCallback;
    this.pokeCallback = pokeCallback;
    this._parseProgram(programText);
    this._preScanForData();
    const sortedLines = Array.from(this.program.keys()).sort((a, b) => a - b);
    if (this.programCounter === null) return;

    let currentIndex = sortedLines.indexOf(this.programCounter);
    const MAX_STEPS_PER_YIELD = 1000;
    let stepCounter = 0;

    while (currentIndex < sortedLines.length && currentIndex > -1) {
      this.programCounter = sortedLines[currentIndex];
      const pcBeforeExecute = this.programCounter;
      const statement = this.program.get(this.programCounter);
      await this.executeStatement(statement);

      if (this.programCounter === null) break;

      if (this.programCounter !== pcBeforeExecute) {
        const newIndex = sortedLines.indexOf(this.programCounter);
        if (newIndex === -1) {
          this.outputCallback(`\nError: GOTO/GOSUB to non-existent line ${this.programCounter}`);
          return;
        }
        currentIndex = newIndex;
      } else {
        currentIndex++;
      }
      stepCounter++;
      if (stepCounter >= MAX_STEPS_PER_YIELD) {
        await new Promise((resolve) => setTimeout(resolve, 0));
        stepCounter = 0;
      }
    }
  }

  /**
   * Parse function arguments from a statement
   * @private
   * @param {string} statement - Function call statement
   * @returns {Array<string>} Array of argument strings
   */
  _parseFunctionArgs(statement) {
    const openParen = statement.indexOf("(");
    const closeParen = statement.lastIndexOf(")");
    if (openParen === -1 || closeParen === -1) return [];

    const argsStr = statement.substring(openParen + 1, closeParen);
    const args = [];
    let inQuote = false;
    let currentArg = "";

    for (let i = 0; i < argsStr.length; i++) {
      const char = argsStr[i];
      if (char === '"') inQuote = !inQuote;
      if (char === "," && !inQuote) {
        args.push(currentArg.trim());
        currentArg = "";
      } else {
        currentArg += char;
      }
    }
    args.push(currentArg.trim());
    return args;
  }

  /**
   * Execute a single BASIC statement
   * @param {string} statement - BASIC statement to execute
   */
  async executeStatement(statement) {
    const { FileSystemManager, UserManager } = this.dependencies;
    const match = statement.match(/^([a-zA-Z_][a-zA-Z_0-9$]*)\s*(.*)/s);

    if (!match) {
      if (statement.includes("=")) {
        await this.executeStatement(`LET ${statement}`);
      } else if (statement.trim()) {
        throw new Error(`Syntax Error: Invalid statement format '${statement}'`);
      }
      return;
    }

    const command = match[1].toUpperCase();
    const rest = match[2].trim();

    switch (command) {
      case "PRINT": {
        const valueToPrint = await this._evaluateExpression(rest);
        this.outputCallback(valueToPrint);
        break;
      }
      case "LET": {
        const eqIndex = rest.indexOf("=");
        const varNameStr = rest.substring(0, eqIndex).trim();
        const expr = rest.substring(eqIndex + 1).trim();
        const valueToLet = await this._evaluateExpression(expr);
        const arrayMatch = varNameStr.match(/([a-zA-Z_][a-zA-Z_0-9$]*)\((.*)\)/);
        if (arrayMatch) {
          const arrayName = arrayMatch[1].toUpperCase();
          const index = await this._evaluateExpression(arrayMatch[2]);
          if (!this.arrays.has(arrayName)) throw new Error(`Array not dimensioned: ${arrayName}`);
          const arr = this.arrays.get(arrayName);
          if (index < 0 || index >= arr.length) throw new Error(`Index out of bounds for ${arrayName}: ${index}`);
          arr[index] = valueToLet;
        } else {
          this.variables.set(varNameStr.toUpperCase(), valueToLet);
        }
        break;
      }
      case "INPUT": {
        let restOfStatement = rest;
        let prompt = "? ";
        if (restOfStatement.startsWith('"')) {
          const endQuoteIndex = restOfStatement.indexOf('"', 1);
          if (endQuoteIndex !== -1) {
            prompt = restOfStatement.substring(1, endQuoteIndex) + " ";
            restOfStatement = restOfStatement.substring(endQuoteIndex + 1).trim();
            if (restOfStatement.startsWith(",")) restOfStatement = restOfStatement.substring(1).trim();
          }
        }
        const varNames = restOfStatement.split(",").map((v) => v.trim());
        for (let i = 0; i < varNames.length; i++) {
          const vName = varNames[i];
          if (!vName) continue;
          const currentPrompt = i === 0 ? prompt : "? ";
          this.outputCallback(currentPrompt, false);
          const userInput = await this.inputCallback();
          const isStringVariable = vName.endsWith("$");
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
      case "GOTO": this.programCounter = parseInt(rest, 10); break;
      case "IF": {
        const thenIndex = rest.toUpperCase().indexOf("THEN");
        const conditionPart = rest.substring(0, thenIndex).trim();
        const actionPart = rest.substring(thenIndex + 4).trim();
        if (await this._evaluateCondition(conditionPart)) {
          await this.executeStatement(actionPart);
        }
        break;
      }
      case "GOSUB": {
        const sortedLines = Array.from(this.program.keys()).sort((a, b) => a - b);
        const currentIndex = sortedLines.indexOf(this.programCounter);
        const nextLine = sortedLines[currentIndex + 1];
        this.gosubStack.push(nextLine || null);
        this.programCounter = parseInt(rest, 10);
        break;
      }
      case "RETURN":
        if (this.gosubStack.length === 0) throw new Error("RETURN without GOSUB");
        this.programCounter = this.gosubStack.pop();
        break;
      case "FOR": {
        const toIndex = rest.toUpperCase().indexOf("TO");
        const stepIndex = rest.toUpperCase().indexOf("STEP");
        const varPart = rest.substring(0, rest.indexOf("=")).trim();
        const startExpr = rest.substring(rest.indexOf("=") + 1, toIndex).trim();
        const endExpr = rest.substring(toIndex + 2, stepIndex > -1 ? stepIndex : rest.length).trim();
        const stepExpr = stepIndex > -1 ? rest.substring(stepIndex + 4).trim() : "1";
        const startVal = await this._evaluateExpression(startExpr);
        const endVal = await this._evaluateExpression(endExpr);
        const stepVal = await this._evaluateExpression(stepExpr);
        this.variables.set(varPart.toUpperCase(), startVal);
        this.forLoopStack.push({ variable: varPart.toUpperCase(), end: endVal, step: stepVal, startLine: this.programCounter });
        break;
      }
      case "NEXT": {
        if (this.forLoopStack.length === 0) throw new Error("NEXT without FOR");
        const loop = this.forLoopStack[this.forLoopStack.length - 1];
        const nextVar = rest ? rest.toUpperCase() : null;
        if (nextVar && nextVar !== loop.variable) throw new Error(`NEXT without FOR: expected ${loop.variable} but got ${nextVar}`);
        let currentVal = this.variables.get(loop.variable);
        currentVal += loop.step;
        this.variables.set(loop.variable, currentVal);
        const finished = loop.step > 0 ? currentVal > loop.end : currentVal < loop.end;
        if (!finished) {
          const sortedLines = Array.from(this.program.keys()).sort((a, b) => a - b);
          const forIndex = sortedLines.indexOf(loop.startLine);
          this.programCounter = sortedLines[forIndex + 1];
        } else {
          this.forLoopStack.pop();
        }
        break;
      }
      case "DIM": {
        const dimMatch = rest.match(/([a-zA-Z_][a-zA-Z_0-9$]*)\((.*)\)/);
        if (!dimMatch) throw new Error(`Syntax Error in DIM: ${rest}`);
        const arrayName = dimMatch[1].toUpperCase();
        const size = await this._evaluateExpression(dimMatch[2]);
        if (size < 0) throw new Error("Array size cannot be negative");
        const isStringArray = arrayName.endsWith("$");
        this.arrays.set(arrayName, new Array(size + 1).fill(isStringArray ? "" : 0));
        break;
      }
      case "DATA": break;
      case "READ": {
        const varNames = rest.split(",").map((v) => v.trim());
        for (const varName of varNames) {
          if (this.dataPointer >= this.data.length) throw new Error("Out of DATA");
          const dataValue = this.data[this.dataPointer++];
          const isStringVariable = varName.endsWith("$");
          if ((isStringVariable && typeof dataValue !== "string") || (!isStringVariable && typeof dataValue !== "number")) {
            throw new Error("Type mismatch in READ");
          }
          this.variables.set(varName.toUpperCase(), dataValue);
        }
        break;
      }
      case "RESTORE": this.dataPointer = 0; break;
      case "SYS_POKE": {
        const args = this._parseFunctionArgs(rest);
        if (args.length !== 4) throw new Error("SYS_POKE requires 4 arguments: x, y, char, color");
        const x = await this._evaluateExpression(args[0]);
        const y = await this._evaluateExpression(args[1]);
        const char = await this._evaluateExpression(args[2]);
        const color = await this._evaluateExpression(args[3]);
        if (this.pokeCallback) this.pokeCallback(x, y, String(char), color);
        break;
      }
      case "SYS_WRITE": {
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
      case "REM": break;
      case "END": this.programCounter = null; break;
      default: throw new Error(`Syntax Error: Unknown command '${command}'`);
    }
  }

  /**
   * Evaluate a BASIC expression
   * @private
   * @param {string} expression - Expression to evaluate
   * @returns {Promise<*>} Evaluated result
   */
  async _evaluateExpression(expression) {
    const { CommandExecutor, FileSystemManager, UserManager, NetworkManager } = this.dependencies;
    const functionMatch = expression.match(/([a-zA-Z_$]+)\((.*)\)/i);
    if (functionMatch) {
      const funcName = functionMatch[1].toUpperCase();
      const argExpr = functionMatch[2];

      switch (funcName) {
        case "SQR": return Math.sqrt(await this._evaluateExpression(argExpr));
        case "SIN": return Math.sin(await this._evaluateExpression(argExpr));
        case "COS": return Math.cos(await this._evaluateExpression(argExpr));
        case "RND":
          const arg = await this._evaluateExpression(argExpr);
          if (arg > 0) this.lastRnd = Math.random();
          else if (arg < 0) {
            this.rndSeed = Math.abs(arg);
            this.lastRnd = (((this.rndSeed * 1103515245 + 12345) / 65536) % 32768) / 32768.0;
          }
          return this.lastRnd;
        case "LEFT$": case "RIGHT$": case "MID$":
          const args = argExpr.split(",").map((a) => a.trim());
          const str = String(await this._evaluateExpression(args[0]));
          const len = args.length > 1 ? await this._evaluateExpression(args[1]) : undefined;
          if (funcName === "LEFT$") return str.substring(0, len);
          if (funcName === "RIGHT$") return str.substring(str.length - len);
          if (funcName === "MID$") {
            const start = len - 1;
            const midLen = args.length > 2 ? await this._evaluateExpression(args[2]) : undefined;
            return str.substring(start, midLen ? start + midLen : undefined);
          }
          break;
        case "SYS_CMD":
          const cmd = await this._evaluateExpression(argExpr);
          const result = await CommandExecutor.processSingleCommand(cmd, { isInteractive: false });
          return result.output || "";
        case "SYS_READ":
          const path = await this._evaluateExpression(argExpr);
          const pathValidation = FileSystemManager.validatePath(path, { expectedType: "file" });
          if (pathValidation.error) throw new Error(pathValidation.error);
          if (!FileSystemManager.hasPermission(pathValidation.node, UserManager.getCurrentUser().name, "read")) throw new Error("Permission denied");
          return pathValidation.node.content || "";
        case "SYS_NET_SEND":
          const netSendArgs = this._parseFunctionArgs(argExpr);
          if (netSendArgs.length !== 2) throw new Error("SYS_NET_SEND requires 2 arguments: targetId$, message$");
          const targetId = await this._evaluateExpression(netSendArgs[0]);
          const message = await this._evaluateExpression(netSendArgs[1]);
          await NetworkManager.sendMessage(targetId, 'direct_message', message);
          return 0; // Return 0 for success
      }
    }

    // New SYS_NET_RECV$ check (no arguments)
    if (expression.trim().toUpperCase() === 'SYS_NET_RECV$()') {
      const msg = NetworkManager.getNextMessage();
      return msg ? msg.data : "";
    }

    const arrayMatch = expression.match(/([a-zA-Z_][a-zA-Z_0-9$]*)\((.*)\)/);
    if (arrayMatch) {
      const arrayName = arrayMatch[1].toUpperCase();
      const index = await this._evaluateExpression(arrayMatch[2]);
      if (!this.arrays.has(arrayName)) throw new Error(`Array not dimensioned: ${arrayName}`);
      const arr = this.arrays.get(arrayName);
      if (index < 0 || index >= arr.length) throw new Error(`Index out of bounds for ${arrayName}: ${index}`);
      return arr[index];
    }

    const parts = expression.split("+").map((p) => p.trim());
    if (parts.length > 1) {
      let isStringConcat = false;
      const evaluatedParts = await Promise.all(parts.map((p) => this._evaluateSinglePart(p)));
      if (evaluatedParts.some((p) => typeof p === "string")) isStringConcat = true;
      if (isStringConcat) {
        return evaluatedParts.map(String).join("");
      } else {
        return evaluatedParts.reduce((acc, val) => acc + val, 0);
      }
    } else {
      return this._evaluateSinglePart(expression);
    }
  }

  /**
   * Evaluate a single part of an expression
   * @private
   * @param {string} part - Expression part to evaluate
   * @returns {Promise<*>} Evaluated result
   */
  async _evaluateSinglePart(part) {
    part = part.trim();
    if (part.startsWith('"') && part.endsWith('"')) return part.substring(1, part.length - 1);
    const varName = part.toUpperCase();
    if (this.variables.has(varName)) return this.variables.get(varName);
    const arrayMatch = varName.match(/([a-zA-Z_][a-zA-Z_0-9$]*)\((.*)\)/);
    if (arrayMatch) {
      const arrayName = arrayMatch[1];
      const index = await this._evaluateExpression(arrayMatch[2]);
      if (!this.arrays.has(arrayName)) throw new Error(`Array not dimensioned: ${arrayName}`);
      const arr = this.arrays.get(arrayName);
      if (index < 0 || index >= arr.length) throw new Error(`Index out of bounds for ${arrayName}: ${index}`);
      return arr[index];
    }
    const num = parseFloat(part);
    if (!isNaN(num) && part.trim() !== "") return num;
    return part;
  }

  /**
   * Evaluate a conditional expression
   * @private
   * @param {string} condition - Condition to evaluate
   * @returns {Promise<boolean>} True if condition is met
   */
  async _evaluateCondition(condition) {
    const operators = ["<=", ">=", "<>", "<", ">", "="];
    let operator = null;
    for (const op of operators) {
      if (condition.includes(op)) {
        operator = op;
        break;
      }
    }
    if (!operator) return false;
    const parts = condition.split(operator).map((p) => p.trim());
    const left = await this._evaluateExpression(parts[0]);
    const right = await this._evaluateExpression(parts[1]);
    switch (operator) {
      case "=": return left === right;
      case "<>": return left !== right;
      case "<": return left < right;
      case ">": return left > right;
      case "<=": return left <= right;
      case ">=": return left >= right;
      default: return false;
    }
  }
}
