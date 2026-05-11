import { AST } from "../semantic/AST.js";
import { ASTNode } from "../semantic/ASTNode.js";
import { Logger } from "../util/Logger.js";

export interface JavaCodeGenResult {
    success: boolean;
    source: string;
    errors: string[];
}

export class JavaCodeGenerator {
    private output: string[] = [];
    private errors: string[] = [];
    private indentLevel = 0;

    public generate(ast: AST): JavaCodeGenResult {
        this.output = [];
        this.errors = [];
        this.indentLevel = 0;

        Logger.log("\nJAVA CODE GENERATION → Starting Java source generation...\n");

        if (!ast.root) {
            return {
                success: false,
                source: "",
                errors: ["AST root was missing."]
            };
        }

        this.emitLine("public class GeneratedProgram {");
        this.indentLevel++;
        this.emitLine("public static void main(String[] args) {");
        this.indentLevel++;

        this.generateBlockContents(ast.root);

        this.indentLevel--;
        this.emitLine("}");
        this.indentLevel--;
        this.emitLine("}");

        Logger.log("JAVA CODE GENERATION → Completed Java source generation.\n");

        return {
            success: this.errors.length === 0,
            source: this.output.join("\n"),
            errors: this.errors
        };
    }

    private generateNode(node: ASTNode): void {
        switch (node.name) {
            case "Block":
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

    private generateBlockContents(block: ASTNode): void {
        for (const child of block.children) {
            this.generateNode(child);
        }
    }

    private generateVarDecl(node: ASTNode): void {
        const typeNode = node.children[0];
        const idNode = node.children[1];

        const javaType = this.mapType(typeNode.value);
        const defaultValue = this.defaultValue(typeNode.value);

        this.emitLine(`${javaType} ${this.scopedName(idNode)} = ${defaultValue};`);
    }

    private generateAssignment(node: ASTNode): void {
        const idNode = node.children[0];
        const exprNode = node.children[1];

        this.emitLine(`${this.scopedName(idNode)} = ${this.generateExpr(exprNode)};`);
    }

    private generatePrint(node: ASTNode): void {
        const exprNode = node.children[0];

        this.emitLine(`System.out.println(${this.generateExpr(exprNode)});`);
    }

    private generateIf(node: ASTNode): void {
        const condition = this.generateExpr(node.children[0]);
        const block = node.children[1];

        this.emitLine(`if (${condition}) {`);
        this.indentLevel++;

        this.generateBlockContents(block);

        this.indentLevel--;
        this.emitLine("}");
    }

    private generateWhile(node: ASTNode): void {
        const condition = this.generateExpr(node.children[0]);
        const block = node.children[1];

        this.emitLine(`while (${condition}) {`);
        this.indentLevel++;

        this.generateBlockContents(block);

        this.indentLevel--;
        this.emitLine("}");
    }

    private generateExpr(node: ASTNode): string {
        switch (node.name) {
            case "IntExpr":
                if (node.children.length === 1) {
                    return this.generateExpr(node.children[0]);
                }

                return `${this.generateExpr(node.children[0])} + ${this.generateExpr(node.children[2])}`;

            case "Digit":
                return node.value;

            case "StringExpr":
                return JSON.stringify(node.value);

            case "BooleanExpr":
                if (node.children.length === 1) {
                    return this.generateExpr(node.children[0]);
                }

                return `${this.generateExpr(node.children[0])} ${this.mapBoolOp(node.children[1].value)} ${this.generateExpr(node.children[2])}`;

            case "BoolVal":
                return node.value;

            case "Id":
                return this.scopedName(node);

            default:
                this.errors.push(`Unsupported expression node for Java generation: ${node.name}`);
                return "null";
        }
    }

    private scopedName(node: ASTNode): string {
        return `${node.value}_${node.scopeId ?? 0}`;
    }

    private mapType(type: string): string {
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

    private defaultValue(type: string): string {
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

    private mapBoolOp(op: string): string {
        if (op === "==") return "==";
        if (op === "!=") return "!=";

        this.errors.push(`Unknown boolean operator '${op}'`);
        return op;
    }

    private emitLine(line: string): void {
        const indent = "    ".repeat(this.indentLevel);
        this.output.push(indent + line);
    }
}