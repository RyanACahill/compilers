import { Token } from "../lexer/Token";
import { TokenType } from "../lexer/TokenType";
import { Logger } from "../util/Logger";
import { CST } from "./CST";
import { Diagnostic, ErrorReporter } from "../util/ErrorReporter";

export interface ParseResult {
    success: boolean;
    cst: CST | null;
    errors: Diagnostic[];
    warnings: Diagnostic[];
    hints: Diagnostic[];
}

/**
 * Recursive descent parser for the CMPT 432 project grammar.
 * It consumes tokens from the lexer, validates grammar structure,
 * and builds a Concrete Syntax Tree.
 */
export class Parser {
    private tokens: Token[] = [];
    private currentIndex = 0;

    private errors: Diagnostic[] = [];
    private warnings: Diagnostic[] = [];
    private hints: Diagnostic[] = [];

    private cst: CST = new CST();

    /**
     * Parse a full token stream representing one program.
     */
    public parse(tokens: Token[]): ParseResult {
        this.tokens = tokens;
        this.currentIndex = 0;
        this.errors = [];
        this.warnings = [];
        this.hints = [];
        this.cst = new CST();

        Logger.log("\nPARSER → Starting parse...\n");

        this.parseProgram();

        Logger.log(
            `\nPARSER → Completed with ${this.errors.length} error(s), ${this.warnings.length} warning(s), ${this.hints.length} hint(s).\n`
        );

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
    private parseProgram(): void {
        this.logProduction("Program");
        this.cst.addBranchNode("<Program>");

        this.parseBlock();
        this.match(TokenType.EOP, "$");

        this.cst.moveUp();
    }

    /**
     * Block ::= { StatementList }
     */
    private parseBlock(): void {
        this.logProduction("Block");
        this.cst.addBranchNode("<Block>");

        this.match(TokenType.LBrace, "{");
        this.parseStatementList();
        this.match(TokenType.RBrace, "}");

        this.cst.moveUp();
    }

    /**
     * StatementList ::= Statement StatementList | ε
     */
    private parseStatementList(): void {
        this.logProduction("StatementList");
        this.cst.addBranchNode("<StatementList>");

        if (this.isStatementStart(this.currentToken())) {
            this.parseStatement();
            this.parseStatementList();
        } else {
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
    private parseStatement(): void {
        this.logProduction("Statement");
        this.cst.addBranchNode("<Statement>");

        const token = this.currentToken();

        if (!token) {
            this.parseError(
                "Unexpected end of input while parsing Statement.",
                this.previousTokenOrFallback()
            );
            this.cst.moveUp();
            return;
        }

        if (token.type === TokenType.Print) {
            this.parsePrintStatement();
        } else if (token.type === TokenType.Id) {
            this.parseAssignmentStatement();
        } else if (token.type === TokenType.Type) {
            this.parseVarDecl();
        } else if (token.type === TokenType.While) {
            this.parseWhileStatement();
        } else if (token.type === TokenType.If) {
            this.parseIfStatement();
        } else if (token.type === TokenType.LBrace) {
            this.parseBlock();
        } else {
            this.parseError(
                `Expected start of Statement but found ${this.tokenDescription(token)}.`,
                token
            );
        }

        this.cst.moveUp();
    }

    /**
     * PrintStatement ::= print ( Expr )
     */
    private parsePrintStatement(): void {
        this.logProduction("PrintStatement");
        this.cst.addBranchNode("<PrintStatement>");

        this.match(TokenType.Print, "print");
        this.match(TokenType.LParen, "(");
        this.parseExpr();
        this.match(TokenType.RParen, ")");

        this.cst.moveUp();
    }

    /**
     * AssignmentStatement ::= Id = Expr
     */
    private parseAssignmentStatement(): void {
        this.logProduction("AssignmentStatement");
        this.cst.addBranchNode("<AssignmentStatement>");

        this.parseId();
        this.match(TokenType.Assign, "=");
        this.parseExpr();

        this.cst.moveUp();
    }

    /**
     * VarDecl ::= type Id
     */
    private parseVarDecl(): void {
        this.logProduction("VarDecl");
        this.cst.addBranchNode("<VarDecl>");

        this.parseType();
        this.parseId();

        this.cst.moveUp();
    }

    /**
     * WhileStatement ::= while BooleanExpr Block
     */
    private parseWhileStatement(): void {
        this.logProduction("WhileStatement");
        this.cst.addBranchNode("<WhileStatement>");

        this.match(TokenType.While, "while");
        this.parseBooleanExpr();
        this.parseBlock();

        this.cst.moveUp();
    }

    /**
     * IfStatement ::= if BooleanExpr Block
     */
    private parseIfStatement(): void {
        this.logProduction("IfStatement");
        this.cst.addBranchNode("<IfStatement>");

        this.match(TokenType.If, "if");
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
    private parseExpr(): void {
        this.logProduction("Expr");
        this.cst.addBranchNode("<Expr>");

        const token = this.currentToken();

        if (!token) {
            this.parseError(
                "Unexpected end of input while parsing Expr.",
                this.previousTokenOrFallback()
            );
            this.cst.moveUp();
            return;
        }

        if (token.type === TokenType.Digit) {
            this.parseIntExpr();
        } else if (token.type === TokenType.StringLiteral) {
            this.parseStringExpr();
        } else if (
            token.type === TokenType.BoolVal ||
            token.type === TokenType.LParen
        ) {
            this.parseBooleanExpr();
        } else if (token.type === TokenType.Id) {
            this.parseId();
        } else {
            this.parseError(
                `Expected start of Expr but found ${this.tokenDescription(token)}.`,
                token
            );
        }

        this.cst.moveUp();
    }

    /**
     * IntExpr ::= digit intop Expr | digit
     */
    private parseIntExpr(): void {
        this.logProduction("IntExpr");
        this.cst.addBranchNode("<IntExpr>");

        this.parseDigit();

        const token = this.currentToken();
        if (token && token.type === TokenType.IntOp) {
            this.parseIntOp();
            this.parseExpr();
        }

        this.cst.moveUp();
    }

    /**
     * Since the lexer already tokenizes the full string literal,
     * StringExpr is parsed as one STRING_LITERAL token here.
     */
    private parseStringExpr(): void {
        this.logProduction("StringExpr");
        this.cst.addBranchNode("<StringExpr>");

        this.match(TokenType.StringLiteral);

        this.cst.moveUp();
    }

    /**
     * BooleanExpr ::= ( Expr boolop Expr ) | boolval
     */
    private parseBooleanExpr(): void {
        this.logProduction("BooleanExpr");
        this.cst.addBranchNode("<BooleanExpr>");

        const token = this.currentToken();

        if (!token) {
            this.parseError(
                "Unexpected end of input while parsing BooleanExpr.",
                this.previousTokenOrFallback()
            );
            this.cst.moveUp();
            return;
        }

        if (token.type === TokenType.BoolVal) {
            this.parseBoolVal();
        } else if (token.type === TokenType.LParen) {
            this.match(TokenType.LParen, "(");
            this.parseExpr();
            this.parseBoolOp();
            this.parseExpr();
            this.match(TokenType.RParen, ")");
        } else {
            this.parseError(
                `Expected BooleanExpr but found ${this.tokenDescription(token)}.`,
                token
            );
        }

        this.cst.moveUp();
    }

    /**
     * Id ::= char
     * In the token stream, identifiers are already reduced to ID tokens.
     */
    private parseId(): void {
        this.logProduction("Id");
        this.cst.addBranchNode("<Id>");

        this.match(TokenType.Id);

        this.cst.moveUp();
    }

    /**
     * type ::= int | string | boolean
     */
    private parseType(): void {
        this.logProduction("Type");
        this.cst.addBranchNode("<Type>");

        this.match(TokenType.Type);

        this.cst.moveUp();
    }

    /**
     * digit ::= 0 | 1 | 2 | ... | 9
     */
    private parseDigit(): void {
        this.logProduction("Digit");
        this.cst.addBranchNode("<Digit>");

        this.match(TokenType.Digit);

        this.cst.moveUp();
    }

    /**
     * boolop ::= == | !=
     */
    private parseBoolOp(): void {
        this.logProduction("BoolOp");
        this.cst.addBranchNode("<BoolOp>");

        this.match(TokenType.BoolOp);

        this.cst.moveUp();
    }

    /**
     * boolval ::= true | false
     */
    private parseBoolVal(): void {
        this.logProduction("BoolVal");
        this.cst.addBranchNode("<BoolVal>");

        this.match(TokenType.BoolVal);

        this.cst.moveUp();
    }

    /**
     * intop ::= +
     */
    private parseIntOp(): void {
        this.logProduction("IntOp");
        this.cst.addBranchNode("<IntOp>");

        this.match(TokenType.IntOp, "+");

        this.cst.moveUp();
    }

    /**
     * Matches the current token against the expected token type and optional value.
     * If successful, the token is added as a CST leaf and consumed.
     */
    private match(expectedType: TokenType, expectedValue?: string): void {
        const token = this.currentToken();

        if (!token) {
            this.parseError(
                `Expected ${expectedType}${expectedValue ? ` '${expectedValue}'` : ""} but reached end of input.`,
                this.previousTokenOrFallback()
            );
            return;
        }

        const typeMatches = token.type === expectedType;
        const valueMatches = expectedValue === undefined || token.value === expectedValue;

        if (typeMatches && valueMatches) {
            this.cst.addLeafNode(`[${token.type}: ${token.value}]`);
            Logger.log(`PARSER → Matched ${this.tokenDescription(token)}`);
            this.currentIndex++;
            return;
        }

        this.parseError(
            `Expected ${expectedType}${expectedValue ? ` '${expectedValue}'` : ""} but found ${this.tokenDescription(token)}.`,
            token
        );
    }

    /**
     * Returns the current token or null if the parser is past the end.
     */
    private currentToken(): Token | null {
        return this.currentIndex < this.tokens.length ? this.tokens[this.currentIndex] : null;
    }

    /**
     * Determines whether a token can begin a statement.
     */
    private isStatementStart(token: Token | null): boolean {
        if (!token) {
            return false;
        }

        return (
            token.type === TokenType.Print ||
            token.type === TokenType.Id ||
            token.type === TokenType.Type ||
            token.type === TokenType.While ||
            token.type === TokenType.If ||
            token.type === TokenType.LBrace
        );
    }

    /**
     * Creates and records a parse error with detailed position data.
     */
    private parseError(message: string, token: Token | null): void {
        const line = token ? token.line : (this.tokens.length > 0 ? this.tokens[this.tokens.length - 1].line : 1);
        const column = token ? token.column : (this.tokens.length > 0 ? this.tokens[this.tokens.length - 1].column : 1);

        const diagnostic: Diagnostic = {
            kind: "ERROR",
            phase: "PARSER",
            message,
            fileLine: line,
            fileColumn: column,
            programLine: line,
            programColumn: column
        };

        this.errors.push(diagnostic);
        Logger.error(ErrorReporter.format(diagnostic));
    }

    /**
     * Used when the parser needs a fallback location for unexpected EOF situations.
     */
    private previousTokenOrFallback(): Token | null {
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
    private tokenDescription(token: Token): string {
        return `${token.type} '${token.value}' at (${token.line}:${token.column})`;
    }

    /**
     * Verbose trace showing which grammar production is being entered.
     */
    private logProduction(name: string): void {
        Logger.log(`PARSER → Parsing ${name}...`);
    }
}