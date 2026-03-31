import { Token } from "./Token";
import { TokenType } from "./TokenType";
import { Logger } from "../util/Logger";
import { Diagnostic, ErrorReporter } from "../util/ErrorReporter";

/**
 * LexResult stores the full result of lexing one program.
 */
export interface LexResult {
    tokens: Token[];
    errors: Diagnostic[];
    warnings: Diagnostic[];
    success: boolean;
}

/**
 * Lexer converts source code into tokens while tracking both file-relative
 * and program-relative positions for all diagnostics.
 */
export class Lexer {
    private tokens: Token[] = [];
    private errors: Diagnostic[] = [];
    private warnings: Diagnostic[] = [];

    /**
     * Lex one program.
     *
     * @param source The source code for this program.
     * @param startingFileLine The line number in the original file where this program begins.
     */
    public lex(source: string, startingFileLine: number = 1): LexResult {
        this.tokens = [];
        this.errors = [];
        this.warnings = [];

        Logger.log("\nLEXER → Starting lexical analysis...\n");

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
                    } else {
                        fileColumn++;
                        programColumn++;
                    }
                    i++;
                }

                if (i >= source.length) {
                    this.warning(
                        "Unterminated comment block. Reached end of input before finding '*/'.",
                        commentFileLine,
                        commentFileColumn,
                        commentProgramLine,
                        commentProgramColumn
                    );
                    break;
                }

                i += 2;
                fileColumn += 2;
                programColumn += 2;
                continue;
            }

            switch (char) {
                case "{":
                    this.add(TokenType.LBrace, char, fileLine, fileColumn);
                    break;

                case "}":
                    this.add(TokenType.RBrace, char, fileLine, fileColumn);
                    break;

                case "(":
                    this.add(TokenType.LParen, char, fileLine, fileColumn);
                    break;

                case ")":
                    this.add(TokenType.RParen, char, fileLine, fileColumn);
                    break;

                case "+":
                    this.add(TokenType.IntOp, char, fileLine, fileColumn);
                    break;

                case "$":
                    this.add(TokenType.EOP, char, fileLine, fileColumn);
                    break;

                case "=":
                    if (source[i + 1] === "=") {
                        this.add(TokenType.BoolOp, "==", fileLine, fileColumn);
                        i++;
                        fileColumn++;
                        programColumn++;
                    } else {
                        this.add(TokenType.Assign, "=", fileLine, fileColumn);
                    }
                    break;

                case "!":
                    if (source[i + 1] === "=") {
                        this.add(TokenType.BoolOp, "!=", fileLine, fileColumn);
                        i++;
                        fileColumn++;
                        programColumn++;
                    } else {
                        this.error(
                            "Unexpected '!'. Only '!=' is valid in this language.",
                            fileLine,
                            fileColumn,
                            programLine,
                            programColumn
                        );
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
                            this.error(
                                "Unterminated string literal. Strings cannot span multiple lines.",
                                startFileLine,
                                startFileColumn,
                                startProgramLine,
                                startProgramColumn
                            );
                            break;
                        }

                        if (!/[a-z ]/.test(source[i])) {
                            this.error(
                                `Invalid character '${source[i]}' inside string literal. Only lowercase letters and spaces are allowed.`,
                                fileLine,
                                fileColumn,
                                programLine,
                                programColumn
                            );
                        }

                        str += source[i];
                        i++;
                        fileColumn++;
                        programColumn++;
                    }

                    if (i >= source.length) {
                        this.error(
                            "Unterminated string literal. Reached end of input before finding closing quote.",
                            startFileLine,
                            startFileColumn,
                            startProgramLine,
                            startProgramColumn
                        );
                        break;
                    }

                    if (terminated) {
                        this.add(TokenType.StringLiteral, str, startFileLine, startFileColumn);
                    }

                    break;
                }

                default:
                    if (/[0-9]/.test(char)) {
                        this.add(TokenType.Digit, char, fileLine, fileColumn);
                    } else if (/[a-z]/.test(char)) {
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

                        const keywords: Record<string, TokenType> = {
                            print: TokenType.Print,
                            while: TokenType.While,
                            if: TokenType.If,
                            int: TokenType.Type,
                            string: TokenType.Type,
                            boolean: TokenType.Type,
                            true: TokenType.BoolVal,
                            false: TokenType.BoolVal
                        };

                        if (keywords[word]) {
                            this.add(keywords[word], word, fileLine, startFileColumn);
                        } else if (word.length === 1) {
                            this.add(TokenType.Id, word, fileLine, startFileColumn);
                        } else {
                            this.error(
                                `Invalid identifier '${word}'. Identifiers must be exactly one lowercase letter.`,
                                fileLine,
                                startFileColumn,
                                programLine,
                                startProgramColumn
                            );
                        }
                    } else {
                        this.error(
                            `Illegal character '${char}'. This character is not part of the language grammar.`,
                            fileLine,
                            fileColumn,
                            programLine,
                            programColumn
                        );
                    }
            }

            i++;
            fileColumn++;
            programColumn++;
        }

        if (!this.tokens.some((t) => t.type === TokenType.EOP)) {
            this.warning(
                "Missing end-of-program marker '$'. The lexer inserted one automatically.",
                fileLine,
                fileColumn,
                programLine,
                programColumn
            );
            this.add(TokenType.EOP, "$", fileLine, fileColumn);
        }

        Logger.log(
            `\nLEXER → Completed with ${this.errors.length} error(s), ${this.warnings.length} warning(s).\n`
        );

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
    private add(type: TokenType, value: string, line: number, column: number): void {
        const token = new Token(type, value, line, column);
        this.tokens.push(token);
        Logger.log("LEXER → " + token.toString());
    }

    /**
     * Record a lexer error.
     */
    private error(
        message: string,
        fileLine: number,
        fileColumn: number,
        programLine: number,
        programColumn: number
    ): void {
        const diagnostic: Diagnostic = {
            kind: "ERROR",
            phase: "LEXER",
            message,
            fileLine,
            fileColumn,
            programLine,
            programColumn
        };

        this.errors.push(diagnostic);
        Logger.error(ErrorReporter.format(diagnostic));
    }

    /**
     * Record a lexer warning.
     */
    private warning(
        message: string,
        fileLine: number,
        fileColumn: number,
        programLine: number,
        programColumn: number
    ): void {
        const diagnostic: Diagnostic = {
            kind: "WARNING",
            phase: "LEXER",
            message,
            fileLine,
            fileColumn,
            programLine,
            programColumn
        };

        this.warnings.push(diagnostic);
        Logger.warning(ErrorReporter.format(diagnostic));
    }
}