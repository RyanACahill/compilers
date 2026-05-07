import { AST } from "../semantic/AST.js";
import { ASTNode } from "../semantic/ASTNode.js";
import { Logger } from "../util/Logger.js";

export interface CodeGenResult {
    success: boolean;
    code: string[];
    errors: string[];
}

export class CodeGenerator {
    private code: string[] = [];
    private heap: string[] = [];
    private errors: string[] = [];

    private staticTable: Map<string, string> = new Map();
    private tempCounter = 0;

    public generate(ast: AST): CodeGenResult {
        this.code = [];
        this.heap = [];
        this.errors = [];
        this.staticTable = new Map();
        this.tempCounter = 0;

        Logger.log("\nCODE GENERATION → Starting code generation...\n");

        if (!ast.root) {
            this.errors.push("AST root was missing.");
            return this.result(false);
        }

        this.generateNode(ast.root);

        this.emit("00"); // BRK

        this.backpatch();

        Logger.log("\nCODE GENERATION → Completed.\n");

        return this.result(this.errors.length === 0);
    }

    private generateNode(node: ASTNode): void {
        Logger.log(`CODE GENERATION → Visiting ${node.name}`);

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
                Logger.log(`CODE GENERATION → Skipping unsupported node ${node.name}`);
                break;
        }
    }

    private generateVarDecl(node: ASTNode): void {
        const idNode = node.children[1];
        const temp = this.newTemp();

        Logger.log(`CODE GENERATION → Reserving ${temp} for variable '${idNode.value}'`);

        this.staticTable.set(idNode.value, temp);

        // Initialize variable to 00.
        this.emit("A9"); // LDA constant
        this.emit("00");
        this.emit("8D"); // STA memory
        this.emit(temp);
        this.emit("XX");
    }

    private generateAssignment(node: ASTNode): void {
        const idNode = node.children[0];
        const exprNode = node.children[1];

        const temp = this.staticTable.get(idNode.value);

        if (!temp) {
            this.errors.push(`Code generation error: variable '${idNode.value}' was not found in static table.`);
            return;
        }

        this.generateExprIntoAccumulator(exprNode);

        this.emit("8D"); // STA memory
        this.emit(temp);
        this.emit("XX");
    }

    private generatePrint(node: ASTNode): void {
        const exprNode = node.children[0];

        if (exprNode.name === "Id") {
            const temp = this.staticTable.get(exprNode.value);

            if (!temp) {
                this.errors.push(`Code generation error: variable '${exprNode.value}' was not found for print.`);
                return;
            }

            this.emit("AC"); // LDY memory
            this.emit(temp);
            this.emit("XX");

            this.emit("A2"); // LDX constant
            this.emit("01"); // print integer

            this.emit("FF"); // SYS
            return;
        }

        if (exprNode.name === "IntExpr") {
            this.generateExprIntoAccumulator(exprNode);

            const temp = this.newTemp();
            this.emit("8D");
            this.emit(temp);
            this.emit("XX");

            this.emit("AC");
            this.emit(temp);
            this.emit("XX");

            this.emit("A2");
            this.emit("01");

            this.emit("FF");
            return;
        }

        this.errors.push(`Code generation does not yet support printing ${exprNode.name}.`);
    }

    private generateExprIntoAccumulator(node: ASTNode): void {
        if (node.name === "IntExpr") {
            const digitNode = node.children[0];

            this.emit("A9"); // LDA constant
            this.emit(this.toHexByte(Number(digitNode.value)));
            return;
        }

        if (node.name === "Digit") {
            this.emit("A9");
            this.emit(this.toHexByte(Number(node.value)));
            return;
        }

        if (node.name === "Id") {
            const temp = this.staticTable.get(node.value);

            if (!temp) {
                this.errors.push(`Code generation error: variable '${node.value}' was not found.`);
                return;
            }

            this.emit("AD"); // LDA memory
            this.emit(temp);
            this.emit("XX");
            return;
        }

        this.errors.push(`Code generation does not yet support expression ${node.name}.`);
    }

    private backpatch(): void {
        Logger.log("CODE GENERATION → Backpatching static addresses...");

        let address = this.code.length;

        for (const [name, temp] of this.staticTable.entries()) {
            const hexAddress = this.toHexByte(address);

            Logger.log(`CODE GENERATION → ${name} (${temp}) patched to ${hexAddress}`);

            for (let i = 0; i < this.code.length; i++) {
                if (this.code[i] === temp && this.code[i + 1] === "XX") {
                    this.code[i] = hexAddress;
                    this.code[i + 1] = "00";
                }
            }

            address++;
        }

        while (this.code.length < 256) {
            this.code.push("00");
        }

        if (this.code.length > 256) {
            this.errors.push("Generated code exceeded 256 bytes.");
        }
    }

    private emit(byte: string): void {
        this.code.push(byte);
    }

    private newTemp(): string {
        return `T${this.tempCounter++}`;
    }

    private toHexByte(value: number): string {
        return value.toString(16).toUpperCase().padStart(2, "0");
    }

    private result(success: boolean): CodeGenResult {
        return {
            success,
            code: this.code,
            errors: this.errors
        };
    }
}