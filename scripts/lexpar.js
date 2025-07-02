// lexpar.js - OopisOS Lexer/Parser Logic

/**
 * @file Implements the Lexer and Parser for the OopisOS command-line interface.
 * The Lexer breaks the raw input string into a sequence of tokens.
 * The Parser takes these tokens and builds a structured, executable representation of the command(s).
 * @module LexPar
 */

/**
 * An enumeration of the different types of tokens that the Lexer can produce.
 * @enum {string}
 */
const TokenType = {
  WORD: "WORD",
  STRING_DQ: "STRING_DQ",
  STRING_SQ: "STRING_SQ",
  OPERATOR_GT: "OPERATOR_GT",
  OPERATOR_GTGT: "OPERATOR_GTGT",
  OPERATOR_PIPE: "OPERATOR_PIPE",
  OPERATOR_SEMICOLON: "OPERATOR_SEMICOLON",
  OPERATOR_BG: "OPERATOR_BG",
  OPERATOR_AND: "OPERATOR_AND", // New
  OPERATOR_OR: "OPERATOR_OR",   // New
  EOF: "EOF",
};

/**
 * Represents a single token identified by the Lexer.
 */
class Token {
  /**
   * Creates an instance of a Token.
   * @param {TokenType} type - The type of the token.
   * @param {string|null} value - The actual string value of the token.
   * @param {number} position - The starting position of the token in the original input string.
   */
  constructor(type, value, position) {
    this.type = type;
    this.value = value;
    this.position = position;
  }
}

/**
 * The Lexer is responsible for turning a raw command-line string into an array of tokens.
 */
class Lexer {
  /**
   * Creates an instance of the Lexer.
   * @param {string} input - The raw command string to be tokenized.
   */
  constructor(input) {
    this.input = input;
    this.position = 0;
    this.tokens = [];
  }

  /**
   * Processes the entire input string and breaks it down into a sequence of tokens.
   * @returns {Token[]} An array of Token objects representing the input string.
   */
  tokenize() {
    const specialChars = ['"', "'", ">", "|", "&", ";"];
    while (this.position < this.input.length) {
      let char = this.input[this.position];
      if (/\s/.test(char)) {
        this.position++;
        continue;
      }
      if (char === '"') {
        this.tokens.push(this._tokenizeString('"'));
        continue;
      }
      if (char === "'") {
        this.tokens.push(this._tokenizeString("'"));
        continue;
      }
      if (char === ">") {
        if (this.input[this.position + 1] === ">") {
          this.tokens.push(new Token(TokenType.OPERATOR_GTGT, ">>", this.position));
          this.position += 2;
        } else {
          this.tokens.push(new Token(TokenType.OPERATOR_GT, ">", this.position));
          this.position++;
        }
        continue;
      }
      if (char === "|") {
        if (this.input[this.position + 1] === "|") {
          this.tokens.push(new Token(TokenType.OPERATOR_OR, "||", this.position));
          this.position += 2;
        } else {
          this.tokens.push(new Token(TokenType.OPERATOR_PIPE, "|", this.position));
          this.position++;
        }
        continue;
      }
      if (char === ";") {
        this.tokens.push(new Token(TokenType.OPERATOR_SEMICOLON, ";", this.position));
        this.position++;
        continue;
      }
      if (char === "&") {
        if (this.input[this.position + 1] === '&') {
          this.tokens.push(new Token(TokenType.OPERATOR_AND, '&&', this.position));
          this.position += 2;
        } else {
          this.tokens.push(new Token(TokenType.OPERATOR_BG, "&", this.position));
          this.position++;
        }
        continue;
      }
      let value = "";
      const startPos = this.position;
      while (this.position < this.input.length) {
        char = this.input[this.position];
        if (char === '\\') {
          this.position++;
          if (this.position < this.input.length) {
            value += this.input[this.position];
            this.position++;
          } else {
            value += '\\';
          }
        } else if (/\s/.test(char) || specialChars.includes(char)) {
          break;
        } else {
          value += char;
          this.position++;
        }
      }
      if (value) {
        this.tokens.push(new Token(TokenType.WORD, value, startPos));
      } else if (this.position < this.input.length && !specialChars.includes(this.input[this.position]) && !/\s/.test(this.input[this.position])) {
        throw new Error(`Lexer Error: Unhandled character '${this.input[this.position]}' at position ${this.position} after word processing.`);
      }
    }
    this.tokens.push(new Token(TokenType.EOF, null, this.position));
    return this.tokens;
  }

  /**
   * Handles the tokenization of a string literal enclosed in quotes.
   * @private
   * @param {string} quoteChar - The type of quote to look for ('"' or "'").
   * @returns {Token} The resulting string token.
   * @throws {Error} If the string is not properly closed.
   */
  _tokenizeString(quoteChar) {
    const startPos = this.position;
    let value = "";
    this.position++;
    while (this.position < this.input.length) {
      let char = this.input[this.position];
      if (char === '\\') {
        this.position++;
        if (this.position < this.input.length) {
          let nextChar = this.input[this.position];
          if (nextChar === quoteChar || nextChar === '\\') {
            value += nextChar;
          } else {
            value += '\\' + nextChar;
          }
          this.position++;
        } else {
          value += '\\';
        }
      } else if (char === quoteChar) {
        this.position++;
        return new Token(quoteChar === '"' ? TokenType.STRING_DQ : TokenType.STRING_SQ, value, startPos);
      } else {
        value += char;
        this.position++;
      }
    }
    throw new Error(`Lexer Error: Unclosed string literal starting at position ${startPos}. Expected closing ${quoteChar}.`);
  }
}

/**
 * A data structure representing a single command and its arguments.
 */
class ParsedCommandSegment {
  /**
   * Creates an instance of a ParsedCommandSegment.
   * @param {string} command - The name of the command.
   * @param {string[]} args - An array of arguments for the command.
   */
  constructor(command, args) {
    this.command = command;
    this.args = args;
  }
}

/**
 * A data structure representing a full command pipeline, which may include
 * multiple command segments, I/O redirection, and a background flag.
 */
class ParsedPipeline {
  constructor() {
    /** @type {ParsedCommandSegment[]} */
    this.segments = [];
    /** @type {{type: 'overwrite'|'append', file: string}|null} */
    this.redirection = null;
    /** @type {boolean} */
    this.isBackground = false;
    /** @type {number|null} */
    this.jobId = null;
  }
}

/**
 * The Parser takes a stream of tokens from the Lexer and constructs
 * a structured, hierarchical representation (an array of logical command groups).
 */
class Parser {
  /**
   * Creates an instance of the Parser.
   * @param {Token[]} tokens - An array of tokens from the Lexer.
   */
  constructor(tokens) {
    this.tokens = tokens;
    this.position = 0;
  }

  /**
   * Returns the token at the current parsing position.
   * @private
   * @returns {Token}
   */
  _currentToken() {
    return this.tokens[this.position];
  }

  /**
   * Advances the parser to the next token.
   * @private
   * @returns {Token} The new current token.
   */
  _nextToken() {
    if (this.position < this.tokens.length - 1) {
      this.position++;
    }
    return this._currentToken();
  }

  /**
   * Consumes the current token if it matches the expected type.
   * @private
   * @param {TokenType} tokenType - The expected type of the current token.
   * @param {boolean} [optional=false] - If true, does not throw an error if the token doesn't match.
   * @returns {Token|null} The consumed token, or null if optional and not found.
   * @throws {Error} If the token is not of the expected type and not optional.
   */
  _expectAndConsume(tokenType, optional = false) {
    const current = this._currentToken();
    if (current.type === tokenType) {
      this._nextToken();
      return current;
    }
    if (optional) {
      return null;
    }
    throw new Error(`Parser Error: Expected token ${tokenType} but got ${current.type} ('${current.value}') at input position ${current.position}.`);
  }

  /**
   * Parses a single command segment (e.g., "ls -la").
   * @private
   * @returns {ParsedCommandSegment|null} The parsed command segment, or null if no command is found.
   */
  _parseSingleCommandSegment() {
    const terminators = [TokenType.EOF, TokenType.OPERATOR_PIPE, TokenType.OPERATOR_SEMICOLON, TokenType.OPERATOR_BG, TokenType.OPERATOR_AND, TokenType.OPERATOR_OR, TokenType.OPERATOR_GT, TokenType.OPERATOR_GTGT];
    if (terminators.includes(this._currentToken().type)) {
      return null;
    }
    const cmdToken = this._expectAndConsume(TokenType.WORD);
    const command = cmdToken.value;
    const args = [];
    while (!terminators.includes(this._currentToken().type)) {
      const argToken = this._currentToken();
      if (argToken.type === TokenType.WORD || argToken.type === TokenType.STRING_DQ || argToken.type === TokenType.STRING_SQ) {
        args.push(argToken.value);
        this._nextToken();
      } else {
        throw new Error(`Parser Error: Unexpected token ${argToken.type} ('${argToken.value}') in arguments at position ${argToken.position}. Expected WORD or STRING.`);
      }
    }
    return new ParsedCommandSegment(command, args);
  }

  /**
   * Parses a complete command pipeline, including pipes and redirection.
   * @private
   * @returns {ParsedPipeline|null} The parsed pipeline, or null if the pipeline is empty.
   */
  _parseSinglePipeline() {
    const pipeline = new ParsedPipeline();
    let currentSegment = this._parseSingleCommandSegment();
    if (currentSegment) {
      pipeline.segments.push(currentSegment);
    } else if (![TokenType.EOF, TokenType.OPERATOR_SEMICOLON, TokenType.OPERATOR_BG, TokenType.OPERATOR_AND, TokenType.OPERATOR_OR].includes(this._currentToken().type)) {
      throw new Error(`Parser Error: Expected command at start of pipeline, but found ${this._currentToken().type}.`);
    }

    while (this._currentToken().type === TokenType.OPERATOR_PIPE) {
      this._nextToken();
      currentSegment = this._parseSingleCommandSegment();
      if (!currentSegment) {
        throw new Error("Parser Error: Expected command after pipe operator '|'.");
      }
      pipeline.segments.push(currentSegment);
    }

    if (this._currentToken().type === TokenType.OPERATOR_GT || this._currentToken().type === TokenType.OPERATOR_GTGT) {
      const opToken = this._currentToken();
      this._nextToken();
      const fileToken = this._expectAndConsume(TokenType.WORD, true) || this._expectAndConsume(TokenType.STRING_DQ, true) || this._expectAndConsume(TokenType.STRING_SQ, true);
      if (!fileToken) {
        throw new Error(`Parser Error: Expected filename (WORD or STRING) after redirection operator '${opToken.value}'. Got ${this._currentToken().type}.`);
      }
      pipeline.redirection = {
        type: opToken.type === TokenType.OPERATOR_GTGT ? "append" : "overwrite",
        file: fileToken.value,
      };
    }

    return pipeline.segments.length > 0 || pipeline.redirection ? pipeline : null;
  }

  /**
   * The main parsing method. It processes the entire token stream and creates a
   * sequence of pipelines and their connecting operators.
   * @returns {Array<{pipeline: ParsedPipeline, operator: string|null}>} An array of pipeline-operator groups.
   */
  parse() {
    const commandSequence = [];
    while (this._currentToken().type !== TokenType.EOF) {
      const pipeline = this._parseSinglePipeline();
      if (!pipeline) {
        if ([TokenType.OPERATOR_AND, TokenType.OPERATOR_OR, TokenType.OPERATOR_SEMICOLON, TokenType.OPERATOR_BG].includes(this._currentToken().type)) {
          throw new Error(`Parser Error: Unexpected operator '${this._currentToken().value}' at start of command.`);
        }
        break;
      }

      let operator = null;
      const currentToken = this._currentToken();
      if ([TokenType.OPERATOR_AND, TokenType.OPERATOR_OR, TokenType.OPERATOR_SEMICOLON, TokenType.OPERATOR_BG].includes(currentToken.type)) {
        operator = currentToken.value;
        this._nextToken();
      }

      commandSequence.push({ pipeline, operator });

      // A command is required after '&&' or '||', but not after '&' or ';'.
      if (this._currentToken().type === TokenType.EOF && (operator === '&&' || operator === '||')) {
        throw new Error(`Parser Error: Command expected after '${operator}' operator.`);
      }
    }
    this._expectAndConsume(TokenType.EOF);
    return commandSequence;
  }
}