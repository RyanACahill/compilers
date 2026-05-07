import { TokenType } from "../lexer/TokenType.js";
import { Logger } from "../util/Logger.js";
import { ErrorReporter } from "../util/ErrorReporter.js";
import { AST } from "./AST.js";
import { ASTNode } from "./ASTNode.js";
import { SymbolTable } from "./SymbolTable.js";
import { SymbolTableEntry } from "./SymbolTableEntry.js";
export class SemanticAnalyzer {
    constructor() {
        this.tokens = [];
        this.index = 0;
        this.ast = new AST();
        this.symbolTable = new SymbolTable();
        this.errors = [];
        this.warnings = [];
        this.hints = [];
        this.scopeCounter = 0;
        this.activeScopes = [];
    }
    analyze(tokens) {
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
        Logger.log(`\nSEMANTIC ANALYSIS → Completed with ${this.errors.length} error(s), ${this.warnings.length} warning(s), ${this.hints.length} hint(s).\n`);
        return {
            success: this.errors.length === 0,
            ast: this.errors.length === 0 ? this.ast : null,
            symbolTable: this.errors.length === 0 ? this.symbolTable : null,
            errors: this.errors,
            warnings: this.warnings,
            hints: this.hints
        };
    }
    buildProgram() {
        Logger.log("SEMANTIC ANALYSIS → Building AST...");
        return this.buildBlock();
    }
    buildBlock() {
        var _a, _b;
        this.match(TokenType.LBrace);
        const block = new ASTNode("Block");
        while (((_a = this.current()) === null || _a === void 0 ? void 0 : _a.type) !== TokenType.RBrace && ((_b = this.current()) === null || _b === void 0 ? void 0 : _b.type) !== TokenType.EOP) {
            const statement = this.buildStatement();
            if (statement)
                block.addChild(statement);
        }
        this.match(TokenType.RBrace);
        return block;
    }
    buildStatement() {
        const token = this.current();
        if (!token)
            return null;
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
    buildPrint() {
        this.match(TokenType.Print);
        this.match(TokenType.LParen);
        const node = new ASTNode("Print");
        node.addChild(this.buildExpr());
        this.match(TokenType.RParen);
        return node;
    }
    buildVarDecl() {
        var _a, _b;
        const typeToken = this.match(TokenType.Type);
        const idToken = this.match(TokenType.Id);
        const node = new ASTNode("VarDecl");
        node.addChild(new ASTNode("Type", (_a = typeToken === null || typeToken === void 0 ? void 0 : typeToken.value) !== null && _a !== void 0 ? _a : "", typeToken));
        node.addChild(new ASTNode("Id", (_b = idToken === null || idToken === void 0 ? void 0 : idToken.value) !== null && _b !== void 0 ? _b : "", idToken));
        return node;
    }
    buildAssignment() {
        var _a;
        const idToken = this.match(TokenType.Id);
        this.match(TokenType.Assign);
        const node = new ASTNode("Assignment");
        node.addChild(new ASTNode("Id", (_a = idToken === null || idToken === void 0 ? void 0 : idToken.value) !== null && _a !== void 0 ? _a : "", idToken));
        node.addChild(this.buildExpr());
        return node;
    }
    buildIf() {
        this.match(TokenType.If);
        const node = new ASTNode("If");
        node.addChild(this.buildBooleanExpr());
        node.addChild(this.buildBlock());
        return node;
    }
    buildWhile() {
        this.match(TokenType.While);
        const node = new ASTNode("While");
        node.addChild(this.buildBooleanExpr());
        node.addChild(this.buildBlock());
        return node;
    }
    buildExpr() {
        var _a, _b;
        const token = this.current();
        if (!token) {
            return new ASTNode("UnknownExpr");
        }
        if (token.type === TokenType.Digit) {
            return this.buildIntExpr();
        }
        if (token.type === TokenType.StringLiteral) {
            const str = this.match(TokenType.StringLiteral);
            return new ASTNode("StringExpr", (_a = str === null || str === void 0 ? void 0 : str.value) !== null && _a !== void 0 ? _a : "", str);
        }
        if (token.type === TokenType.BoolVal || token.type === TokenType.LParen) {
            return this.buildBooleanExpr();
        }
        if (token.type === TokenType.Id) {
            const id = this.match(TokenType.Id);
            return new ASTNode("Id", (_b = id === null || id === void 0 ? void 0 : id.value) !== null && _b !== void 0 ? _b : "", id);
        }
        this.semanticError(`Invalid expression starting with '${token.value}'.`, token);
        this.index++;
        return new ASTNode("UnknownExpr");
    }
    buildIntExpr() {
        var _a, _b, _c;
        const digit = this.match(TokenType.Digit);
        const node = new ASTNode("IntExpr");
        node.addChild(new ASTNode("Digit", (_a = digit === null || digit === void 0 ? void 0 : digit.value) !== null && _a !== void 0 ? _a : "", digit));
        if (((_b = this.current()) === null || _b === void 0 ? void 0 : _b.type) === TokenType.IntOp) {
            const op = this.match(TokenType.IntOp);
            node.addChild(new ASTNode("IntOp", (_c = op === null || op === void 0 ? void 0 : op.value) !== null && _c !== void 0 ? _c : "", op));
            node.addChild(this.buildExpr());
        }
        return node;
    }
    buildBooleanExpr() {
        var _a, _b;
        const token = this.current();
        const node = new ASTNode("BooleanExpr");
        if ((token === null || token === void 0 ? void 0 : token.type) === TokenType.BoolVal) {
            const bool = this.match(TokenType.BoolVal);
            node.addChild(new ASTNode("BoolVal", (_a = bool === null || bool === void 0 ? void 0 : bool.value) !== null && _a !== void 0 ? _a : "", bool));
            return node;
        }
        this.match(TokenType.LParen);
        node.addChild(this.buildExpr());
        const op = this.match(TokenType.BoolOp);
        node.addChild(new ASTNode("BoolOp", (_b = op === null || op === void 0 ? void 0 : op.value) !== null && _b !== void 0 ? _b : "", op));
        node.addChild(this.buildExpr());
        this.match(TokenType.RParen);
        return node;
    }
    analyzeBlock(block) {
        const scopeId = this.scopeCounter++;
        block.scopeId = scopeId;
        this.activeScopes.push(scopeId);
        Logger.log(`SEMANTIC ANALYSIS → Entering scope ${scopeId}`);
        for (const child of block.children) {
            this.analyzeNode(child);
        }
        Logger.log(`SEMANTIC ANALYSIS → Leaving scope ${scopeId}`);
        this.activeScopes.pop();
    }
    analyzeNode(node) {
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
    analyzeVarDecl(node) {
        var _a, _b, _c, _d;
        const typeNode = node.children[0];
        const idNode = node.children[1];
        const scope = this.currentScope();
        node.scopeId = scope;
        idNode.scopeId = scope;
        idNode.semanticType = typeNode.value;
        if (this.symbolTable.lookupCurrentScope(idNode.value, scope)) {
            this.semanticError(`Identifier '${idNode.value}' has already been declared in this scope.`, idNode.token);
            return;
        }
        Logger.log(`SEMANTIC ANALYSIS → Declaring '${idNode.value}' as ${typeNode.value} in scope ${scope}`);
        this.symbolTable.add(new SymbolTableEntry(idNode.value, typeNode.value, scope, (_b = (_a = idNode.token) === null || _a === void 0 ? void 0 : _a.line) !== null && _b !== void 0 ? _b : 0, (_d = (_c = idNode.token) === null || _c === void 0 ? void 0 : _c.column) !== null && _d !== void 0 ? _d : 0));
    }
    analyzeAssignment(node) {
        const idNode = node.children[0];
        const exprNode = node.children[1];
        const symbol = this.symbolTable.lookup(idNode.value, this.activeScopes);
        if (!symbol) {
            this.semanticError(`Identifier '${idNode.value}' has not been declared.`, idNode.token);
            return;
        }
        idNode.scopeId = symbol.scope;
        idNode.semanticType = symbol.type;
        const exprType = this.evaluateExprType(exprNode);
        if (exprType && exprType !== symbol.type) {
            this.semanticError(`Type mismatch. Variable '${idNode.value}' is type '${symbol.type}' but expression is type '${exprType}'.`, idNode.token);
            return;
        }
        symbol.initialized = true;
    }
    analyzePrint(node) {
        this.evaluateExprType(node.children[0]);
    }
    evaluateExprType(node) {
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
                node.scopeId = symbol.scope;
                node.semanticType = symbol.type;
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
                    this.semanticError(`Boolean comparison type mismatch. Left side is '${leftType}' but right side is '${rightType}'.`, node.children[1].token);
                }
                return "boolean";
            }
        }
        return null;
    }
    checkWarningsAndHints() {
        for (const entry of this.symbolTable.all()) {
            const fakeToken = {
                line: entry.line,
                column: entry.column
            };
            if (!entry.used && !entry.initialized) {
                this.warning(`Identifier '${entry.name}' was declared but never used.`, fakeToken);
            }
            else if (!entry.used && entry.initialized) {
                this.hint(`Identifier '${entry.name}' was initialized but never used.`, fakeToken);
            }
        }
    }
    current() {
        return this.index < this.tokens.length ? this.tokens[this.index] : null;
    }
    match(type) {
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
    currentScope() {
        return this.activeScopes[this.activeScopes.length - 1];
    }
    semanticError(message, token) {
        var _a, _b, _c, _d;
        const d = {
            kind: "ERROR",
            phase: "SEMANTIC ANALYSIS",
            message,
            fileLine: (_a = token === null || token === void 0 ? void 0 : token.line) !== null && _a !== void 0 ? _a : 0,
            fileColumn: (_b = token === null || token === void 0 ? void 0 : token.column) !== null && _b !== void 0 ? _b : 0,
            programLine: (_c = token === null || token === void 0 ? void 0 : token.line) !== null && _c !== void 0 ? _c : 0,
            programColumn: (_d = token === null || token === void 0 ? void 0 : token.column) !== null && _d !== void 0 ? _d : 0
        };
        this.errors.push(d);
        Logger.error(ErrorReporter.format(d));
    }
    warning(message, token) {
        var _a, _b, _c, _d;
        const d = {
            kind: "WARNING",
            phase: "SEMANTIC ANALYSIS",
            message,
            fileLine: (_a = token === null || token === void 0 ? void 0 : token.line) !== null && _a !== void 0 ? _a : 0,
            fileColumn: (_b = token === null || token === void 0 ? void 0 : token.column) !== null && _b !== void 0 ? _b : 0,
            programLine: (_c = token === null || token === void 0 ? void 0 : token.line) !== null && _c !== void 0 ? _c : 0,
            programColumn: (_d = token === null || token === void 0 ? void 0 : token.column) !== null && _d !== void 0 ? _d : 0
        };
        this.warnings.push(d);
        Logger.warning(ErrorReporter.format(d));
    }
    hint(message, token) {
        var _a, _b, _c, _d;
        const d = {
            kind: "HINT",
            phase: "SEMANTIC ANALYSIS",
            message,
            fileLine: (_a = token === null || token === void 0 ? void 0 : token.line) !== null && _a !== void 0 ? _a : 0,
            fileColumn: (_b = token === null || token === void 0 ? void 0 : token.column) !== null && _b !== void 0 ? _b : 0,
            programLine: (_c = token === null || token === void 0 ? void 0 : token.line) !== null && _c !== void 0 ? _c : 0,
            programColumn: (_d = token === null || token === void 0 ? void 0 : token.column) !== null && _d !== void 0 ? _d : 0
        };
        this.hints.push(d);
        Logger.log(ErrorReporter.format(d));
    }
}
