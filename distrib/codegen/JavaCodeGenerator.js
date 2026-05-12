import { Logger } from "../util/Logger.js";
/**
 * Generates Java source code from the optimized AST.
 *
 * Responsibilities:
 * - Convert AST statements into Java syntax
 * - Handle variable declarations and assignments
 * - Generate loops and conditionals
 * - Produce valid standalone Java source
 */
export class JavaCodeGenerator {
    constructor() {
        // Stores generated Java source line-by-line.
        this.output = [];
        // Stores code generation errors.
        this.errors = [];
        // Current indentation depth for pretty formatting.
        this.indentLevel = 0;
    }
    /**
     * Entry point for Java source generation.
     */
    generate(ast) {
        // Reset generator state.
        this.output = [];
        this.errors = [];
        this.indentLevel = 0;
        Logger.log("\nJAVA CODE GENERATION → Starting Java source generation...\n");
        // AST root is required.
        if (!ast.root) {
            return {
                success: false,
                source: "",
                errors: ["AST root was missing."]
            };
        }
        /**
         * Generate wrapper Java class and main method.
         */
        this.emitLine("public class GeneratedProgram {");
        this.indentLevel++;
        this.emitLine("public static void main(String[] args) {");
        this.indentLevel++;
        // Generate program body.
        this.generateBlockContents(ast.root);
        // Close main method.
        this.indentLevel--;
        this.emitLine("}");
        // Close class.
        this.indentLevel--;
        this.emitLine("}");
        Logger.log("JAVA CODE GENERATION → Completed Java source generation.\n");
        return {
            success: this.errors.length === 0,
            source: this.output.join("\n"),
            errors: this.errors
        };
    }
    /**
     * Dispatches generation logic based on AST node type.
     */
    generateNode(node) {
        switch (node.name) {
            case "Block":
                // Generate nested Java block.
                this.emitLine("{");
                this.indentLevel++;
                this.generateBlockContents(node);
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
                this.errors.push(`Unsupported AST node for Java generation: ${node.name}`);
        }
    }
    /**
     * Generates all statements inside a block.
     */
    generateBlockContents(block) {
        for (const child of block.children) {
            this.generateNode(child);
        }
    }
    /**
     * Generates Java variable declarations.
     *
     * Example:
     * int a_0 = 0;
     */
    generateVarDecl(node) {
        const typeNode = node.children[0];
        const idNode = node.children[1];
        // Convert compiler types into Java types.
        const javaType = this.mapType(typeNode.value);
        // Generate default initialization value.
        const defaultValue = this.defaultValue(typeNode.value);
        this.emitLine(`${javaType} ${this.scopedName(idNode)} = ${defaultValue};`);
    }
    /**
     * Generates Java assignment statements.
     */
    generateAssignment(node) {
        const idNode = node.children[0];
        const exprNode = node.children[1];
        this.emitLine(`${this.scopedName(idNode)} = ${this.generateExpr(exprNode)};`);
    }
    /**
     * Generates Java print statements.
     */
    generatePrint(node) {
        const exprNode = node.children[0];
        this.emitLine(`System.out.println(${this.generateExpr(exprNode)});`);
    }
    /**
     * Generates Java if-statements.
     */
    generateIf(node) {
        const condition = this.generateExpr(node.children[0]);
        const block = node.children[1];
        this.emitLine(`if (${condition}) {`);
        this.indentLevel++;
        this.generateBlockContents(block);
        this.indentLevel--;
        this.emitLine("}");
    }
    /**
     * Generates Java while-loops.
     */
    generateWhile(node) {
        const condition = this.generateExpr(node.children[0]);
        const block = node.children[1];
        this.emitLine(`while (${condition}) {`);
        this.indentLevel++;
        this.generateBlockContents(block);
        this.indentLevel--;
        this.emitLine("}");
    }
    /**
     * Recursively converts AST expressions
     * into Java expressions.
     */
    generateExpr(node) {
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
                // JSON.stringify safely escapes quotes.
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
                // Variable references include scope suffixes.
                return this.scopedName(node);
            default:
                this.errors.push(`Unsupported expression node for Java generation: ${node.name}`);
                return "null";
        }
    }
    /**
     * Produces a unique variable name using scope IDs.
     *
     * Prevents naming collisions across nested scopes.
     */
    scopedName(node) {
        var _a;
        return `${node.value}_${(_a = node.scopeId) !== null && _a !== void 0 ? _a : 0}`;
    }
    /**
     * Maps compiler language types to Java types.
     */
    mapType(type) {
        switch (type) {
            case "int":
                return "int";
            case "string":
                return "String";
            case "boolean":
                return "boolean";
            default:
                this.errors.push(`Unknown Java type '${type}'`);
                return "Object";
        }
    }
    /**
     * Returns default initialization values
     * for Java variable declarations.
     */
    defaultValue(type) {
        switch (type) {
            case "int":
                return "0";
            case "string":
                return "\"\"";
            case "boolean":
                return "false";
            default:
                return "null";
        }
    }
    /**
     * Maps compiler boolean operators
     * to equivalent Java operators.
     */
    mapBoolOp(op) {
        if (op === "==") {
            return "==";
        }
        if (op === "!=") {
            return "!=";
        }
        this.errors.push(`Unknown boolean operator '${op}'`);
        return op;
    }
    /**
     * Appends a formatted line of Java source code.
     *
     * Indentation is automatically applied
     * based on current nesting depth.
     */
    emitLine(line) {
        const indent = "    ".repeat(this.indentLevel);
        this.output.push(indent + line);
    }
}
