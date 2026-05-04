/**
 * Token represents a single lexical unit produced by the lexer.
 * Each token includes:
 * - type: classification of the token
 * - value: actual text from source
 * - line/column: precise location in source code
 */
export class Token {
    constructor(type, value, line, column) {
        this.type = type;
        this.value = value;
        this.line = line;
        this.column = column;
    }
    /**
     * Returns a formatted string for debugging and verbose output.
     */
    toString() {
        return `[${this.type}] '${this.value}' @ (${this.line}:${this.column})`;
    }
}
