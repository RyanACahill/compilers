"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Lexer = void 0;
const Token_1 = require("./Token");
const TokenType_1 = require("./TokenType");
const Logger_1 = require("../util/Logger");
const ErrorReporter_1 = require("../util/ErrorReporter");
/**
 * Lexer converts source code into tokens while tracking both file-relative
 * and program-relative positions for all diagnostics.
 */
class Lexer {
    constructor() {
        this.tokens = [];
        this.errors = [];
        this.warnings = [];
    }
    /**
     * Lex one program.
     *
     * @param source The source code for this program.
     * @param startingFileLine The line number in the original file where this program begins.
     */
    lex(source, startingFileLine = 1) {
        this.tokens = [];
        this.errors = [];
        this.warnings = [];
        Logger_1.Logger.log("\nLEXER → Starting lexical analysis...\n");
        let i = 0;
        // Absolute position in the file
        let fileLine = startingFileLine;
        let fileColumn = 1;
        // Position relative to the current program
        let programLine = 1;
        let programColumn = 1;
        while (i < source.length) {
            const char = source[i];
            // Handle newlines
            if (char === "\n") {
                fileLine++;
                fileColumn = 1;
                programLine++;
                programColumn = 1;
                i++;
                continue;
            }
            // Ignore whitespace outside strings/comments
            if (/\s/.test(char)) {
                fileColumn++;
                programColumn++;
                i++;
                continue;
            }
            // Handle comment blocks
            if (char === "/" && source[i + 1] === "*") {
                const commentFileLine = fileLine;
                const commentFileColumn = fileColumn;
                const commentProgramLine = programLine;
                const commentProgramColumn = programColumn;
                i += 2;
                fileColumn += 2;
                programColumn += 2;
                while (i < source.length && !(source[i] === "*" && source[i + 1] === "/")) {
                    if (source[i] === "\n") {
                        fileLine++;
                        fileColumn = 1;
                        programLine++;
                        programColumn = 1;
                    }
                    else {
                        fileColumn++;
                        programColumn++;
                    }
                    i++;
                }
                if (i >= source.length) {
                    this.warning("Unterminated comment block. Reached end of input before finding '*/'.", commentFileLine, commentFileColumn, commentProgramLine, commentProgramColumn);
                    break;
                }
                i += 2;
                fileColumn += 2;
                programColumn += 2;
                continue;
            }
            switch (char) {
                case "{":
                    this.add(TokenType_1.TokenType.LBrace, char, fileLine, fileColumn);
                    break;
                case "}":
                    this.add(TokenType_1.TokenType.RBrace, char, fileLine, fileColumn);
                    break;
                case "(":
                    this.add(TokenType_1.TokenType.LParen, char, fileLine, fileColumn);
                    break;
                case ")":
                    this.add(TokenType_1.TokenType.RParen, char, fileLine, fileColumn);
                    break;
                case "+":
                    this.add(TokenType_1.TokenType.IntOp, char, fileLine, fileColumn);
                    break;
                case "$":
                    this.add(TokenType_1.TokenType.EOP, char, fileLine, fileColumn);
                    break;
                case "=":
                    if (source[i + 1] === "=") {
                        this.add(TokenType_1.TokenType.BoolOp, "==", fileLine, fileColumn);
                        i++;
                        fileColumn++;
                        programColumn++;
                    }
                    else {
                        this.add(TokenType_1.TokenType.Assign, "=", fileLine, fileColumn);
                    }
                    break;
                case "!":
                    if (source[i + 1] === "=") {
                        this.add(TokenType_1.TokenType.BoolOp, "!=", fileLine, fileColumn);
                        i++;
                        fileColumn++;
                        programColumn++;
                    }
                    else {
                        this.error("Unexpected '!'. Only '!=' is valid in this language.", fileLine, fileColumn, programLine, programColumn);
                    }
                    break;
                case "\"": {
                    const startFileLine = fileLine;
                    const startFileColumn = fileColumn;
                    const startProgramLine = programLine;
                    const startProgramColumn = programColumn;
                    let str = "";
                    i++;
                    fileColumn++;
                    programColumn++;
                    let terminated = false;
                    while (i < source.length) {
                        if (source[i] === "\"") {
                            terminated = true;
                            break;
                        }
                        if (source[i] === "\n") {
                            this.error("Unterminated string literal. Strings cannot span multiple lines.", startFileLine, startFileColumn, startProgramLine, startProgramColumn);
                            break;
                        }
                        if (!/[a-z ]/.test(source[i])) {
                            this.error(`Invalid character '${source[i]}' inside string literal. Only lowercase letters and spaces are allowed.`, fileLine, fileColumn, programLine, programColumn);
                        }
                        str += source[i];
                        i++;
                        fileColumn++;
                        programColumn++;
                    }
                    if (i >= source.length) {
                        this.error("Unterminated string literal. Reached end of input before finding closing quote.", startFileLine, startFileColumn, startProgramLine, startProgramColumn);
                        break;
                    }
                    if (terminated) {
                        this.add(TokenType_1.TokenType.StringLiteral, str, startFileLine, startFileColumn);
                    }
                    break;
                }
                default:
                    if (/[0-9]/.test(char)) {
                        this.add(TokenType_1.TokenType.Digit, char, fileLine, fileColumn);
                    }
                    else if (/[a-z]/.test(char)) {
                        let word = "";
                        const startFileColumn = fileColumn;
                        const startProgramColumn = programColumn;
                        while (i < source.length && /[a-z]/.test(source[i])) {
                            word += source[i];
                            i++;
                            fileColumn++;
                            programColumn++;
                        }
                        i--;
                        fileColumn--;
                        programColumn--;
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
                            this.add(keywords[word], word, fileLine, startFileColumn);
                        }
                        else if (word.length === 1) {
                            this.add(TokenType_1.TokenType.Id, word, fileLine, startFileColumn);
                        }
                        else {
                            this.error(`Invalid identifier '${word}'. Identifiers must be exactly one lowercase letter.`, fileLine, startFileColumn, programLine, startProgramColumn);
                        }
                    }
                    else {
                        this.error(`Illegal character '${char}'. This character is not part of the language grammar.`, fileLine, fileColumn, programLine, programColumn);
                    }
            }
            i++;
            fileColumn++;
            programColumn++;
        }
        if (!this.tokens.some((t) => t.type === TokenType_1.TokenType.EOP)) {
            this.warning("Missing end-of-program marker '$'. The lexer inserted one automatically.", fileLine, fileColumn, programLine, programColumn);
            this.add(TokenType_1.TokenType.EOP, "$", fileLine, fileColumn);
        }
        Logger_1.Logger.log(`\nLEXER → Completed with ${this.errors.length} error(s), ${this.warnings.length} warning(s).\n`);
        return {
            tokens: this.tokens,
            errors: this.errors,
            warnings: this.warnings,
            success: this.errors.length === 0
        };
    }
    /**
     * Create and store a token, then print it in verbose mode.
     * Tokens keep file-based positions, since those are the most useful later.
     */
    add(type, value, line, column) {
        const token = new Token_1.Token(type, value, line, column);
        this.tokens.push(token);
        Logger_1.Logger.log("LEXER → " + token.toString());
    }
    /**
     * Record a lexer error.
     */
    error(message, fileLine, fileColumn, programLine, programColumn) {
        const diagnostic = {
            kind: "ERROR",
            phase: "LEXER",
            message,
            fileLine,
            fileColumn,
            programLine,
            programColumn
        };
        this.errors.push(diagnostic);
        Logger_1.Logger.error(ErrorReporter_1.ErrorReporter.format(diagnostic));
    }
    /**
     * Record a lexer warning.
     */
    warning(message, fileLine, fileColumn, programLine, programColumn) {
        const diagnostic = {
            kind: "WARNING",
            phase: "LEXER",
            message,
            fileLine,
            fileColumn,
            programLine,
            programColumn
        };
        this.warnings.push(diagnostic);
        Logger_1.Logger.warning(ErrorReporter_1.ErrorReporter.format(diagnostic));
    }
}
exports.Lexer = Lexer;
//# sourceMappingURL=Lexer.js.map