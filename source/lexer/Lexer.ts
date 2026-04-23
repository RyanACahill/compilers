import { Token } from "./Token";
import { TokenType } from "./TokenType";
import { Logger } from "../util/Logger";
import { Diagnostic, ErrorReporter } from "../util/ErrorReporter";

/**
 * Encapsulates the result of lexical analysis for a single program.
 * This structure allows the compiler pipeline to cleanly decide whether
 * to proceed to parsing or halt due to errors.
 */
export interface LexResult {
    tokens: Token[];
    errors: Diagnostic[];
    warnings: Diagnostic[];
    success: boolean;
}

/**
 * The Lexer is responsible for transforming raw source code into a sequence
 * of tokens based on the language grammar.
 *
 * Key responsibilities:
 * - Recognize all valid tokens (keywords, identifiers, literals, symbols)
 * - Ignore whitespace and comments
 * - Track both file-level and program-level positions
 * - Detect and report lexical errors and warnings
 * - Support multiple programs separated by '$'
 *
 * Important design choice:
 * This lexer supports "compact code" (no spaces) by greedily matching keywords
 * before falling back to single-character identifiers.
 */
export class Lexer {
    private tokens: Token[] = [];
    private errors: Diagnostic[] = [];
    private warnings: Diagnostic[] = [];

    /**
     * Main entry point for lexical analysis.
     *
     * @param source The raw source code of a single program
     * @param startingFileLine The starting line number in the original file
     * @returns LexResult containing tokens and diagnostics
     */
    public lex(source: string, startingFileLine: number = 1): LexResult {
        this.tokens = [];
        this.errors = [];
        this.warnings = [];

        Logger.log("\nLEXER → Starting lexical analysis...\n");

        let i = 0;

        // Absolute file position (used for final reporting)
        let fileLine = startingFileLine;
        let fileColumn = 1;

        // Position relative to the current program
        let programLine = 1;
        let programColumn = 1;

        /**
         * Main scanning loop.
         * Iterates through each character and determines how to classify it.
         */
        while (i < source.length) {
            const char = source[i];

            /**
             * Handle newline explicitly because it affects both file and program tracking.
             */
            if (char === "\n") {
                fileLine++;
                fileColumn = 1;
                programLine++;
                programColumn = 1;
                i++;
                continue;
            }

            /**
             * Skip whitespace (spaces, tabs, etc.).
             * Newlines are handled separately above.
             */
            if (/\s/.test(char)) {
                fileColumn++;
                programColumn++;
                i++;
                continue;
            }

            /**
             * Comment handling.
             * Comments are ignored completely by the lexer.
             * If the closing delimiter is missing, we issue a warning.
             */
            if (char === "/" && source[i + 1] === "*") {
                const startFL = fileLine;
                const startFC = fileColumn;
                const startPL = programLine;
                const startPC = programColumn;

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
                        "Unterminated comment block.",
                        startFL, startFC, startPL, startPC
                    );
                    break;
                }

                // Skip closing */
                i += 2;
                fileColumn += 2;
                programColumn += 2;
                continue;
            }

            /**
             * Single-character tokens and simple operators.
             */
            switch (char) {
                case "{": this.add(TokenType.LBrace, "{", fileLine, fileColumn); break;
                case "}": this.add(TokenType.RBrace, "}", fileLine, fileColumn); break;
                case "(": this.add(TokenType.LParen, "(", fileLine, fileColumn); break;
                case ")": this.add(TokenType.RParen, ")", fileLine, fileColumn); break;
                case "+": this.add(TokenType.IntOp, "+", fileLine, fileColumn); break;
                case "$": this.add(TokenType.EOP, "$", fileLine, fileColumn); break;

                /**
                 * '=' may represent assignment or equality.
                 */
                case "=":
                    if (source[i + 1] === "=") {
                        this.add(TokenType.BoolOp, "==", fileLine, fileColumn);
                        i++; fileColumn++; programColumn++;
                    } else {
                        this.add(TokenType.Assign, "=", fileLine, fileColumn);
                    }
                    break;

                /**
                 * '!' is only valid when forming '!='.
                 */
                case "!":
                    if (source[i + 1] === "=") {
                        this.add(TokenType.BoolOp, "!=", fileLine, fileColumn);
                        i++; fileColumn++; programColumn++;
                    } else {
                        this.error(
                            "Unexpected '!'. Only '!=' is valid.",
                            fileLine, fileColumn, programLine, programColumn
                        );
                    }
                    break;

                /**
                 * String literal handling.
                 * Strings must:
                 * - be enclosed in quotes
                 * - contain only lowercase letters and spaces
                 * - not span multiple lines
                 */
                case "\"": {
                    const startFL = fileLine;
                    const startFC = fileColumn;
                    const startPL = programLine;
                    const startPC = programColumn;

                    let str = "";
                    i++; fileColumn++; programColumn++;

                    let terminated = false;

                    while (i < source.length) {
                        if (source[i] === "\"") {
                            terminated = true;
                            break;
                        }

                        if (source[i] === "\n") {
                            this.error(
                                "Unterminated string literal.",
                                startFL, startFC, startPL, startPC
                            );
                            break;
                        }

                        if (!/[a-z ]/.test(source[i])) {
                            this.error(
                                `Invalid character '${source[i]}' in string.`,
                                fileLine, fileColumn, programLine, programColumn
                            );
                        }

                        str += source[i];
                        i++; fileColumn++; programColumn++;
                    }

                    if (terminated) {
                        this.add(TokenType.StringLiteral, str, startFL, startFC);
                    }

                    break;
                }

                /**
                 * Default case handles:
                 * - digits
                 * - keywords
                 * - identifiers
                 * - illegal characters
                 */
                default:
                    if (/[0-9]/.test(char)) {
                        this.add(TokenType.Digit, char, fileLine, fileColumn);
                    }

                    /**
                     * Keyword vs Identifier logic:
                     * Try to match full keyword first, otherwise fallback to single-char ID.
                     */
                    else if (/[a-z]/.test(char)) {
                    const prev = this.previousToken();

                    // After a TYPE, force single-character ID
                    if (prev !== null && prev.type === TokenType.Type) {
                        this.add(TokenType.Id, char, fileLine, fileColumn);
                    } else {
                        const match = this.tryConsumeKeyword(source, i);

                        if (match !== null) {
                            this.add(match.type, match.value, fileLine, fileColumn);

                            i += match.value.length - 1;
                            fileColumn += match.value.length - 1;
                            programColumn += match.value.length - 1;
                        } else {
                            this.add(TokenType.Id, char, fileLine, fileColumn);
                        }
                    }
                }

                    /**
                     * Any other character is invalid.
                     */
                    else {
                        this.error(
                            `Illegal character '${char}'.`,
                            fileLine, fileColumn, programLine, programColumn
                        );
                    }
            }

            i++;
            fileColumn++;
            programColumn++;
        }

        /**
         * Ensure every program ends with '$'.
         * If missing, insert automatically and warn.
         */
        if (!this.tokens.some(t => t.type === TokenType.EOP)) {
            this.warning(
                "Missing '$'. Auto-inserted.",
                fileLine, fileColumn, programLine, programColumn
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
     * Attempts to match a keyword starting at the given index.
     * This enables correct lexing of compact code without whitespace.
     */
    private tryConsumeKeyword(source: string, index: number): { type: TokenType; value: string } | null {
        const keywords = [
            { value: "boolean", type: TokenType.Type },
            { value: "string", type: TokenType.Type },
            { value: "while", type: TokenType.While },
            { value: "print", type: TokenType.Print },
            { value: "false", type: TokenType.BoolVal },
            { value: "true", type: TokenType.BoolVal },
            { value: "int", type: TokenType.Type },
            { value: "if", type: TokenType.If }
        ];

        for (const k of keywords) {
            if (source.startsWith(k.value, index)) {
                return k;
            }
        }

        return null;
    }

    /**
     * Adds a token to the stream and logs it in verbose mode.
     */
    private add(type: TokenType, value: string, line: number, column: number): void {
        const token = new Token(type, value, line, column);
        this.tokens.push(token);
        Logger.log("LEXER → " + token.toString());
    }
    private previousToken(): Token | null {
        return this.tokens.length > 0
            ? this.tokens[this.tokens.length - 1]
            : null;
    }
    /**
     * Records an error.
     */
    private error(
        message: string,
        fileLine: number,
        fileColumn: number,
        programLine: number,
        programColumn: number
    ): void {
        const d: Diagnostic = {
            kind: "ERROR",
            phase: "LEXER",
            message,
            fileLine,
            fileColumn,
            programLine,
            programColumn
        };

        this.errors.push(d);
        Logger.error(ErrorReporter.format(d));
    }

    /**
     * Records a warning.
     */
    private warning(
        message: string,
        fileLine: number,
        fileColumn: number,
        programLine: number,
        programColumn: number
    ): void {
        const d: Diagnostic = {
            kind: "WARNING",
            phase: "LEXER",
            message,
            fileLine,
            fileColumn,
            programLine,
            programColumn
        };

        this.warnings.push(d);
        Logger.warning(ErrorReporter.format(d));
    }
}