import { Logger } from "../util/Logger.js";
export class TypeScriptCodeGenerator {
    constructor() {
        this.output = [];
        this.errors = [];
        this.indentLevel = 0;
    }
    generate(ast) {
        this.output = [];
        this.errors = [];
        this.indentLevel = 0;
        Logger.log("\nTYPESCRIPT CODE GENERATION → Starting TypeScript code generation...\n");
        if (!ast.root) {
            return {
                success: false,
                source: "",
                errors: ["AST root was missing."]
            };
        }
        this.emitLine("// Generated TypeScript code");
        this.emitLine("// Produced from compiler AST");
        this.emitLine("");
        this.generateNode(ast.root);
        Logger.log("TYPESCRIPT CODE GENERATION → Completed TypeScript code generation.\n");
        return {
            success: this.errors.length === 0,
            source: this.output.join("\n"),
            errors: this.errors
        };
    }
    generateNode(node) {
        switch (node.name) {
            case "Block":
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
                this.errors.push(`Unsupported AST node for TypeScript generation: ${node.name}`);
        }
    }
    generateVarDecl(node) {
        const typeNode = node.children[0];
        const idNode = node.children[1];
        const tsType = this.mapType(typeNode.value);
        const defaultValue = this.defaultValue(typeNode.value);
        this.emitLine(`let ${this.scopedName(idNode)}: ${tsType} = ${defaultValue};`);
    }
    generateAssignment(node) {
        const idNode = node.children[0];
        const exprNode = node.children[1];
        this.emitLine(`${this.scopedName(idNode)} = ${this.generateExpr(exprNode)};`);
    }
    generatePrint(node) {
        const exprNode = node.children[0];
        this.emitLine(`console.log(${this.generateExpr(exprNode)});`);
    }
    generateIf(node) {
        const condition = this.generateExpr(node.children[0]);
        this.emitLine(`if (${condition}) {`);
        this.indentLevel++;
        const block = node.children[1];
        for (const child of block.children) {
            this.generateNode(child);
        }
        this.indentLevel--;
        this.emitLine("}");
    }
    generateWhile(node) {
        const condition = this.generateExpr(node.children[0]);
        this.emitLine(`while (${condition}) {`);
        this.indentLevel++;
        const block = node.children[1];
        for (const child of block.children) {
            this.generateNode(child);
        }
        this.indentLevel--;
        this.emitLine("}");
    }
    generateExpr(node) {
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
                this.errors.push(`Unsupported expression node for TypeScript generation: ${node.name}`);
                return "undefined";
        }
    }
    scopedName(node) {
        var _a;
        const scope = (_a = node.scopeId) !== null && _a !== void 0 ? _a : 0;
        return `${node.value}_${scope}`;
    }
    mapType(type) {
        switch (type) {
            case "int":
                return "number";
            case "string":
                return "string";
            case "boolean":
                return "boolean";
            default:
                this.errors.push(`Unknown type '${type}'`);
                return "unknown";
        }
    }
    defaultValue(type) {
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
    mapBoolOp(op) {
        if (op === "==")
            return "===";
        if (op === "!=")
            return "!==";
        this.errors.push(`Unknown boolean operator '${op}'`);
        return op;
    }
    emitLine(line) {
        const indent = "    ".repeat(this.indentLevel);
        this.output.push(indent + line);
    }
}
