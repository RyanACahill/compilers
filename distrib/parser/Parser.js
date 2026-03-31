"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Parser = void 0;
const TokenType_1 = require("../lexer/TokenType");
const Logger_1 = require("../util/Logger");
const CST_1 = require("./CST");
const ErrorReporter_1 = require("../util/ErrorReporter");
/**
 * Recursive descent parser for the CMPT 432 project grammar.
 * It consumes tokens from the lexer, validates grammar structure,
 * and builds a Concrete Syntax Tree.
 */
class Parser {
    constructor() {
        this.tokens = [];
        this.currentIndex = 0;
        this.errors = [];
        this.warnings = [];
        this.hints = [];
        this.cst = new CST_1.CST();
    }
    /**
     * Parse a full token stream representing one program.
     */
    parse(tokens) {
        this.tokens = tokens;
        this.currentIndex = 0;
        this.errors = [];
        this.warnings = [];
        this.hints = [];
        this.cst = new CST_1.CST();
        Logger_1.Logger.log("\nPARSER → Starting parse...\n");
        this.parseProgram();
        Logger_1.Logger.log(`\nPARSER → Completed with ${this.errors.length} error(s), ${this.warnings.length} warning(s), ${this.hints.length} hint(s).\n`);
        return {
            success: this.errors.length === 0,
            cst: this.errors.length === 0 ? this.cst : null,
            errors: this.errors,
            warnings: this.warnings,
            hints: this.hints
        };
    }
    /**
     * Program ::= Block $
     */
    parseProgram() {
        this.logProduction("Program");
        this.cst.addBranchNode("<Program>");
        this.parseBlock();
        this.match(TokenType_1.TokenType.EOP, "$");
        this.cst.moveUp();
    }
    /**
     * Block ::= { StatementList }
     */
    parseBlock() {
        this.logProduction("Block");
        this.cst.addBranchNode("<Block>");
        this.match(TokenType_1.TokenType.LBrace, "{");
        this.parseStatementList();
        this.match(TokenType_1.TokenType.RBrace, "}");
        this.cst.moveUp();
    }
    /**
     * StatementList ::= Statement StatementList | ε
     */
    parseStatementList() {
        this.logProduction("StatementList");
        this.cst.addBranchNode("<StatementList>");
        if (this.isStatementStart(this.currentToken())) {
            this.parseStatement();
            this.parseStatementList();
        }
        else {
            this.cst.addLeafNode("[ε]");
        }
        this.cst.moveUp();
    }
    /**
     * Statement ::= PrintStatement
     *             | AssignmentStatement
     *             | VarDecl
     *             | WhileStatement
     *             | IfStatement
     *             | Block
     */
    parseStatement() {
        this.logProduction("Statement");
        this.cst.addBranchNode("<Statement>");
        const token = this.currentToken();
        if (!token) {
            this.parseError("Unexpected end of input while parsing Statement.", this.previousTokenOrFallback());
            this.cst.moveUp();
            return;
        }
        if (token.type === TokenType_1.TokenType.Print) {
            this.parsePrintStatement();
        }
        else if (token.type === TokenType_1.TokenType.Id) {
            this.parseAssignmentStatement();
        }
        else if (token.type === TokenType_1.TokenType.Type) {
            this.parseVarDecl();
        }
        else if (token.type === TokenType_1.TokenType.While) {
            this.parseWhileStatement();
        }
        else if (token.type === TokenType_1.TokenType.If) {
            this.parseIfStatement();
        }
        else if (token.type === TokenType_1.TokenType.LBrace) {
            this.parseBlock();
        }
        else {
            this.parseError(`Expected start of Statement but found ${this.tokenDescription(token)}.`, token);
        }
        this.cst.moveUp();
    }
    /**
     * PrintStatement ::= print ( Expr )
     */
    parsePrintStatement() {
        this.logProduction("PrintStatement");
        this.cst.addBranchNode("<PrintStatement>");
        this.match(TokenType_1.TokenType.Print, "print");
        this.match(TokenType_1.TokenType.LParen, "(");
        this.parseExpr();
        this.match(TokenType_1.TokenType.RParen, ")");
        this.cst.moveUp();
    }
    /**
     * AssignmentStatement ::= Id = Expr
     */
    parseAssignmentStatement() {
        this.logProduction("AssignmentStatement");
        this.cst.addBranchNode("<AssignmentStatement>");
        this.parseId();
        this.match(TokenType_1.TokenType.Assign, "=");
        this.parseExpr();
        this.cst.moveUp();
    }
    /**
     * VarDecl ::= type Id
     */
    parseVarDecl() {
        this.logProduction("VarDecl");
        this.cst.addBranchNode("<VarDecl>");
        this.parseType();
        this.parseId();
        this.cst.moveUp();
    }
    /**
     * WhileStatement ::= while BooleanExpr Block
     */
    parseWhileStatement() {
        this.logProduction("WhileStatement");
        this.cst.addBranchNode("<WhileStatement>");
        this.match(TokenType_1.TokenType.While, "while");
        this.parseBooleanExpr();
        this.parseBlock();
        this.cst.moveUp();
    }
    /**
     * IfStatement ::= if BooleanExpr Block
     */
    parseIfStatement() {
        this.logProduction("IfStatement");
        this.cst.addBranchNode("<IfStatement>");
        this.match(TokenType_1.TokenType.If, "if");
        this.parseBooleanExpr();
        this.parseBlock();
        this.cst.moveUp();
    }
    /**
     * Expr ::= IntExpr
     *       | StringExpr
     *       | BooleanExpr
     *       | Id
     */
    parseExpr() {
        this.logProduction("Expr");
        this.cst.addBranchNode("<Expr>");
        const token = this.currentToken();
        if (!token) {
            this.parseError("Unexpected end of input while parsing Expr.", this.previousTokenOrFallback());
            this.cst.moveUp();
            return;
        }
        if (token.type === TokenType_1.TokenType.Digit) {
            this.parseIntExpr();
        }
        else if (token.type === TokenType_1.TokenType.StringLiteral) {
            this.parseStringExpr();
        }
        else if (token.type === TokenType_1.TokenType.BoolVal ||
            token.type === TokenType_1.TokenType.LParen) {
            this.parseBooleanExpr();
        }
        else if (token.type === TokenType_1.TokenType.Id) {
            this.parseId();
        }
        else {
            this.parseError(`Expected start of Expr but found ${this.tokenDescription(token)}.`, token);
        }
        this.cst.moveUp();
    }
    /**
     * IntExpr ::= digit intop Expr | digit
     */
    parseIntExpr() {
        this.logProduction("IntExpr");
        this.cst.addBranchNode("<IntExpr>");
        this.parseDigit();
        const token = this.currentToken();
        if (token && token.type === TokenType_1.TokenType.IntOp) {
            this.parseIntOp();
            this.parseExpr();
        }
        this.cst.moveUp();
    }
    /**
     * Since the lexer already tokenizes the full string literal,
     * StringExpr is parsed as one STRING_LITERAL token here.
     */
    parseStringExpr() {
        this.logProduction("StringExpr");
        this.cst.addBranchNode("<StringExpr>");
        this.match(TokenType_1.TokenType.StringLiteral);
        this.cst.moveUp();
    }
    /**
     * BooleanExpr ::= ( Expr boolop Expr ) | boolval
     */
    parseBooleanExpr() {
        this.logProduction("BooleanExpr");
        this.cst.addBranchNode("<BooleanExpr>");
        const token = this.currentToken();
        if (!token) {
            this.parseError("Unexpected end of input while parsing BooleanExpr.", this.previousTokenOrFallback());
            this.cst.moveUp();
            return;
        }
        if (token.type === TokenType_1.TokenType.BoolVal) {
            this.parseBoolVal();
        }
        else if (token.type === TokenType_1.TokenType.LParen) {
            this.match(TokenType_1.TokenType.LParen, "(");
            this.parseExpr();
            this.parseBoolOp();
            this.parseExpr();
            this.match(TokenType_1.TokenType.RParen, ")");
        }
        else {
            this.parseError(`Expected BooleanExpr but found ${this.tokenDescription(token)}.`, token);
        }
        this.cst.moveUp();
    }
    /**
     * Id ::= char
     * In the token stream, identifiers are already reduced to ID tokens.
     */
    parseId() {
        this.logProduction("Id");
        this.cst.addBranchNode("<Id>");
        this.match(TokenType_1.TokenType.Id);
        this.cst.moveUp();
    }
    /**
     * type ::= int | string | boolean
     */
    parseType() {
        this.logProduction("Type");
        this.cst.addBranchNode("<Type>");
        this.match(TokenType_1.TokenType.Type);
        this.cst.moveUp();
    }
    /**
     * digit ::= 0 | 1 | 2 | ... | 9
     */
    parseDigit() {
        this.logProduction("Digit");
        this.cst.addBranchNode("<Digit>");
        this.match(TokenType_1.TokenType.Digit);
        this.cst.moveUp();
    }
    /**
     * boolop ::= == | !=
     */
    parseBoolOp() {
        this.logProduction("BoolOp");
        this.cst.addBranchNode("<BoolOp>");
        this.match(TokenType_1.TokenType.BoolOp);
        this.cst.moveUp();
    }
    /**
     * boolval ::= true | false
     */
    parseBoolVal() {
        this.logProduction("BoolVal");
        this.cst.addBranchNode("<BoolVal>");
        this.match(TokenType_1.TokenType.BoolVal);
        this.cst.moveUp();
    }
    /**
     * intop ::= +
     */
    parseIntOp() {
        this.logProduction("IntOp");
        this.cst.addBranchNode("<IntOp>");
        this.match(TokenType_1.TokenType.IntOp, "+");
        this.cst.moveUp();
    }
    /**
     * Matches the current token against the expected token type and optional value.
     * If successful, the token is added as a CST leaf and consumed.
     */
    match(expectedType, expectedValue) {
        const token = this.currentToken();
        if (!token) {
            this.parseError(`Expected ${expectedType}${expectedValue ? ` '${expectedValue}'` : ""} but reached end of input.`, this.previousTokenOrFallback());
            return;
        }
        const typeMatches = token.type === expectedType;
        const valueMatches = expectedValue === undefined || token.value === expectedValue;
        if (typeMatches && valueMatches) {
            this.cst.addLeafNode(`[${token.type}: ${token.value}]`);
            Logger_1.Logger.log(`PARSER → Matched ${this.tokenDescription(token)}`);
            this.currentIndex++;
            return;
        }
        this.parseError(`Expected ${expectedType}${expectedValue ? ` '${expectedValue}'` : ""} but found ${this.tokenDescription(token)}.`, token);
    }
    /**
     * Returns the current token or null if the parser is past the end.
     */
    currentToken() {
        return this.currentIndex < this.tokens.length ? this.tokens[this.currentIndex] : null;
    }
    /**
     * Determines whether a token can begin a statement.
     */
    isStatementStart(token) {
        if (!token) {
            return false;
        }
        return (token.type === TokenType_1.TokenType.Print ||
            token.type === TokenType_1.TokenType.Id ||
            token.type === TokenType_1.TokenType.Type ||
            token.type === TokenType_1.TokenType.While ||
            token.type === TokenType_1.TokenType.If ||
            token.type === TokenType_1.TokenType.LBrace);
    }
    /**
     * Creates and records a parse error with detailed position data.
     */
    parseError(message, token) {
        const line = token ? token.line : (this.tokens.length > 0 ? this.tokens[this.tokens.length - 1].line : 1);
        const column = token ? token.column : (this.tokens.length > 0 ? this.tokens[this.tokens.length - 1].column : 1);
        const diagnostic = {
            kind: "ERROR",
            phase: "PARSER",
            message,
            fileLine: line,
            fileColumn: column,
            programLine: line,
            programColumn: column
        };
        this.errors.push(diagnostic);
        Logger_1.Logger.error(ErrorReporter_1.ErrorReporter.format(diagnostic));
    }
    /**
     * Used when the parser needs a fallback location for unexpected EOF situations.
     */
    previousTokenOrFallback() {
        if (this.currentIndex - 1 >= 0 && this.currentIndex - 1 < this.tokens.length) {
            return this.tokens[this.currentIndex - 1];
        }
        if (this.tokens.length > 0) {
            return this.tokens[0];
        }
        return null;
    }
    /**
     * Returns a readable token description for diagnostics.
     */
    tokenDescription(token) {
        return `${token.type} '${token.value}' at (${token.line}:${token.column})`;
    }
    /**
     * Verbose trace showing which grammar production is being entered.
     */
    logProduction(name) {
        Logger_1.Logger.log(`PARSER → Parsing ${name}...`);
    }
}
exports.Parser = Parser;
//# sourceMappingURL=Parser.js.map