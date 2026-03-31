"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Token = void 0;
class Token {
    constructor(type, value, line, column) {
        this.type = type;
        this.value = value;
        this.line = line;
        this.column = column;
    }
    toString() {
        return `[${this.type}] '${this.value}' @ (${this.line}:${this.column})`;
    }
}
exports.Token = Token;
//# sourceMappingURL=Token.js.map