import { AST } from "../semantic/AST.js";
import { ASTNode } from "../semantic/ASTNode.js";
import { Logger } from "../util/Logger.js";

export interface CodeGenResult {
    success: boolean;
    code: string[];
    errors: string[];
}

interface StaticEntry {
    temp: string;
    name: string;
    scope: number;
    type: string;
    address: number | null;
}

interface JumpEntry {
    placeholder: string;
    index: number;
}

export class CodeGenerator {
    private code: string[] = [];
    private errors: string[] = [];

    private staticTable: StaticEntry[] = [];
    private jumps: JumpEntry[] = [];

    private tempCounter = 0;
    private jumpCounter = 0;

    private heapMemory: Map<number, string> = new Map();
    private heapPointer = 255;

    private zeroTemp: string | null = null;

    public generate(ast: AST): CodeGenResult {
        this.code = [];
        this.errors = [];
        this.staticTable = [];
        this.jumps = [];
        this.tempCounter = 0;
        this.jumpCounter = 0;
        this.heapMemory = new Map();
        this.heapPointer = 255;
        this.zeroTemp = null;

        Logger.log("\nCODE GENERATION → Starting code generation...\n");

        if (!ast.root) {
            this.errors.push("AST root was missing.");
            return this.result(false);
        }

        this.generateNode(ast.root);

        this.emit("00"); // BRK

        const finalCode = this.backpatch();

        Logger.log("\nCODE GENERATION → Completed.\n");

        return {
            success: this.errors.length === 0,
            code: finalCode,
            errors: this.errors
        };
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

            case "If":
                this.generateIf(node);
                break;

            case "While":
                this.generateWhile(node);
                break;

            default:
                Logger.log(`CODE GENERATION → Skipping unsupported node ${node.name}`);
        }
    }

    private generateVarDecl(node: ASTNode): void {
        const typeNode = node.children[0];
        const idNode = node.children[1];

        const scope = idNode.scopeId ?? node.scopeId ?? 0;
        const temp = this.newTemp();

        Logger.log(
            `CODE GENERATION → Reserving ${temp} for '${idNode.value}' in scope ${scope}`
        );

        this.staticTable.push({
            temp,
            name: idNode.value,
            scope,
            type: typeNode.value,
            address: null
        });

        this.emit("A9");
        this.emit("00");
        this.emit("8D");
        this.emit(temp);
        this.emit("XX");
    }

    private generateAssignment(node: ASTNode): void {
        const idNode = node.children[0];
        const exprNode = node.children[1];

        const entry = this.lookupStatic(idNode);

        if (!entry) {
            this.errors.push(`Code generation error: variable '${idNode.value}' was not found.`);
            return;
        }

        if (entry.type === "boolean") {
            this.generateBooleanIntoMemory(exprNode, entry.temp);
            return;
        }

        if (entry.type === "string") {
            this.generateStringIntoAccumulator(exprNode);
        } else {
            this.generateExprIntoAccumulator(exprNode);
        }

        this.emit("8D");
        this.emit(entry.temp);
        this.emit("XX");
    }

    private generatePrint(node: ASTNode): void {
        const exprNode = node.children[0];

        if (exprNode.name === "Id") {
            const entry = this.lookupStatic(exprNode);

            if (!entry) {
                this.errors.push(`Code generation error: variable '${exprNode.value}' was not found for print.`);
                return;
            }

            this.emit("AC");
            this.emit(entry.temp);
            this.emit("XX");

            this.emit("A2");
            this.emit(entry.type === "string" ? "02" : "01");

            this.emit("FF");
            return;
        }

        if (exprNode.name === "StringExpr") {
            const address = this.writeStringToHeap(exprNode.value);

            this.emit("A0");
            this.emit(this.toHexByte(address));

            this.emit("A2");
            this.emit("02");

            this.emit("FF");
            return;
        }

        if (exprNode.name === "BooleanExpr") {
            const temp = this.newInternalStatic("boolprint", "boolean");
            this.generateBooleanIntoMemory(exprNode, temp);

            this.emit("AC");
            this.emit(temp);
            this.emit("XX");

            this.emit("A2");
            this.emit("01");

            this.emit("FF");
            return;
        }

        this.generateExprIntoAccumulator(exprNode);

        const temp = this.newInternalStatic("printtemp", "int");

        this.emit("8D");
        this.emit(temp);
        this.emit("XX");

        this.emit("AC");
        this.emit(temp);
        this.emit("XX");

        this.emit("A2");
        this.emit("01");

        this.emit("FF");
    }

    private generateIf(node: ASTNode): void {
        const boolExpr = node.children[0];
        const block = node.children[1];

        this.generateComparison(boolExpr);

        const jump = this.emitJumpPlaceholder();

        this.generateNode(block);

        this.patchJump(jump);
    }

    private generateWhile(node: ASTNode): void {
        const loopStart = this.code.length;

        const boolExpr = node.children[0];
        const block = node.children[1];

        this.generateComparison(boolExpr);

        const exitJump = this.emitJumpPlaceholder();

        this.generateNode(block);

        this.emitAlwaysBranchBack(loopStart);

        this.patchJump(exitJump);
    }

    private generateExprIntoAccumulator(node: ASTNode): void {
        if (node.name === "IntExpr") {
            const digitNode = node.children[0];

            this.emit("A9");
            this.emit(this.toHexByte(Number(digitNode.value)));

            if (node.children.length === 3) {
                const right = node.children[2];
                const temp = this.newInternalStatic("addtemp", "int");

                this.emit("8D");
                this.emit(temp);
                this.emit("XX");

                this.generateExprIntoAccumulator(right);

                this.emit("6D");
                this.emit(temp);
                this.emit("XX");
            }

            return;
        }

        if (node.name === "Digit") {
            this.emit("A9");
            this.emit(this.toHexByte(Number(node.value)));
            return;
        }

        if (node.name === "Id") {
            const entry = this.lookupStatic(node);

            if (!entry) {
                this.errors.push(`Code generation error: variable '${node.value}' was not found.`);
                return;
            }

            this.emit("AD");
            this.emit(entry.temp);
            this.emit("XX");
            return;
        }

        if (node.name === "BoolVal") {
            this.emit("A9");
            this.emit(node.value === "true" ? "01" : "00");
            return;
        }

        if (node.name === "BooleanExpr") {
            const temp = this.newInternalStatic("boolexpr", "boolean");
            this.generateBooleanIntoMemory(node, temp);

            this.emit("AD");
            this.emit(temp);
            this.emit("XX");
            return;
        }

        this.errors.push(`Code generation does not yet support expression ${node.name}.`);
    }

    private generateStringIntoAccumulator(node: ASTNode): void {
        if (node.name === "StringExpr") {
            const address = this.writeStringToHeap(node.value);

            this.emit("A9");
            this.emit(this.toHexByte(address));
            return;
        }

        if (node.name === "Id") {
            const entry = this.lookupStatic(node);

            if (!entry) {
                this.errors.push(`Code generation error: string variable '${node.value}' was not found.`);
                return;
            }

            this.emit("AD");
            this.emit(entry.temp);
            this.emit("XX");
            return;
        }

        this.errors.push(`Code generation expected string expression but found ${node.name}.`);
    }

    private generateBooleanIntoMemory(node: ASTNode, targetTemp: string): void {
        if (node.name === "BooleanExpr" && node.children.length === 1) {
            const boolVal = node.children[0];

            this.emit("A9");
            this.emit(boolVal.value === "true" ? "01" : "00");
            this.emit("8D");
            this.emit(targetTemp);
            this.emit("XX");
            return;
        }

        if (node.name === "BoolVal") {
            this.emit("A9");
            this.emit(node.value === "true" ? "01" : "00");
            this.emit("8D");
            this.emit(targetTemp);
            this.emit("XX");
            return;
        }

        this.emit("A9");
        this.emit("00");
        this.emit("8D");
        this.emit(targetTemp);
        this.emit("XX");

        this.generateComparison(node);

        const jumpOverTrue = this.emitJumpPlaceholder();

        this.emit("A9");
        this.emit("01");
        this.emit("8D");
        this.emit(targetTemp);
        this.emit("XX");

        this.patchJump(jumpOverTrue);
    }

    private generateComparison(node: ASTNode): void {
        if (node.name !== "BooleanExpr") {
            this.errors.push(`Expected BooleanExpr for comparison but found ${node.name}.`);
            return;
        }

        if (node.children.length === 1) {
            const boolVal = node.children[0];
            const temp = this.newInternalStatic("boolcompare", "boolean");

            this.emit("A9");
            this.emit(boolVal.value === "true" ? "01" : "00");
            this.emit("8D");
            this.emit(temp);
            this.emit("XX");

            this.emit("A2");
            this.emit("01");
            this.emit("EC");
            this.emit(temp);
            this.emit("XX");
            return;
        }

        const left = node.children[0];
        const op = node.children[1];
        const right = node.children[2];

        this.loadXFromExpr(left);

        const rightTemp = this.newInternalStatic("compare", "int");
        this.generateExprIntoAccumulator(right);

        this.emit("8D");
        this.emit(rightTemp);
        this.emit("XX");

        this.emit("EC");
        this.emit(rightTemp);
        this.emit("XX");

        if (op.value === "!=") {
            const resultTemp = this.newInternalStatic("noteq", "boolean");

            this.emit("A9");
            this.emit("00");
            this.emit("8D");
            this.emit(resultTemp);
            this.emit("XX");

            const jumpToTrue = this.emitJumpPlaceholder();

            this.emitAlwaysBranchPlaceholder();

            this.patchJump(jumpToTrue);

            this.emit("A9");
            this.emit("01");
            this.emit("8D");
            this.emit(resultTemp);
            this.emit("XX");

            this.emit("A2");
            this.emit("01");
            this.emit("EC");
            this.emit(resultTemp);
            this.emit("XX");
        }
    }

    private loadXFromExpr(node: ASTNode): void {
        if (node.name === "Id") {
            const entry = this.lookupStatic(node);

            if (!entry) {
                this.errors.push(`Code generation error: variable '${node.value}' was not found.`);
                return;
            }

            this.emit("AE");
            this.emit(entry.temp);
            this.emit("XX");
            return;
        }

        if (node.name === "IntExpr") {
            const digit = node.children[0];
            this.emit("A2");
            this.emit(this.toHexByte(Number(digit.value)));
            return;
        }

        if (node.name === "BooleanExpr" && node.children.length === 1) {
            const boolVal = node.children[0];
            this.emit("A2");
            this.emit(boolVal.value === "true" ? "01" : "00");
            return;
        }

        if (node.name === "StringExpr") {
            const address = this.writeStringToHeap(node.value);
            this.emit("A2");
            this.emit(this.toHexByte(address));
            return;
        }

        this.errors.push(`Cannot load X from expression ${node.name}.`);
    }

    private writeStringToHeap(value: string): number {
        Logger.log(`CODE GENERATION → Writing string '${value}' to heap`);

        this.heapMemory.set(this.heapPointer, "00");
        this.heapPointer--;

        for (let i = value.length - 1; i >= 0; i--) {
            this.heapMemory.set(this.heapPointer, this.toHexByte(value.charCodeAt(i)));
            this.heapPointer--;
        }

        return this.heapPointer + 1;
    }

    private emitJumpPlaceholder(): string {
        const placeholder = `J${this.jumpCounter++}`;
        const index = this.code.length + 1;

        this.emit("D0");
        this.emit(placeholder);

        this.jumps.push({ placeholder, index });

        return placeholder;
    }

    private emitAlwaysBranchPlaceholder(): void {
        const zero = this.ensureZeroTemp();

        this.emit("A2");
        this.emit("01");
        this.emit("EC");
        this.emit(zero);
        this.emit("XX");

        this.emitJumpPlaceholder();
    }

    private emitAlwaysBranchBack(targetIndex: number): void {
        const zero = this.ensureZeroTemp();

        this.emit("A2");
        this.emit("01");
        this.emit("EC");
        this.emit(zero);
        this.emit("XX");

        this.emit("D0");

        const distance = 256 - ((this.code.length + 1) - targetIndex);
        this.emit(this.toHexByte(distance));
    }

    private patchJump(placeholder: string): void {
        const jump = this.jumps.find(j => j.placeholder === placeholder);

        if (!jump) {
            this.errors.push(`Jump placeholder ${placeholder} was not found.`);
            return;
        }

        const distance = this.code.length - jump.index - 1;
        this.code[jump.index] = this.toHexByte(distance);

        Logger.log(`CODE GENERATION → Backpatched ${placeholder} with distance ${distance}`);
    }

    private ensureZeroTemp(): string {
        if (this.zeroTemp) return this.zeroTemp;

        this.zeroTemp = this.newInternalStatic("zero", "int");

        this.emit("A9");
        this.emit("00");
        this.emit("8D");
        this.emit(this.zeroTemp);
        this.emit("XX");

        return this.zeroTemp;
    }

    private newInternalStatic(name: string, type: string): string {
        const temp = this.newTemp();

        this.staticTable.push({
            temp,
            name: `__${name}${this.tempCounter}`,
            scope: -1,
            type,
            address: null
        });

        return temp;
    }

    private lookupStatic(node: ASTNode): StaticEntry | null {
        const scope = node.scopeId;

        if (scope !== null) {
            const exact = this.staticTable.find(e => e.name === node.value && e.scope === scope);
            if (exact) return exact;
        }

        for (let i = this.staticTable.length - 1; i >= 0; i--) {
            if (this.staticTable[i].name === node.value) {
                return this.staticTable[i];
            }
        }

        return null;
    }

    private backpatch(): string[] {
        Logger.log("CODE GENERATION → Backpatching static addresses...");

        const finalMemory = new Array<string>(256).fill("00");

        let staticAddress = this.code.length;

        for (const entry of this.staticTable) {
            entry.address = staticAddress;
            const hexAddress = this.toHexByte(staticAddress);

            Logger.log(
                `CODE GENERATION → ${entry.name}@${entry.scope} (${entry.temp}) patched to ${hexAddress}`
            );

            for (let i = 0; i < this.code.length; i++) {
                if (this.code[i] === entry.temp && this.code[i + 1] === "XX") {
                    this.code[i] = hexAddress;
                    this.code[i + 1] = "00";
                }
            }

            staticAddress++;
        }

        if (staticAddress > this.heapPointer) {
            this.errors.push("Generated code/static area collided with heap.");
        }

        if (this.code.length > 256) {
            this.errors.push("Generated code exceeded 256 bytes.");
        }

        for (let i = 0; i < this.code.length && i < 256; i++) {
            finalMemory[i] = this.code[i];
        }

        for (const [address, byte] of this.heapMemory.entries()) {
            finalMemory[address] = byte;
        }

        return finalMemory;
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