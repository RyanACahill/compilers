import { Logger } from "../util/Logger.js";
export class LLVMIRCodeGenerator {
    constructor() {
        this.output = [];
        this.errors = [];
        this.tempCounter = 0;
        this.stringCounter = 0;
        this.variables = new Map();
        this.strings = [];
    }
    generate(ast) {
        this.output = [];
        this.errors = [];
        this.tempCounter = 0;
        this.stringCounter = 0;
        this.variables = new Map();
        this.strings = [];
        Logger.log("\nLLVM IR CODE GENERATION → Starting LLVM IR generation...\n");
        if (!ast.root) {
            return {
                success: false,
                source: "",
                errors: ["AST root was missing."]
            };
        }
        this.output.push("; Generated LLVM IR");
        this.output.push("declare i32 @printf(i8*, ...)");
        this.output.push("@.intfmt = private constant [4 x i8] c\"%d\\0A\\00\"");
        this.output.push("@.strfmt = private constant [4 x i8] c\"%s\\0A\\00\"");
        this.output.push("");
        this.output.push("define i32 @main() {");
        this.output.push("entry:");
        this.generateNode(ast.root);
        this.output.push("  ret i32 0");
        this.output.push("}");
        const finalSource = [
            ...this.strings,
            ...this.output
        ].join("\n");
        Logger.log("LLVM IR CODE GENERATION → Completed LLVM IR generation.\n");
        return {
            success: this.errors.length === 0,
            source: finalSource,
            errors: this.errors
        };
    }
    generateNode(node) {
        switch (node.name) {
            case "Block":
                for (const child of node.children) {
                    this.generateNode(child);
                }
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
            default:
                this.errors.push(`LLVM IR generator does not yet support node ${node.name}.`);
        }
    }
    generateVarDecl(node) {
        const typeNode = node.children[0];
        const idNode = node.children[1];
        const name = this.scopedName(idNode);
        const llvmType = this.mapType(typeNode.value);
        this.variables.set(name, llvmType);
        this.output.push(`  %${name} = alloca ${llvmType}`);
        if (typeNode.value === "int" || typeNode.value === "boolean") {
            this.output.push(`  store ${llvmType} 0, ${llvmType}* %${name}`);
        }
    }
    generateAssignment(node) {
        const idNode = node.children[0];
        const exprNode = node.children[1];
        const name = this.scopedName(idNode);
        const llvmType = this.variables.get(name);
        if (!llvmType) {
            this.errors.push(`Variable '${name}' was not declared.`);
            return;
        }
        const expr = this.generateExpr(exprNode);
        this.output.push(`  store ${llvmType} ${expr.value}, ${llvmType}* %${name}`);
    }
    generatePrint(node) {
        const expr = this.generateExpr(node.children[0]);
        if (expr.type === "i32" || expr.type === "i1") {
            const value = expr.type === "i1"
                ? this.boolToInt(expr.value)
                : expr.value;
            this.output.push(`  call i32 (i8*, ...) @printf(i8* getelementptr ([4 x i8], [4 x i8]* @.intfmt, i32 0, i32 0), i32 ${value})`);
            return;
        }
        if (expr.type === "i8*") {
            this.output.push(`  call i32 (i8*, ...) @printf(i8* getelementptr ([4 x i8], [4 x i8]* @.strfmt, i32 0, i32 0), i8* ${expr.value})`);
            return;
        }
        this.errors.push(`Cannot print LLVM expression type ${expr.type}.`);
    }
    generateExpr(node) {
        switch (node.name) {
            case "IntExpr":
                if (node.children.length === 1) {
                    return this.generateExpr(node.children[0]);
                }
                const left = this.generateExpr(node.children[0]);
                const right = this.generateExpr(node.children[2]);
                const temp = this.nextTemp();
                this.output.push(`  ${temp} = add i32 ${left.value}, ${right.value}`);
                return {
                    type: "i32",
                    value: temp
                };
            case "Digit":
                return {
                    type: "i32",
                    value: node.value
                };
            case "BoolVal":
                return {
                    type: "i1",
                    value: node.value === "true" ? "1" : "0"
                };
            case "StringExpr":
                return this.makeStringConstant(node.value);
            case "Id": {
                const name = this.scopedName(node);
                const llvmType = this.variables.get(name);
                if (!llvmType) {
                    this.errors.push(`Variable '${name}' was not declared.`);
                    return { type: "i32", value: "0" };
                }
                const temp = this.nextTemp();
                this.output.push(`  ${temp} = load ${llvmType}, ${llvmType}* %${name}`);
                return {
                    type: llvmType,
                    value: temp
                };
            }
            case "BooleanExpr": {
                if (node.children.length === 1) {
                    return this.generateExpr(node.children[0]);
                }
                const leftExpr = this.generateExpr(node.children[0]);
                const rightExpr = this.generateExpr(node.children[2]);
                const op = node.children[1].value === "==" ? "eq" : "ne";
                const temp = this.nextTemp();
                this.output.push(`  ${temp} = icmp ${op} ${leftExpr.type} ${leftExpr.value}, ${rightExpr.value}`);
                return {
                    type: "i1",
                    value: temp
                };
            }
            default:
                this.errors.push(`Unsupported LLVM expression ${node.name}.`);
                return {
                    type: "i32",
                    value: "0"
                };
        }
    }
    boolToInt(value) {
        if (value === "0" || value === "1") {
            return value;
        }
        const temp = this.nextTemp();
        this.output.push(`  ${temp} = zext i1 ${value} to i32`);
        return temp;
    }
    makeStringConstant(value) {
        const id = this.stringCounter++;
        const escaped = value.replace(/\\/g, "\\5C").replace(/"/g, "\\22");
        const length = value.length + 1;
        const globalName = `@.str${id}`;
        this.strings.push(`${globalName} = private constant [${length} x i8] c"${escaped}\\00"`);
        return {
            type: "i8*",
            value: `getelementptr ([${length} x i8], [${length} x i8]* ${globalName}, i32 0, i32 0)`
        };
    }
    scopedName(node) {
        var _a;
        return `${node.value}_${(_a = node.scopeId) !== null && _a !== void 0 ? _a : 0}`;
    }
    mapType(type) {
        switch (type) {
            case "int":
                return "i32";
            case "boolean":
                return "i1";
            case "string":
                return "i8*";
            default:
                this.errors.push(`Unknown type '${type}'.`);
                return "i32";
        }
    }
    nextTemp() {
        return `%t${this.tempCounter++}`;
    }
}
