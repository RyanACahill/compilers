"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Lexer = void 0;
const Token_1 = require("./Token");
const TokenType_1 = require("./TokenType");
const Logger_1 = require("../util/Logger");
const ErrorReporter_1 = require("../util/ErrorReporter");
class Lexer {
    constructor() {
        this.tokens = [];
        this.errors = [];
        this.warnings = [];
    }
    lex(source) {
        this.tokens = [];
        this.errors = [];
        this.warnings = [];
        Logger_1.Logger.log("\nLEXER → Starting lexical analysis...\n");
        let i = 0;
        let line = 1;
        let column = 1;
        while (i < source.length) {
            const char = source[i];
            if (char === "\n") {
                line++;
                column = 1;
                i++;
                continue;
            }
            if (/\s/.test(char)) {
                column++;
                i++;
                continue;
            }
            if (char === "/" && source[i + 1] === "*") {
                const commentStartLine = line;
                const commentStartColumn = column;
                i += 2;
                column += 2;
                while (i < source.length && !(source[i] === "*" && source[i + 1] === "/")) {
                    if (source[i] === "\n") {
                        line++;
                        column = 1;
                    }
                    else {
                        column++;
                    }
                    i++;
                }
                if (i >= source.length) {
                    this.warning("Unterminated comment block. Reached end of input before finding '*/'.", commentStartLine, commentStartColumn);
                    break;
                }
                i += 2;
                column += 2;
                continue;
            }
            switch (char) {
                case "{":
                    this.add(TokenType_1.TokenType.LBrace, char, line, column);
                    break;
                case "}":
                    this.add(TokenType_1.TokenType.RBrace, char, line, column);
                    break;
                case "(":
                    this.add(TokenType_1.TokenType.LParen, char, line, column);
                    break;
                case ")":
                    this.add(TokenType_1.TokenType.RParen, char, line, column);
                    break;
                case "+":
                    this.add(TokenType_1.TokenType.IntOp, char, line, column);
                    break;
                case "$":
                    this.add(TokenType_1.TokenType.EOP, char, line, column);
                    break;
                case "=":
                    if (source[i + 1] === "=") {
                        this.add(TokenType_1.TokenType.BoolOp, "==", line, column);
                        i++;
                        column++;
                    }
                    else {
                        this.add(TokenType_1.TokenType.Assign, "=", line, column);
                    }
                    break;
                case "!":
                    if (source[i + 1] === "=") {
                        this.add(TokenType_1.TokenType.BoolOp, "!=", line, column);
                        i++;
                        column++;
                    }
                    else {
                        this.error("Unexpected '!'. Only '!=' is valid in this language.", line, column);
                    }
                    break;
                case "\"": {
                    const startLine = line;
                    const startColumn = column;
                    let str = "";
                    i++;
                    column++;
                    while (i < source.length && source[i] !== "\"") {
                        if (source[i] === "\n") {
                            this.error("Unterminated string literal. Strings cannot span multiple lines.", startLine, startColumn);
                            break;
                        }
                        if (!/[a-z ]/.test(source[i])) {
                            this.error(`Invalid character '${source[i]}' inside string literal. Only lowercase letters and spaces are allowed.`, line, column);
                        }
                        str += source[i];
                        i++;
                        column++;
                    }
                    if (i >= source.length) {
                        this.error("Unterminated string literal. Reached end of input before finding closing quote.", startLine, startColumn);
                        break;
                    }
                    if (source[i] === "\"") {
                        this.add(TokenType_1.TokenType.StringLiteral, str, startLine, startColumn);
                    }
                    break;
                }
                default:
                    if (/[0-9]/.test(char)) {
                        this.add(TokenType_1.TokenType.Digit, char, line, column);
                    }
                    else if (/[a-z]/.test(char)) {
                        let word = "";
                        const startCol = column;
                        while (i < source.length && /[a-z]/.test(source[i])) {
                            word += source[i];
                            i++;
                            column++;
                        }
                        i--;
                        column--;
                        const keywords = {
                            print: TokenType_1.TokenType.Print,
                            while: TokenType_1.TokenType.While,
                            if: TokenType_1.TokenType.If,
                            int: TokenType_1.TokenType.Type,
                            string: TokenType_1.TokenType.Type,
                            boolean: TokenType_1.TokenType.Type,
                            true: TokenType_1.TokenType.BoolVal,
                            false: TokenType_1.TokenType.BoolVal
                        };
                        if (keywords[word]) {
                            this.add(keywords[word], word, line, startCol);
                        }
                        else if (word.length === 1) {
                            this.add(TokenType_1.TokenType.Id, word, line, startCol);
                        }
                        else {
                            this.error(`Invalid identifier '${word}'. Identifiers must be exactly one lowercase letter.`, line, startCol);
                        }
                    }
                    else {
                        this.error(`Illegal character '${char}'. This character is not part of the language grammar.`, line, column);
                    }
            }
            i++;
            column++;
        }
        if (!this.tokens.some((t) => t.type === TokenType_1.TokenType.EOP)) {
            this.warning("Missing end-of-program marker '$'. The lexer inserted one automatically.", line, column);
            this.add(TokenType_1.TokenType.EOP, "$", line, column);
        }
        Logger_1.Logger.log(`\nLEXER → Completed with ${this.errors.length} error(s), ${this.warnings.length} warning(s).\n`);
        return {
            tokens: this.tokens,
            errors: this.errors,
            warnings: this.warnings,
            success: this.errors.length === 0
        };
    }
    add(type, value, line, column) {
        const token = new Token_1.Token(type, value, line, column);
        this.tokens.push(token);
        Logger_1.Logger.log("LEXER → " + token.toString());
    }
    error(message, line, column) {
        const diagnostic = {
            kind: "ERROR",
            phase: "LEXER",
            message,
            line,
            column
        };
        this.errors.push(diagnostic);
        Logger_1.Logger.error(ErrorReporter_1.ErrorReporter.format(diagnostic));
    }
    warning(message, line, column) {
        const diagnostic = {
            kind: "WARNING",
            phase: "LEXER",
            message,
            line,
            column
        };
        this.warnings.push(diagnostic);
        Logger_1.Logger.warning(ErrorReporter_1.ErrorReporter.format(diagnostic));
    }
}
exports.Lexer = Lexer;
//# sourceMappingURL=Lexer.js.map