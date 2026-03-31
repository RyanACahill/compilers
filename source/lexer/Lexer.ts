import { Token } from "./Token";
import { TokenType } from "./TokenType";
import { Logger } from "../util/Logger";
import { Diagnostic, ErrorReporter } from "../util/ErrorReporter";

/**
 * LexResult packages everything produced by the lexer for a single program.
 * Returning a structured result instead of only tokens makes it easy for the
 * ProgramRunner to decide whether lexing succeeded and to print a clean summary
 * of all warnings and errors at the end.
 */
export interface LexResult {
    tokens: Token[];
    errors: Diagnostic[];
    warnings: Diagnostic[];
    success: boolean;
}

/**
 * The Lexer is responsible for scanning source code left-to-right and converting
 * raw characters into a stream of tokens that match the project grammar.
 *
 * This lexer:
 * - supports multiple token categories defined by TokenType
 * - tracks line and column positions for precise diagnostics
 * - ignores comment blocks bounded by /* and *\/
 * - records warnings and errors for later summary output
 * - returns success only when no lexing errors were found
 *
 * Important grammar rules enforced here:
 * - identifiers must be exactly one lowercase letter
 * - strings may contain only lowercase letters and spaces
 * - valid boolean operators are == and !=
 * - comments are ignored by the lexer
 */
export class Lexer {
    private tokens: Token[] = [];
    private errors: Diagnostic[] = [];
    private warnings: Diagnostic[] = [];

    /**
     * Performs lexical analysis on one program's source text.
     * The lexer walks through the input one character at a time and decides
     * whether each character begins a token, whitespace region, comment,
     * or invalid sequence.
     *
     * @param source The raw source code for one program.
     * @returns A LexResult containing tokens, diagnostics, and success status.
     */
    public lex(source: string): LexResult {
        this.tokens = [];
        this.errors = [];
        this.warnings = [];

        Logger.log("\nLEXER → Starting lexical analysis...\n");

        let i = 0;
        let line = 1;
        let column = 1;

        while (i < source.length) {
            const char = source[i];

            /**
             * Newlines must advance the line counter and reset the column.
             * This keeps all later error messages accurate.
             */
            if (char === "\n") {
                line++;
                column = 1;
                i++;
                continue;
            }

            /**
             * General whitespace outside strings is ignored by the lexer.
             * Newlines are handled above because they affect position tracking
             * differently than spaces and tabs.
             */
            if (/\s/.test(char)) {
                column++;
                i++;
                continue;
            }

            /**
             * Comment handling:
             * When the lexer sees /* it consumes everything until *\/.
             * Comments are ignored entirely and do not generate tokens.
             * If the closing delimiter is never found, that is treated as
             * a warning according to the project guidance.
             */
            if (char === "/" && source[i + 1] === "*") {
                const commentStartLine = line;
                const commentStartColumn = column;

                i += 2;
                column += 2;

                while (i < source.length && !(source[i] === "*" && source[i + 1] === "/")) {
                    if (source[i] === "\n") {
                        line++;
                        column = 1;
                    } else {
                        column++;
                    }
                    i++;
                }

                if (i >= source.length) {
                    this.warning(
                        "Unterminated comment block. Reached end of input before finding '*/'.",
                        commentStartLine,
                        commentStartColumn
                    );
                    break;
                }

                /**
                 * Skip the closing comment delimiter and continue lexing.
                 */
                i += 2;
                column += 2;
                continue;
            }

            /**
             * Single-character and paired-symbol token recognition.
             * These are handled first because they do not require building
             * longer words from multiple letters.
             */
            switch (char) {
                case "{":
                    this.add(TokenType.LBrace, char, line, column);
                    break;

                case "}":
                    this.add(TokenType.RBrace, char, line, column);
                    break;

                case "(":
                    this.add(TokenType.LParen, char, line, column);
                    break;

                case ")":
                    this.add(TokenType.RParen, char, line, column);
                    break;

                case "+":
                    this.add(TokenType.IntOp, char, line, column);
                    break;

                case "$":
                    this.add(TokenType.EOP, char, line, column);
                    break;

                /**
                 * '=' may either be assignment or part of the equality operator.
                 */
                case "=":
                    if (source[i + 1] === "=") {
                        this.add(TokenType.BoolOp, "==", line, column);
                        i++;
                        column++;
                    } else {
                        this.add(TokenType.Assign, "=", line, column);
                    }
                    break;

                /**
                 * '!' is only valid when immediately followed by '='.
                 * A standalone exclamation point is not part of the grammar.
                 */
                case "!":
                    if (source[i + 1] === "=") {
                        this.add(TokenType.BoolOp, "!=", line, column);
                        i++;
                        column++;
                    } else {
                        this.error(
                            "Unexpected '!'. Only '!=' is valid in this language.",
                            line,
                            column
                        );
                    }
                    break;

                /**
                 * String handling:
                 * Strings begin and end with double quotes.
                 * Inside a string, only lowercase letters and spaces are legal.
                 * Strings may not span multiple lines in this language.
                 */
                case "\"": {
                    const startLine = line;
                    const startColumn = column;
                    let str = "";

                    i++;
                    column++;

                    while (i < source.length && source[i] !== "\"") {
                        if (source[i] === "\n") {
                            this.error(
                                "Unterminated string literal. Strings cannot span multiple lines.",
                                startLine,
                                startColumn
                            );
                            break;
                        }

                        if (!/[a-z ]/.test(source[i])) {
                            this.error(
                                `Invalid character '${source[i]}' inside string literal. Only lowercase letters and spaces are allowed.`,
                                line,
                                column
                            );
                        }

                        str += source[i];
                        i++;
                        column++;
                    }

                    /**
                     * If the loop ended because input ran out, the string never closed.
                     */
                    if (i >= source.length) {
                        this.error(
                            "Unterminated string literal. Reached end of input before finding closing quote.",
                            startLine,
                            startColumn
                        );
                        break;
                    }

                    /**
                     * Only add the string token if a closing quote was actually found.
                     * The stored value excludes the quotation marks themselves.
                     */
                    if (source[i] === "\"") {
                        this.add(TokenType.StringLiteral, str, startLine, startColumn);
                    }
                    break;
                }

                /**
                 * The default branch handles multi-character words, digits, and illegal
                 * characters not recognized by the grammar.
                 */
                default:
                    /**
                     * Digits are simple one-character tokens in this grammar.
                     */
                    if (/[0-9]/.test(char)) {
                        this.add(TokenType.Digit, char, line, column);
                    }
                    /**
                     * Lowercase letter sequences may be keywords, boolean literals,
                     * type names, or identifiers. Since the grammar restricts
                     * identifiers to a single character, longer non-keyword words
                     * are invalid identifiers.
                     */
                    else if (/[a-z]/.test(char)) {
                        let word = "";
                        const startCol = column;

                        while (i < source.length && /[a-z]/.test(source[i])) {
                            word += source[i];
                            i++;
                            column++;
                        }

                        /**
                         * We advance one character too far in the loop logic above,
                         * so step back once to let the outer loop continue correctly.
                         */
                        i--;
                        column--;

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
                            this.add(keywords[word], word, line, startCol);
                        } else if (word.length === 1) {
                            this.add(TokenType.Id, word, line, startCol);
                        } else {
                            this.error(
                                `Invalid identifier '${word}'. Identifiers must be exactly one lowercase letter.`,
                                line,
                                startCol
                            );
                        }
                    }
                    /**
                     * Any character that does not fit the grammar is reported as illegal.
                     */
                    else {
                        this.error(
                            `Illegal character '${char}'. This character is not part of the language grammar.`,
                            line,
                            column
                        );
                    }
            }

            /**
             * Move to the next character after processing the current one.
             * Some branches manually advance i/column further when needed.
             */
            i++;
            column++;
        }

        /**
         * If no end-of-program token was found, insert one automatically and
         * issue a warning. This follows the project requirement that certain
         * recoverable omissions should be treated as warnings rather than errors.
         */
        if (!this.tokens.some((t) => t.type === TokenType.EOP)) {
            this.warning(
                "Missing end-of-program marker '$'. The lexer inserted one automatically.",
                line,
                column
            );
            this.add(TokenType.EOP, "$", line, column);
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
     * Creates a token, stores it in the token stream, and prints it in verbose mode.
     * Centralizing token creation here keeps lexer output consistent.
     */
    private add(type: TokenType, value: string, line: number, column: number): void {
        const token = new Token(type, value, line, column);
        this.tokens.push(token);
        Logger.log("LEXER → " + token.toString());
    }

    /**
     * Records a fatal lexing issue.
     * Errors indicate the source contains invalid syntax at the lexical level.
     */
    private error(message: string, line: number, column: number): void {
        const diagnostic: Diagnostic = {
            kind: "ERROR",
            phase: "LEXER",
            message,
            line,
            column
        };

        this.errors.push(diagnostic);
        Logger.error(ErrorReporter.format(diagnostic));
    }

    /**
     * Records a non-fatal issue.
     * Warnings indicate something questionable or recoverable was found, but
     * the lexer can still finish processing the program.
     */
    private warning(message: string, line: number, column: number): void {
        const diagnostic: Diagnostic = {
            kind: "WARNING",
            phase: "LEXER",
            message,
            line,
            column
        };

        this.warnings.push(diagnostic);
        Logger.warning(ErrorReporter.format(diagnostic));
    }
}