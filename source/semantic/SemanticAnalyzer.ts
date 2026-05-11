import { Token } from "../lexer/Token.js";
import { TokenType } from "../lexer/TokenType.js";
import { Logger } from "../util/Logger.js";
import { Diagnostic, ErrorReporter } from "../util/ErrorReporter.js";
import { AST } from "./AST.js";
import { ASTNode } from "./ASTNode.js";
import { SymbolTable } from "./SymbolTable.js";
import { SymbolTableEntry } from "./SymbolTableEntry.js";

/**
 * Represents the final result of semantic analysis.
 *
 * Includes:
 * - success/failure state
 * - generated AST
 * - symbol table
 * - semantic diagnostics
 */
export interface SemanticResult {
    success: boolean;
    ast: AST | null;
    symbolTable: SymbolTable | null;
    errors: Diagnostic[];
    warnings: Diagnostic[];
    hints: Diagnostic[];
}

/**
 * Performs semantic analysis on the parser token stream.
 *
 * Responsibilities:
 * - Build the AST
 * - Build and manage scopes
 * - Construct the symbol table
 * - Validate variable declarations
 * - Validate assignments and type safety
 * - Detect semantic warnings and hints
 */
export class SemanticAnalyzer {

    // Token stream received from the parser stage.
    private tokens: Token[] = [];

    // Current semantic analysis position in the token stream.
    private index = 0;

    // Semantic structures generated during analysis.
    private ast: AST = new AST();
    private symbolTable: SymbolTable = new SymbolTable();

    // Diagnostic collections.
    private errors: Diagnostic[] = [];
    private warnings: Diagnostic[] = [];
    private hints: Diagnostic[] = [];

    // Scope tracking state.
    private scopeCounter = 0;
    private activeScopes: number[] = [];

    /**
     * Entry point for semantic analysis.
     */
    public analyze(tokens: Token[]): SemanticResult {

        Logger.log(
            "\nSEMANTIC ANALYSIS → Starting semantic analysis...\n"
        );

        // Reset analyzer state.
        this.tokens = tokens;
        this.index = 0;

        this.ast = new AST();
        this.symbolTable = new SymbolTable();

        this.errors = [];
        this.warnings = [];
        this.hints = [];

        this.scopeCounter = 0;
        this.activeScopes = [];

        // Build the AST from the token stream.
        this.ast.root = this.buildProgram();

        // Begin semantic validation once AST construction succeeds.
        if (this.ast.root) {
            this.analyzeBlock(this.ast.root);
            this.checkWarningsAndHints();
        }

        Logger.log(
            `\nSEMANTIC ANALYSIS → Completed with ${this.errors.length} error(s), ${this.warnings.length} warning(s), ${this.hints.length} hint(s).\n`
        );

        return {
            success: this.errors.length === 0,
            ast: this.errors.length === 0 ? this.ast : null,
            symbolTable:
                this.errors.length === 0
                    ? this.symbolTable
                    : null,
            errors: this.errors,
            warnings: this.warnings,
            hints: this.hints
        };
    }

    /**
     * Program ::= Block
     *
     * Begins AST construction from the root block.
     */
    private buildProgram(): ASTNode {

        Logger.log(
            "SEMANTIC ANALYSIS → Building AST..."
        );

        return this.buildBlock();
    }

    /**
     * Builds a Block AST node.
     */
    private buildBlock(): ASTNode {

        this.match(TokenType.LBrace);

        const block = new ASTNode("Block");

        // Continue building statements until block ends.
        while (
            this.current()?.type !== TokenType.RBrace &&
            this.current()?.type !== TokenType.EOP
        ) {

            const statement = this.buildStatement();

            if (statement) {
                block.addChild(statement);
            }
        }

        this.match(TokenType.RBrace);

        return block;
    }

    /**
     * Determines which statement AST node should be built
     * based on the current token.
     */
    private buildStatement(): ASTNode | null {

        const token = this.current();

        if (!token) {
            return null;
        }

        switch (token.type) {

            case TokenType.Print:
                return this.buildPrint();

            case TokenType.Type:
                return this.buildVarDecl();

            case TokenType.Id:
                return this.buildAssignment();

            case TokenType.If:
                return this.buildIf();

            case TokenType.While:
                return this.buildWhile();

            case TokenType.LBrace:
                return this.buildBlock();

            default:

                this.semanticError(
                    `Unexpected token '${token.value}' while building AST.`,
                    token
                );

                this.index++;

                return null;
        }
    }

    /**
     * Builds a Print AST node.
     */
    private buildPrint(): ASTNode {

        this.match(TokenType.Print);
        this.match(TokenType.LParen);

        const node = new ASTNode("Print");

        node.addChild(this.buildExpr());

        this.match(TokenType.RParen);

        return node;
    }

    /**
     * Builds a variable declaration AST node.
     *
     * VarDecl ::= type Id
     */
    private buildVarDecl(): ASTNode {

        const typeToken = this.match(TokenType.Type);
        const idToken = this.match(TokenType.Id);

        const node = new ASTNode("VarDecl");

        node.addChild(
            new ASTNode(
                "Type",
                typeToken?.value ?? "",
                typeToken
            )
        );

        node.addChild(
            new ASTNode(
                "Id",
                idToken?.value ?? "",
                idToken
            )
        );

        return node;
    }

    /**
     * Builds an assignment AST node.
     *
     * Assignment ::= Id = Expr
     */
    private buildAssignment(): ASTNode {

        const idToken = this.match(TokenType.Id);

        this.match(TokenType.Assign);

        const node = new ASTNode("Assignment");

        node.addChild(
            new ASTNode(
                "Id",
                idToken?.value ?? "",
                idToken
            )
        );

        node.addChild(this.buildExpr());

        return node;
    }

    /**
     * Builds an if-statement AST node.
     */
    private buildIf(): ASTNode {

        this.match(TokenType.If);

        const node = new ASTNode("If");

        node.addChild(this.buildBooleanExpr());
        node.addChild(this.buildBlock());

        return node;
    }

    /**
     * Builds a while-loop AST node.
     */
    private buildWhile(): ASTNode {

        this.match(TokenType.While);

        const node = new ASTNode("While");

        node.addChild(this.buildBooleanExpr());
        node.addChild(this.buildBlock());

        return node;
    }

    /**
     * Determines which expression AST node to build.
     */
    private buildExpr(): ASTNode {

        const token = this.current();

        if (!token) {
            return new ASTNode("UnknownExpr");
        }

        if (token.type === TokenType.Digit) {
            return this.buildIntExpr();
        }

        if (token.type === TokenType.StringLiteral) {

            const str =
                this.match(TokenType.StringLiteral);

            return new ASTNode(
                "StringExpr",
                str?.value ?? "",
                str
            );
        }

        if (
            token.type === TokenType.BoolVal ||
            token.type === TokenType.LParen
        ) {
            return this.buildBooleanExpr();
        }

        if (token.type === TokenType.Id) {

            const id = this.match(TokenType.Id);

            return new ASTNode(
                "Id",
                id?.value ?? "",
                id
            );
        }

        this.semanticError(
            `Invalid expression starting with '${token.value}'.`,
            token
        );

        this.index++;

        return new ASTNode("UnknownExpr");
    }

    /**
     * Builds an integer expression AST node.
     *
     * IntExpr ::= digit + Expr | digit
     */
    private buildIntExpr(): ASTNode {

        const digit = this.match(TokenType.Digit);

        const node = new ASTNode("IntExpr");

        node.addChild(
            new ASTNode(
                "Digit",
                digit?.value ?? "",
                digit
            )
        );

        // Optional addition operation.
        if (this.current()?.type === TokenType.IntOp) {

            const op =
                this.match(TokenType.IntOp);

            node.addChild(
                new ASTNode(
                    "IntOp",
                    op?.value ?? "",
                    op
                )
            );

            node.addChild(this.buildExpr());
        }

        return node;
    }

    /**
     * Builds a boolean expression AST node.
     */
    private buildBooleanExpr(): ASTNode {

        const token = this.current();

        const node =
            new ASTNode("BooleanExpr");

        // Boolean literal case.
        if (token?.type === TokenType.BoolVal) {

            const bool =
                this.match(TokenType.BoolVal);

            node.addChild(
                new ASTNode(
                    "BoolVal",
                    bool?.value ?? "",
                    bool
                )
            );

            return node;
        }

        // Boolean comparison expression case.
        this.match(TokenType.LParen);

        node.addChild(this.buildExpr());

        const op =
            this.match(TokenType.BoolOp);

        node.addChild(
            new ASTNode(
                "BoolOp",
                op?.value ?? "",
                op
            )
        );

        node.addChild(this.buildExpr());

        this.match(TokenType.RParen);

        return node;
    }

    /**
     * Performs semantic analysis on a block scope.
     *
     * Creates and manages lexical scope boundaries.
     */
    private analyzeBlock(block: ASTNode): void {

        // Create a new scope.
        const scopeId = this.scopeCounter++;

        block.scopeId = scopeId;

        this.activeScopes.push(scopeId);

        Logger.log(
            `SEMANTIC ANALYSIS → Entering scope ${scopeId}`
        );

        // Analyze all child nodes in the scope.
        for (const child of block.children) {
            this.analyzeNode(child);
        }

        Logger.log(
            `SEMANTIC ANALYSIS → Leaving scope ${scopeId}`
        );

        this.activeScopes.pop();
    }

    /**
     * Dispatches semantic analysis logic
     * based on AST node type.
     */
    private analyzeNode(node: ASTNode): void {

        switch (node.name) {

            case "Block":
                this.analyzeBlock(node);
                break;

            case "VarDecl":
                this.analyzeVarDecl(node);
                break;

            case "Assignment":
                this.analyzeAssignment(node);
                break;

            case "Print":
                this.analyzePrint(node);
                break;

            case "If":
            case "While":

                // Validate condition expressions.
                this.evaluateExprType(node.children[0]);

                // Analyze nested block.
                this.analyzeBlock(node.children[1]);

                break;
        }
    }

    /**
     * Validates variable declarations and inserts
     * identifiers into the symbol table.
     */
    private analyzeVarDecl(node: ASTNode): void {

        const typeNode = node.children[0];
        const idNode = node.children[1];

        const scope = this.currentScope();

        node.scopeId = scope;

        idNode.scopeId = scope;
        idNode.semanticType = typeNode.value;

        // Prevent redeclaration in the same scope.
        if (
            this.symbolTable.lookupCurrentScope(
                idNode.value,
                scope
            )
        ) {

            this.semanticError(
                `Identifier '${idNode.value}' has already been declared in this scope.`,
                idNode.token
            );

            return;
        }

        Logger.log(
            `SEMANTIC ANALYSIS → Declaring '${idNode.value}' as ${typeNode.value} in scope ${scope}`
        );

        // Insert variable into symbol table.
        this.symbolTable.add(
            new SymbolTableEntry(
                idNode.value,
                typeNode.value,
                scope,
                idNode.token?.line ?? 0,
                idNode.token?.column ?? 0
            )
        );
    }

    /**
     * Validates assignments for:
     * - declaration existence
     * - type compatibility
     */
    private analyzeAssignment(node: ASTNode): void {

        const idNode = node.children[0];
        const exprNode = node.children[1];

        const symbol =
            this.symbolTable.lookup(
                idNode.value,
                this.activeScopes
            );

        // Variable must exist before assignment.
        if (!symbol) {

            this.semanticError(
                `Identifier '${idNode.value}' has not been declared.`,
                idNode.token
            );

            return;
        }

        idNode.scopeId = symbol.scope;
        idNode.semanticType = symbol.type;

        // Determine expression type.
        const exprType =
            this.evaluateExprType(exprNode);

        // Enforce type safety.
        if (
            exprType &&
            exprType !== symbol.type
        ) {

            this.semanticError(
                `Type mismatch. Variable '${idNode.value}' is type '${symbol.type}' but expression is type '${exprType}'.`,
                idNode.token
            );

            return;
        }

        // Mark variable as initialized.
        symbol.initialized = true;
    }

    /**
     * Validates expressions passed into print statements.
     */
    private analyzePrint(node: ASTNode): void {
        this.evaluateExprType(node.children[0]);
    }

    /**
     * Determines and validates the semantic type
     * of an expression subtree.
     */
    private evaluateExprType(node: ASTNode): string | null {

        switch (node.name) {

            case "Digit":
                return "int";

            case "StringExpr":
                return "string";

            case "BoolVal":
                return "boolean";

            case "Id": {

                const symbol =
                    this.symbolTable.lookup(
                        node.value,
                        this.activeScopes
                    );

                // Variable must exist before use.
                if (!symbol) {

                    this.semanticError(
                        `Identifier '${node.value}' has not been declared.`,
                        node.token
                    );

                    return null;
                }

                node.scopeId = symbol.scope;
                node.semanticType = symbol.type;

                // Warn about uninitialized usage.
                if (!symbol.initialized) {

                    this.warning(
                        `Identifier '${node.value}' is being used before it is initialized.`,
                        node.token
                    );
                }

                // Mark variable as used.
                symbol.used = true;

                return symbol.type;
            }

            case "IntExpr": {

                // Single digit expression.
                if (node.children.length === 1) {
                    return "int";
                }

                const rightType =
                    this.evaluateExprType(
                        node.children[2]
                    );

                // Integer expressions may only add integers.
                if (rightType !== "int") {

                    this.semanticError(
                        "Integer expressions may only add integer values.",
                        node.children[2].token
                    );
                }

                return "int";
            }

            case "BooleanExpr": {

                // Boolean literal case.
                if (node.children.length === 1) {
                    return "boolean";
                }

                const leftType =
                    this.evaluateExprType(
                        node.children[0]
                    );

                const rightType =
                    this.evaluateExprType(
                        node.children[2]
                    );

                // Both sides of comparisons must match.
                if (
                    leftType &&
                    rightType &&
                    leftType !== rightType
                ) {

                    this.semanticError(
                        `Boolean comparison type mismatch. Left side is '${leftType}' but right side is '${rightType}'.`,
                        node.children[1].token
                    );
                }

                return "boolean";
            }
        }

        return null;
    }

    /**
     * Generates semantic warnings and hints
     * after analysis completes.
     */
    private checkWarningsAndHints(): void {

        for (const entry of this.symbolTable.all()) {

            const fakeToken = {
                line: entry.line,
                column: entry.column
            } as Token;

            // Declared but never used.
            if (
                !entry.used &&
                !entry.initialized
            ) {

                this.warning(
                    `Identifier '${entry.name}' was declared but never used.`,
                    fakeToken
                );

            // Initialized but never referenced.
            } else if (
                !entry.used &&
                entry.initialized
            ) {

                this.hint(
                    `Identifier '${entry.name}' was initialized but never used.`,
                    fakeToken
                );
            }
        }
    }

    /**
     * Returns the current token.
     */
    private current(): Token | null {

        return this.index < this.tokens.length
            ? this.tokens[this.index]
            : null;
    }

    /**
     * Matches and consumes a token of the expected type.
     */
    private match(type: TokenType): Token | null {

        const token = this.current();

        if (!token || token.type !== type) {

            if (token) {

                this.semanticError(
                    `Expected ${type} while building AST but found ${token.type}.`,
                    token
                );
            }

            return null;
        }

        this.index++;

        return token;
    }

    /**
     * Returns the currently active lexical scope.
     */
    private currentScope(): number {

        return this.activeScopes[
            this.activeScopes.length - 1
        ];
    }

    /**
     * Creates and records a semantic error diagnostic.
     */
    private semanticError(
        message: string,
        token: Token | null
    ): void {

        const d: Diagnostic = {
            kind: "ERROR",
            phase: "SEMANTIC ANALYSIS",
            message,
            fileLine: token?.line ?? 0,
            fileColumn: token?.column ?? 0,
            programLine: token?.line ?? 0,
            programColumn: token?.column ?? 0
        };

        this.errors.push(d);

        Logger.error(ErrorReporter.format(d));
    }

    /**
     * Creates and records a semantic warning diagnostic.
     */
    private warning(
        message: string,
        token: Token | null
    ): void {

        const d: Diagnostic = {
            kind: "WARNING",
            phase: "SEMANTIC ANALYSIS",
            message,
            fileLine: token?.line ?? 0,
            fileColumn: token?.column ?? 0,
            programLine: token?.line ?? 0,
            programColumn: token?.column ?? 0
        };

        this.warnings.push(d);

        Logger.warning(ErrorReporter.format(d));
    }

    /**
     * Creates and records a semantic hint diagnostic.
     */
    private hint(
        message: string,
        token: Token | null
    ): void {

        const d: Diagnostic = {
            kind: "HINT",
            phase: "SEMANTIC ANALYSIS",
            message,
            fileLine: token?.line ?? 0,
            fileColumn: token?.column ?? 0,
            programLine: token?.line ?? 0,
            programColumn: token?.column ?? 0
        };

        this.hints.push(d);

        Logger.log(ErrorReporter.format(d));
    }
}