import { Token } from "../lexer/Token.js";
import { TokenType } from "../lexer/TokenType.js";
import { Logger } from "../util/Logger.js";
import { Diagnostic, ErrorReporter } from "../util/ErrorReporter.js";
import { AST } from "./AST.js";
import { ASTNode } from "./ASTNode.js";
import { SymbolTable } from "./SymbolTable.js";
import { SymbolTableEntry } from "./SymbolTableEntry.js";

export interface SemanticResult {
    success: boolean;
    ast: AST | null;
    symbolTable: SymbolTable | null;
    errors: Diagnostic[];
    warnings: Diagnostic[];
    hints: Diagnostic[];
}

export class SemanticAnalyzer {
    private tokens: Token[] = [];
    private index = 0;

    private ast: AST = new AST();
    private symbolTable: SymbolTable = new SymbolTable();

    private errors: Diagnostic[] = [];
    private warnings: Diagnostic[] = [];
    private hints: Diagnostic[] = [];

    private scopeCounter = 0;
    private activeScopes: number[] = [];

    public analyze(tokens: Token[]): SemanticResult {
        Logger.log("\nSEMANTIC ANALYSIS → Starting semantic analysis...\n");

        this.tokens = tokens;
        this.index = 0;
        this.ast = new AST();
        this.symbolTable = new SymbolTable();
        this.errors = [];
        this.warnings = [];
        this.hints = [];
        this.scopeCounter = 0;
        this.activeScopes = [];

        this.ast.root = this.buildProgram();

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
            symbolTable: this.errors.length === 0 ? this.symbolTable : null,
            errors: this.errors,
            warnings: this.warnings,
            hints: this.hints
        };
    }

    private buildProgram(): ASTNode {
        Logger.log("SEMANTIC ANALYSIS → Building AST...");
        return this.buildBlock();
    }

    private buildBlock(): ASTNode {
        this.match(TokenType.LBrace);

        const block = new ASTNode("Block");

        while (this.current()?.type !== TokenType.RBrace && this.current()?.type !== TokenType.EOP) {
            const statement = this.buildStatement();
            if (statement) block.addChild(statement);
        }

        this.match(TokenType.RBrace);
        return block;
    }

    private buildStatement(): ASTNode | null {
        const token = this.current();

        if (!token) return null;

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
                this.semanticError(`Unexpected token '${token.value}' while building AST.`, token);
                this.index++;
                return null;
        }
    }

    private buildPrint(): ASTNode {
        this.match(TokenType.Print);
        this.match(TokenType.LParen);

        const node = new ASTNode("Print");
        node.addChild(this.buildExpr());

        this.match(TokenType.RParen);
        return node;
    }

    private buildVarDecl(): ASTNode {
        const typeToken = this.match(TokenType.Type);
        const idToken = this.match(TokenType.Id);

        const node = new ASTNode("VarDecl");
        node.addChild(new ASTNode("Type", typeToken?.value ?? "", typeToken));
        node.addChild(new ASTNode("Id", idToken?.value ?? "", idToken));

        return node;
    }

    private buildAssignment(): ASTNode {
        const idToken = this.match(TokenType.Id);
        this.match(TokenType.Assign);

        const node = new ASTNode("Assignment");
        node.addChild(new ASTNode("Id", idToken?.value ?? "", idToken));
        node.addChild(this.buildExpr());

        return node;
    }

    private buildIf(): ASTNode {
        this.match(TokenType.If);

        const node = new ASTNode("If");
        node.addChild(this.buildBooleanExpr());
        node.addChild(this.buildBlock());

        return node;
    }

    private buildWhile(): ASTNode {
        this.match(TokenType.While);

        const node = new ASTNode("While");
        node.addChild(this.buildBooleanExpr());
        node.addChild(this.buildBlock());

        return node;
    }

    private buildExpr(): ASTNode {
        const token = this.current();

        if (!token) {
            return new ASTNode("UnknownExpr");
        }

        if (token.type === TokenType.Digit) {
            return this.buildIntExpr();
        }

        if (token.type === TokenType.StringLiteral) {
            const str = this.match(TokenType.StringLiteral);
            return new ASTNode("StringExpr", str?.value ?? "", str);
        }

        if (token.type === TokenType.BoolVal || token.type === TokenType.LParen) {
            return this.buildBooleanExpr();
        }

        if (token.type === TokenType.Id) {
            const id = this.match(TokenType.Id);
            return new ASTNode("Id", id?.value ?? "", id);
        }

        this.semanticError(`Invalid expression starting with '${token.value}'.`, token);
        this.index++;
        return new ASTNode("UnknownExpr");
    }

    private buildIntExpr(): ASTNode {
        const digit = this.match(TokenType.Digit);

        const node = new ASTNode("IntExpr");
        node.addChild(new ASTNode("Digit", digit?.value ?? "", digit));

        if (this.current()?.type === TokenType.IntOp) {
            const op = this.match(TokenType.IntOp);
            node.addChild(new ASTNode("IntOp", op?.value ?? "", op));
            node.addChild(this.buildExpr());
        }

        return node;
    }

    private buildBooleanExpr(): ASTNode {
        const token = this.current();

        const node = new ASTNode("BooleanExpr");

        if (token?.type === TokenType.BoolVal) {
            const bool = this.match(TokenType.BoolVal);
            node.addChild(new ASTNode("BoolVal", bool?.value ?? "", bool));
            return node;
        }

        this.match(TokenType.LParen);
        node.addChild(this.buildExpr());

        const op = this.match(TokenType.BoolOp);
        node.addChild(new ASTNode("BoolOp", op?.value ?? "", op));

        node.addChild(this.buildExpr());
        this.match(TokenType.RParen);

        return node;
    }

    private analyzeBlock(block: ASTNode): void {
        const scopeId = this.scopeCounter++;
        this.activeScopes.push(scopeId);

        Logger.log(`SEMANTIC ANALYSIS → Entering scope ${scopeId}`);

        for (const child of block.children) {
            this.analyzeNode(child);
        }

        Logger.log(`SEMANTIC ANALYSIS → Leaving scope ${scopeId}`);
        this.activeScopes.pop();
    }

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
                this.evaluateExprType(node.children[0]);
                this.analyzeBlock(node.children[1]);
                break;
        }
    }

    private analyzeVarDecl(node: ASTNode): void {
        const typeNode = node.children[0];
        const idNode = node.children[1];

        const scope = this.currentScope();

        if (this.symbolTable.lookupCurrentScope(idNode.value, scope)) {
            this.semanticError(
                `Identifier '${idNode.value}' has already been declared in this scope.`,
                idNode.token
            );
            return;
        }

        Logger.log(`SEMANTIC ANALYSIS → Declaring '${idNode.value}' as ${typeNode.value} in scope ${scope}`);

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

    private analyzeAssignment(node: ASTNode): void {
        const idNode = node.children[0];
        const exprNode = node.children[1];

        const symbol = this.symbolTable.lookup(idNode.value, this.activeScopes);

        if (!symbol) {
            this.semanticError(`Identifier '${idNode.value}' has not been declared.`, idNode.token);
            return;
        }

        const exprType = this.evaluateExprType(exprNode);

        if (exprType && exprType !== symbol.type) {
            this.semanticError(
                `Type mismatch. Variable '${idNode.value}' is type '${symbol.type}' but expression is type '${exprType}'.`,
                idNode.token
            );
            return;
        }

        symbol.initialized = true;
    }

    private analyzePrint(node: ASTNode): void {
        this.evaluateExprType(node.children[0]);
    }

    private evaluateExprType(node: ASTNode): string | null {
        switch (node.name) {
            case "Digit":
                return "int";

            case "StringExpr":
                return "string";

            case "BoolVal":
                return "boolean";

            case "Id": {
                const symbol = this.symbolTable.lookup(node.value, this.activeScopes);

                if (!symbol) {
                    this.semanticError(`Identifier '${node.value}' has not been declared.`, node.token);
                    return null;
                }

                if (!symbol.initialized) {
                    this.warning(`Identifier '${node.value}' is being used before it is initialized.`, node.token);
                }

                symbol.used = true;
                return symbol.type;
            }

            case "IntExpr": {
                if (node.children.length === 1) {
                    return "int";
                }

                const rightType = this.evaluateExprType(node.children[2]);

                if (rightType !== "int") {
                    this.semanticError("Integer expressions may only add integer values.", node.children[2].token);
                }

                return "int";
            }

            case "BooleanExpr": {
                if (node.children.length === 1) {
                    return "boolean";
                }

                const leftType = this.evaluateExprType(node.children[0]);
                const rightType = this.evaluateExprType(node.children[2]);

                if (leftType && rightType && leftType !== rightType) {
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

    private checkWarningsAndHints(): void {
        for (const entry of this.symbolTable.all()) {
            const fakeToken = {
                line: entry.line,
                column: entry.column
            } as Token;

            if (!entry.used && !entry.initialized) {
                this.warning(`Identifier '${entry.name}' was declared but never used.`, fakeToken);
            } else if (!entry.used && entry.initialized) {
                this.hint(`Identifier '${entry.name}' was initialized but never used.`, fakeToken);
            }
        }
    }

    private current(): Token | null {
        return this.index < this.tokens.length ? this.tokens[this.index] : null;
    }

    private match(type: TokenType): Token | null {
        const token = this.current();

        if (!token || token.type !== type) {
            if (token) {
                this.semanticError(`Expected ${type} while building AST but found ${token.type}.`, token);
            }
            return null;
        }

        this.index++;
        return token;
    }

    private currentScope(): number {
        return this.activeScopes[this.activeScopes.length - 1];
    }

    private semanticError(message: string, token: Token | null): void {
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

    private warning(message: string, token: Token | null): void {
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

    private hint(message: string, token: Token | null): void {
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