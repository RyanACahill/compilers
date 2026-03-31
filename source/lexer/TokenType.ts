/**
 * TokenType defines all possible token categories recognized by the lexer.
 * These correspond directly to the grammar terminals in the language.
 */
export enum TokenType {

    // Structural symbols
    LBrace = "L_BRACE",
    RBrace = "R_BRACE",
    LParen = "L_PAREN",
    RParen = "R_PAREN",
    EOP = "EOP", // End of Program ($)

    // Keywords
    Print = "PRINT",
    While = "WHILE",
    If = "IF",
    Type = "TYPE", // int | string | boolean

    // Identifiers (must be single lowercase letter)
    Id = "ID",

    // Literals
    Digit = "DIGIT",
    StringLiteral = "STRING_LITERAL",
    BoolVal = "BOOL_VAL",

    // Operators
    Assign = "ASSIGN",     // =
    BoolOp = "BOOL_OP",    // ==, !=
    IntOp = "INT_OP"       // +
}