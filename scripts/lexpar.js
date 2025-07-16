// lexpar.js - OopisOS Lexer/Parser Logic (Corrected)

const TokenType = {
  WORD: "WORD",
  STRING_DQ: "STRING_DQ",
  STRING_SQ: "STRING_SQ",
  OPERATOR_GT: "OPERATOR_GT", // >
  OPERATOR_GTGT: "OPERATOR_GTGT", // >>
  OPERATOR_LT: "OPERATOR_LT", // <
  OPERATOR_PIPE: "OPERATOR_PIPE",
  OPERATOR_SEMICOLON: "OPERATOR_SEMICOLON",
  OPERATOR_BG: "OPERATOR_BG",
  OPERATOR_AND: "OPERATOR_AND",
  OPERATOR_OR: "OPERATOR_OR",
  EOF: "EOF",
};

class Token {
  constructor(type, value, position) {
    this.type = type;
    this.value = value;
    this.position = position;
  }
}

class Lexer {
  constructor(input) {
    this.input = input;
    this.position = 0;
    this.tokens = [];
  }

  tokenize() {
    const specialChars = ['"', "'", ">", "<", "|", "&", ";"];
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
      if (char === "<") {
        this.tokens.push(new Token(TokenType.OPERATOR_LT, "<", this.position));
        this.position++;
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

      // *** CORRECTED WORD TOKENIZATION LOGIC ***
      let value = "";
      const startPos = this.position;
      while (this.position < this.input.length) {
        let innerChar = this.input[this.position];

        if (innerChar === '\\') {
          // Handle escaped characters
          this.position++; // Move past the backslash
          if (this.position < this.input.length) {
            value += this.input[this.position]; // Add the escaped character literally
            this.position++;
          } else {
            value += '\\'; // Dangling backslash at the end
          }
          continue; // Continue the loop to process the next character
        }

        // Check for terminators for an unquoted word
        if (/\s/.test(innerChar) || specialChars.includes(innerChar)) {
          break; // End of the word
        }

        // Regular character
        value += innerChar;
        this.position++;
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

  _tokenizeString(quoteChar) {
    const startPos = this.position;
    let value = "";
    this.position++; // Move past the opening quote
    while (this.position < this.input.length) {
      let char = this.input[this.position];
      if (char === '\\') {
        this.position++; // Consume the backslash
        if (this.position < this.input.length) {
          value += this.input[this.position];
          this.position++;
        } else {
          value += '\\'; // Append dangling backslash at the end of input
        }
      } else if (char === quoteChar) {
        this.position++;
        return new Token(quoteChar === '"' ? TokenType.STRING_DQ : TokenType.STRING_SQ, value, startPos);
      } else {
        value += char;
        this.position++;
      }
    }
    // If the loop finishes, the string was not closed.
    throw new Error(`Lexer Error: Unclosed string literal starting at position ${startPos}. Expected closing ${quoteChar}.`);
  }
}
class ParsedCommandSegment {
  constructor(command, args) {
    this.command = command;
    this.args = args;
  }
}

class ParsedPipeline {
  constructor() {
    this.segments = [];
    this.redirection = null; // Output redirection (>, >>)
    this.inputRedirectFile = null; // NEW: Input redirection (<)
    this.isBackground = false;
    this.jobId = null;
  }
}

class Parser {
  constructor(tokens) {
    this.tokens = tokens;
    this.position = 0;
  }

  _currentToken() {
    return this.tokens[this.position];
  }

  _nextToken() {
    if (this.position < this.tokens.length - 1) {
      this.position++;
    }
    return this._currentToken();
  }

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

  _parseSingleCommandSegment() {
    const terminators = [
      TokenType.EOF, TokenType.OPERATOR_PIPE, TokenType.OPERATOR_SEMICOLON,
      TokenType.OPERATOR_BG, TokenType.OPERATOR_AND, TokenType.OPERATOR_OR,
      TokenType.OPERATOR_GT, TokenType.OPERATOR_GTGT, TokenType.OPERATOR_LT
    ];
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

  _parseSinglePipeline() {
    const pipeline = new ParsedPipeline();

    if (this._currentToken().type === TokenType.OPERATOR_LT) {
      this._nextToken(); // consume '<'
      const fileToken = this._expectAndConsume(TokenType.WORD, true)
          || this._expectAndConsume(TokenType.STRING_DQ, true)
          || this._expectAndConsume(TokenType.STRING_SQ, true);
      if (!fileToken) {
        throw new Error("Parser Error: Expected filename after input redirection operator '<'.");
      }
      pipeline.inputRedirectFile = fileToken.value;
    }

    let currentSegment = this._parseSingleCommandSegment();
    if (currentSegment) {
      pipeline.segments.push(currentSegment);
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
        throw new Error(`Parser Error: Expected filename after redirection operator '${opToken.value}'.`);
      }
      pipeline.redirection = {
        type: opToken.type === TokenType.OPERATOR_GTGT ? "append" : "overwrite",
        file: fileToken.value,
      };
    }

    return pipeline.segments.length > 0 || pipeline.redirection || pipeline.inputRedirectFile ? pipeline : null;
  }

  parse() {
    const commandSequence = [];
    while (this._currentToken().type !== TokenType.EOF) {
      const pipeline = this._parseSinglePipeline();

      if (!pipeline) {
        if (![TokenType.EOF, TokenType.OPERATOR_SEMICOLON, TokenType.OPERATOR_BG, TokenType.OPERATOR_AND, TokenType.OPERATOR_OR].includes(this._currentToken().type)) {
          throw new Error(`Parser Error: Unexpected token '${this._currentToken().value}' at start of command.`);
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

      if (this._currentToken().type === TokenType.EOF && (operator === '&&' || operator === '||')) {
        throw new Error(`Parser Error: Command expected after '${operator}' operator.`);
      }
    }
    this._expectAndConsume(TokenType.EOF);
    return commandSequence;
  }
}