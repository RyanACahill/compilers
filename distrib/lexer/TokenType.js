"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TokenType = void 0;
/**
 * TokenType defines all possible token categories recognized by the lexer.
 * These correspond directly to the grammar terminals in the language.
 */
var TokenType;
(function (TokenType) {
    // Structural symbols
    TokenType["LBrace"] = "L_BRACE";
    TokenType["RBrace"] = "R_BRACE";
    TokenType["LParen"] = "L_PAREN";
    TokenType["RParen"] = "R_PAREN";
    TokenType["EOP"] = "EOP";
    // Keywords
    TokenType["Print"] = "PRINT";
    TokenType["While"] = "WHILE";
    TokenType["If"] = "IF";
    TokenType["Type"] = "TYPE";
    // Identifiers (must be single lowercase letter)
    TokenType["Id"] = "ID";
    // Literals
    TokenType["Digit"] = "DIGIT";
    TokenType["StringLiteral"] = "STRING_LITERAL";
    TokenType["BoolVal"] = "BOOL_VAL";
    // Operators
    TokenType["Assign"] = "ASSIGN";
    TokenType["BoolOp"] = "BOOL_OP";
    TokenType["IntOp"] = "INT_OP"; // +
})(TokenType || (exports.TokenType = TokenType = {}));
//# sourceMappingURL=TokenType.js.map