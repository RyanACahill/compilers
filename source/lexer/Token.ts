import { TokenType } from "./TokenType";

/**
 * Token represents a single lexical unit produced by the lexer.
 * Each token includes:
 * - type: classification of the token
 * - value: actual text from source
 * - line/column: precise location in source code
 */
export class Token {

    constructor(
        public type: TokenType,
        public value: string,
        public line: number,
        public column: number
    ) {}

    /**
     * Returns a formatted string for debugging and verbose output.
     */
    public toString(): string {
        return `[${this.type}] '${this.value}' @ (${this.line}:${this.column})`;
    }
}