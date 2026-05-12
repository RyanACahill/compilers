import { AST } from "../semantic/AST.js";
import { ASTNode } from "../semantic/ASTNode.js";
import { Logger } from "../util/Logger.js";

/**
 * Final result returned by the TypeScript code generator.
 *
 * Includes:
 * - success/failure state
 * - generated TypeScript source
 * - generation errors
 */
export interface TypeScriptCodeGenResult {
    success: boolean;
    source: string;
    errors: string[];
}

/**
 * Generates TypeScript source code from the optimized AST.
 *
 * Responsibilities:
 * - Convert AST nodes into TypeScript syntax
 * - Generate typed variable declarations
 * - Generate expressions and control flow
 * - Produce runnable TypeScript source
 */
export class TypeScriptCodeGenerator {

    // Stores generated TypeScript source line-by-line.
    private output: string[] = [];

    // Stores code generation errors.
    private errors: string[] = [];

    // Tracks indentation depth for formatted output.
    private indentLevel = 0;

    /**
     * Entry point for TypeScript source generation.
     */
    public generate(ast: AST): TypeScriptCodeGenResult {

        // Reset generator state.
        this.output = [];
        this.errors = [];
        this.indentLevel = 0;

        Logger.log(
            "\nTYPESCRIPT CODE GENERATION → Starting TypeScript code generation...\n"
        );

        // AST root is required.
        if (!ast.root) {

            return {
                success: false,
                source: "",
                errors: ["AST root was missing."]
            };
        }

        /**
         * File header comments.
         */
        this.emitLine("// Generated TypeScript code");
        this.emitLine("// Produced from compiler AST");
        this.emitLine("");

        // Begin recursive AST generation.
        this.generateNode(ast.root);

        Logger.log(
            "TYPESCRIPT CODE GENERATION → Completed TypeScript code generation.\n"
        );

        return {
            success: this.errors.length === 0,
            source: this.output.join("\n"),
            errors: this.errors
        };
    }

    /**
     * Dispatches generation logic based on AST node type.
     */
    private generateNode(node: ASTNode): void {

        switch (node.name) {

            case "Block":

                // Generate nested block scope.
                this.emitLine("{");

                this.indentLevel++;

                for (const child of node.children) {
                    this.generateNode(child);
                }

                this.indentLevel--;

                this.emitLine("}");

                break;

            case "VarDecl":
                this.generateVarDecl(node);
                break;

            case "Assignment":
                this.generateAssignment(node);
                break;

            case "Print":
                this.generatePrint(node);
                break;

            case "If":
                this.generateIf(node);
                break;

            case "While":
                this.generateWhile(node);
                break;

            default:

                this.errors.push(
                    `Unsupported AST node for TypeScript generation: ${node.name}`
                );
        }
    }

    /**
     * Generates TypeScript variable declarations.
     *
     * Example:
     * let a_0: number = 0;
     */
    private generateVarDecl(node: ASTNode): void {

        const typeNode = node.children[0];
        const idNode = node.children[1];

        // Convert compiler types into TypeScript types.
        const tsType =
            this.mapType(typeNode.value);

        // Generate default initialization value.
        const defaultValue =
            this.defaultValue(typeNode.value);

        this.emitLine(
            `let ${this.scopedName(idNode)}: ${tsType} = ${defaultValue};`
        );
    }

    /**
     * Generates TypeScript assignment statements.
     */
    private generateAssignment(node: ASTNode): void {

        const idNode = node.children[0];
        const exprNode = node.children[1];

        this.emitLine(
            `${this.scopedName(idNode)} = ${this.generateExpr(exprNode)};`
        );
    }

    /**
     * Generates TypeScript print statements.
     */
    private generatePrint(node: ASTNode): void {

        const exprNode = node.children[0];

        this.emitLine(
            `console.log(${this.generateExpr(exprNode)});`
        );
    }

    /**
     * Generates TypeScript if-statements.
     */
    private generateIf(node: ASTNode): void {

        const condition =
            this.generateExpr(node.children[0]);

        this.emitLine(`if (${condition}) {`);

        this.indentLevel++;

        const block = node.children[1];

        for (const child of block.children) {
            this.generateNode(child);
        }

        this.indentLevel--;

        this.emitLine("}");
    }

    /**
     * Generates TypeScript while-loops.
     */
    private generateWhile(node: ASTNode): void {

        const condition =
            this.generateExpr(node.children[0]);

        this.emitLine(`while (${condition}) {`);

        this.indentLevel++;

        const block = node.children[1];

        for (const child of block.children) {
            this.generateNode(child);
        }

        this.indentLevel--;

        this.emitLine("}");
    }

    /**
     * Recursively converts AST expressions
     * into TypeScript expressions.
     */
    private generateExpr(node: ASTNode): string {

        switch (node.name) {

            case "IntExpr":

                // Single integer literal.
                if (node.children.length === 1) {
                    return this.generateExpr(node.children[0]);
                }

                // Integer addition expression.
                return `${this.generateExpr(node.children[0])} + ${this.generateExpr(node.children[2])}`;

            case "Digit":
                return node.value;

            case "StringExpr":

                // JSON.stringify safely escapes strings.
                return JSON.stringify(node.value);

            case "BooleanExpr":

                // Boolean literal case.
                if (node.children.length === 1) {
                    return this.generateExpr(node.children[0]);
                }

                // Boolean comparison expression.
                return `${this.generateExpr(node.children[0])} ${this.mapBoolOp(node.children[1].value)} ${this.generateExpr(node.children[2])}`;

            case "BoolVal":
                return node.value;

            case "Id":

                // Scoped variable reference.
                return this.scopedName(node);

            default:

                this.errors.push(
                    `Unsupported expression node for TypeScript generation: ${node.name}`
                );

                return "undefined";
        }
    }

    /**
     * Produces a unique variable name using scope IDs.
     *
     * Prevents collisions between nested scopes.
     */
    private scopedName(node: ASTNode): string {

        const scope =
            node.scopeId ?? 0;

        return `${node.value}_${scope}`;
    }

    /**
     * Maps compiler language types
     * into TypeScript types.
     */
    private mapType(type: string): string {

        switch (type) {

            case "int":
                return "number";

            case "string":
                return "string";

            case "boolean":
                return "boolean";

            default:

                this.errors.push(
                    `Unknown type '${type}'`
                );

                return "unknown";
        }
    }

    /**
     * Returns default initialization values
     * for TypeScript variables.
     */
    private defaultValue(type: string): string {

        switch (type) {

            case "int":
                return "0";

            case "string":
                return "\"\"";

            case "boolean":
                return "false";

            default:
                return "undefined";
        }
    }

    /**
     * Maps compiler boolean operators
     * into TypeScript operators.
     *
     * TypeScript uses strict equality operators.
     */
    private mapBoolOp(op: string): string {

        if (op === "==") {
            return "===";
        }

        if (op === "!=") {
            return "!==";
        }

        this.errors.push(
            `Unknown boolean operator '${op}'`
        );

        return op;
    }

    /**
     * Appends a formatted line of TypeScript source.
     *
     * Indentation is automatically applied
     * using the current indentation depth.
     */
    private emitLine(line: string): void {

        const indent =
            "    ".repeat(this.indentLevel);

        this.output.push(indent + line);
    }
}