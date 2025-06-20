// lexpar.js - OopisOS Lexer/Parser Logic

const TokenType = {
  WORD: "WORD",
  STRING_DQ: "STRING_DQ",
  STRING_SQ: "STRING_SQ",
  OPERATOR_GT: "OPERATOR_GT",
  OPERATOR_GTGT: "OPERATOR_GTGT",
  OPERATOR_PIPE: "OPERATOR_PIPE",
  OPERATOR_SEMICOLON: "OPERATOR_SEMICOLON",
  OPERATOR_BG: "OPERATOR_BG",
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
    const specialChars = ['"', "'", ">", "|", "&", ";"];
    while(this.position < this.input.length) {
      let char = this.input[this.position];
      if(/\s/.test(char)) {
        this.position++;
        continue;
      }
      if(char === '"') {
        this.tokens.push(this._tokenizeString('"'));
        continue;
      }
      if(char === "'") {
        this.tokens.push(this._tokenizeString("'"));
        continue;
      }
      if(char === ">") {
        if(this.input[this.position + 1] === ">") {
          this.tokens.push(new Token(TokenType.OPERATOR_GTGT, ">>", this.position));
          this.position += 2;
        } else {
          this.tokens.push(new Token(TokenType.OPERATOR_GT, ">", this.position));
          this.position++;
        }
        continue;
      }
      if(char === "|") {
        this.tokens.push(new Token(TokenType.OPERATOR_PIPE, "|", this.position));
        this.position++;
        continue;
      }
      if(char === ";") {
        this.tokens.push(new Token(TokenType.OPERATOR_SEMICOLON, ";", this.position));
        this.position++;
        continue;
      }
      if(char === "&") {
        this.tokens.push(new Token(TokenType.OPERATOR_BG, "&", this.position));
        this.position++;
        continue;
      }
      let value = "";
      const startPos = this.position;
      while(this.position < this.input.length) {
        char = this.input[this.position];
        if(char === '\\') {
          this.position++;
          if(this.position < this.input.length) {
            value += this.input[this.position];
            this.position++;
          } else {
            value += '\\';
          }
        } else if(/\s/.test(char) || specialChars.includes(char)) {
          break;
        } else {
          value += char;
          this.position++;
        }
      }
      if(value) {
        this.tokens.push(new Token(TokenType.WORD, value, startPos));
      } else if(this.position < this.input.length && !specialChars.includes(this.input[this.position]) && !/\s/.test(this.input[this.position])) {
        throw new Error(`Lexer Error: Unhandled character '${this.input[this.position]}' at position ${this.position} after word processing.`);
      }
    }
    this.tokens.push(new Token(TokenType.EOF, null, this.position));
    return this.tokens;
  }
  _tokenizeString(quoteChar) {
    const startPos = this.position;
    let value = "";
    this.position++;
    while(this.position < this.input.length) {
      let char = this.input[this.position];
      if(char === '\\') {
        this.position++;
        if(this.position < this.input.length) {
          let nextChar = this.input[this.position];
          if(nextChar === quoteChar || nextChar === '\\') {
            value += nextChar;
          } else {
            value += '\\' + nextChar;
          }
          this.position++;
        } else {
          value += '\\';
        }
      } else if(char === quoteChar) {
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
class ParsedCommandSegment {
  constructor(command, args) {
    this.command = command;
    this.args = args;
  }
}
class ParsedPipeline {
  constructor() {
    this.segments = [];
    this.redirection = null;
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
    if(this.position < this.tokens.length - 1) {
      this.position++;
    }
    return this._currentToken();
  }
  _expectAndConsume(tokenType, optional = false) {
    const current = this._currentToken();
    if(current.type === tokenType) {
      this._nextToken();
      return current;
    }
    if(optional) {
      return null;
    }
    throw new Error(`Parser Error: Expected token ${tokenType} but got ${current.type} ('${current.value}') at input position ${current.position}.`);
  }
  _parseSingleCommandSegment() {
    const currentTokenType = this._currentToken().type;
    if(currentTokenType === TokenType.EOF || currentTokenType === TokenType.OPERATOR_PIPE || currentTokenType === TokenType.OPERATOR_SEMICOLON || currentTokenType === TokenType.OPERATOR_BG) {
      return null;
    }
    const cmdToken = this._expectAndConsume(TokenType.WORD);
    const command = cmdToken.value;
    const args = [];
    while(this._currentToken().type !== TokenType.EOF && this._currentToken().type !== TokenType.OPERATOR_PIPE && this._currentToken().type !== TokenType.OPERATOR_SEMICOLON && this._currentToken().type !== TokenType.OPERATOR_GT && this._currentToken().type !== TokenType.OPERATOR_GTGT && this._currentToken().type !== TokenType.OPERATOR_BG) {
      const argToken = this._currentToken();
      if(argToken.type === TokenType.WORD || argToken.type === TokenType.STRING_DQ || argToken.type === TokenType.STRING_SQ) {
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
    let currentSegment = this._parseSingleCommandSegment();
    if(currentSegment) {
      pipeline.segments.push(currentSegment);
    } else if(this._currentToken().type !== TokenType.EOF && this._currentToken().type !== TokenType.OPERATOR_SEMICOLON && this._currentToken().type !== TokenType.OPERATOR_BG) {
      throw new Error(`Parser Error: Expected command at start of pipeline, but found ${this._currentToken().type}.`);
    }
    while(this._currentToken().type === TokenType.OPERATOR_PIPE) {
      this._nextToken();
      currentSegment = this._parseSingleCommandSegment();
      if(!currentSegment) {
        throw new Error("Parser Error: Expected command after pipe operator '|'.");
      }
      pipeline.segments.push(currentSegment);
    }
    if(this._currentToken().type === TokenType.OPERATOR_GT || this._currentToken().type === TokenType.OPERATOR_GTGT) {
      const opToken = this._currentToken();
      this._nextToken();
      const fileToken = this._expectAndConsume(TokenType.WORD, true) || this._expectAndConsume(TokenType.STRING_DQ, true) || this._expectAndConsume(TokenType.STRING_SQ, true);
      if(!fileToken) {
        throw new Error(`Parser Error: Expected filename (WORD or STRING) after redirection operator '${opToken.value}'. Got ${this._currentToken().type}.`);
      }
      pipeline.redirection = {
        type: opToken.type === TokenType.OPERATOR_GTGT ? "append" : "overwrite",
        file: fileToken.value,
      };
    }
    if(this._currentToken().type === TokenType.OPERATOR_BG) {
      const nextSignificantToken = this.tokens[this.position + 1];
      if(nextSignificantToken.type !== TokenType.EOF && nextSignificantToken.type !== TokenType.OPERATOR_SEMICOLON) {
        throw new Error("Parser Error: Background operator '&' must be at the end of a command or before a semicolon.");
      }
      pipeline.isBackground = true;
      this._nextToken();
    }
    return(pipeline.segments.length > 0 || pipeline.redirection || pipeline.isBackground) ? pipeline : null;
  }
  parse() {
    const allPipelines = [];
    while(this._currentToken().type !== TokenType.EOF) {
      const pipeline = this._parseSinglePipeline();
      if(pipeline) {
        allPipelines.push(pipeline);
      } else if(this._currentToken().type === TokenType.EOF) {
        break;
      } else if(this._currentToken().type !== TokenType.OPERATOR_SEMICOLON) {
        throw new Error(`Parser Error: Unexpected token ${this._currentToken().type} ('${this._currentToken().value}') when expecting start of a command or semicolon.`);
      }
      if(this._currentToken().type === TokenType.OPERATOR_SEMICOLON) {
        this._nextToken();
        if(this._currentToken().type === TokenType.EOF) {
          if(allPipelines.length === 0) {
            allPipelines.push(new ParsedPipeline());
          }
          break;
        }
      } else if(this._currentToken().type !== TokenType.EOF) {
        throw new Error(`Parser Error: Unexpected token ${this._currentToken().type} ('${this._currentToken().value}') after a command pipeline. Expected ';' or end of input.`);
      }
    }
    this._expectAndConsume(TokenType.EOF);
    if(allPipelines.length === 0 && this.tokens.length === 1 && this.tokens[0].type === TokenType.EOF) {
      return [];
    }
    if(allPipelines.length === 0) {}
    return allPipelines;
  }
}