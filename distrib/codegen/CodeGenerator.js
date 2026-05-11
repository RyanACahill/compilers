import { Logger } from "../util/Logger.js";
/**
 * Generates 6502a machine code from the optimized AST.
 *
 * Responsibilities:
 * - Variable allocation
 * - Expression evaluation
 * - Branch generation
 * - Heap/string storage
 * - Static address backpatching
 */
export class CodeGenerator {
    constructor() {
        // Main executable code segment.
        this.code = [];
        // Collected code generation errors.
        this.errors = [];
        // Tracks variable memory placeholders.
        this.staticTable = [];
        // Tracks unresolved branch instructions.
        this.jumps = [];
        // Counters for unique temporary identifiers.
        this.tempCounter = 0;
        this.jumpCounter = 0;
        /**
         * Heap memory used for storing strings.
         *
         * Strings are written backwards from high memory.
         */
        this.heapMemory = new Map();
        // Heap begins at the top of memory.
        this.heapPointer = 255;
        // Reusable memory slot containing 00.
        this.zeroTemp = null;
    }
    /**
     * Entry point for code generation.
     */
    generate(ast) {
        // Reset generator state.
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
        // AST root is required.
        if (!ast.root) {
            this.errors.push("AST root was missing.");
            return this.result(false);
        }
        // Begin recursive code generation.
        this.generateNode(ast.root);
        // 00 = BRK instruction
        this.emit("00");
        /**
         * Replace temporary placeholders with
         * real memory addresses.
         */
        const finalCode = this.backpatch();
        Logger.log("\nCODE GENERATION → Completed.\n");
        return {
            success: this.errors.length === 0,
            code: finalCode,
            errors: this.errors
        };
    }
    /**
     * Dispatches generation logic based on node type.
     */
    generateNode(node) {
        Logger.log(`CODE GENERATION → Visiting ${node.name}`);
        switch (node.name) {
            case "Block":
                // Generate all child statements.
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
    /**
     * Generates storage allocation for variable declarations.
     */
    generateVarDecl(node) {
        var _a, _b;
        const typeNode = node.children[0];
        const idNode = node.children[1];
        const scope = (_b = (_a = idNode.scopeId) !== null && _a !== void 0 ? _a : node.scopeId) !== null && _b !== void 0 ? _b : 0;
        const temp = this.newTemp();
        Logger.log(`CODE GENERATION → Reserving ${temp} for '${idNode.value}' in scope ${scope}`);
        // Add variable to static table.
        this.staticTable.push({
            temp,
            name: idNode.value,
            scope,
            type: typeNode.value,
            address: null
        });
        /**
         * Initialize variable memory to 00.
         *
         * A9 00 = Load accumulator with 00
         * 8D    = Store accumulator in memory
         */
        this.emit("A9");
        this.emit("00");
        this.emit("8D");
        this.emit(temp);
        this.emit("XX");
    }
    /**
     * Generates assignment instructions.
     */
    generateAssignment(node) {
        const idNode = node.children[0];
        const exprNode = node.children[1];
        const entry = this.lookupStatic(idNode);
        if (!entry) {
            this.errors.push(`Code generation error: variable '${idNode.value}' was not found.`);
            return;
        }
        /**
         * Boolean assignments require
         * special comparison handling.
         */
        if (entry.type === "boolean") {
            this.generateBooleanIntoMemory(exprNode, entry.temp);
            return;
        }
        /**
         * String expressions generate heap pointers.
         */
        if (entry.type === "string") {
            this.generateStringIntoAccumulator(exprNode);
        }
        else {
            // Integer expression generation.
            this.generateExprIntoAccumulator(exprNode);
        }
        // Store result into variable memory.
        this.emit("8D");
        this.emit(entry.temp);
        this.emit("XX");
    }
    /**
     * Generates print system call instructions.
     */
    generatePrint(node) {
        const exprNode = node.children[0];
        /**
         * Variable print case.
         */
        if (exprNode.name === "Id") {
            const entry = this.lookupStatic(exprNode);
            if (!entry) {
                this.errors.push(`Code generation error: variable '${exprNode.value}' was not found for print.`);
                return;
            }
            /**
             * AC = Load Y register from memory.
             */
            this.emit("AC");
            this.emit(entry.temp);
            this.emit("XX");
            /**
             * X register controls print mode:
             * 01 = integer/boolean
             * 02 = string
             */
            this.emit("A2");
            this.emit(entry.type === "string"
                ? "02"
                : "01");
            // FF = System call
            this.emit("FF");
            return;
        }
        /**
         * Direct string literal print.
         */
        if (exprNode.name === "StringExpr") {
            const address = this.writeStringToHeap(exprNode.value);
            this.emit("A0");
            this.emit(this.toHexByte(address));
            this.emit("A2");
            this.emit("02");
            this.emit("FF");
            return;
        }
        /**
         * Boolean print case.
         */
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
        /**
         * Default integer print handling.
         */
        this.generateExprIntoAccumulator(exprNode);
        const temp = this.newInternalStatic("printtemp", "int");
        // Store temporary value.
        this.emit("8D");
        this.emit(temp);
        this.emit("XX");
        // Load into Y register for system call.
        this.emit("AC");
        this.emit(temp);
        this.emit("XX");
        this.emit("A2");
        this.emit("01");
        this.emit("FF");
    }
    /**
     * Generates conditional branch logic for if-statements.
     */
    generateIf(node) {
        const boolExpr = node.children[0];
        const block = node.children[1];
        // Evaluate comparison.
        this.generateComparison(boolExpr);
        // Reserve jump placeholder.
        const jump = this.emitJumpPlaceholder();
        // Generate if-body.
        this.generateNode(block);
        // Patch jump distance.
        this.patchJump(jump);
    }
    /**
     * Generates looping branch logic for while-statements.
     */
    generateWhile(node) {
        // Remember loop start location.
        const loopStart = this.code.length;
        const boolExpr = node.children[0];
        const block = node.children[1];
        this.generateComparison(boolExpr);
        // Jump out of loop if condition fails.
        const exitJump = this.emitJumpPlaceholder();
        this.generateNode(block);
        // Branch back to loop start.
        this.emitAlwaysBranchBack(loopStart);
        // Patch loop exit branch.
        this.patchJump(exitJump);
    }
    /**
     * Generates expressions into the accumulator register.
     */
    generateExprIntoAccumulator(node) {
        /**
         * Integer expression handling.
         */
        if (node.name === "IntExpr") {
            const digitNode = node.children[0];
            /**
             * A9 = Load accumulator constant.
             */
            this.emit("A9");
            this.emit(this.toHexByte(Number(digitNode.value)));
            /**
             * Addition expression handling.
             */
            if (node.children.length === 3) {
                const right = node.children[2];
                const temp = this.newInternalStatic("addtemp", "int");
                // Store left operand temporarily.
                this.emit("8D");
                this.emit(temp);
                this.emit("XX");
                // Generate right operand.
                this.generateExprIntoAccumulator(right);
                /**
                 * 6D = Add with carry from memory.
                 */
                this.emit("6D");
                this.emit(temp);
                this.emit("XX");
            }
            return;
        }
        /**
         * Direct digit literal.
         */
        if (node.name === "Digit") {
            this.emit("A9");
            this.emit(this.toHexByte(Number(node.value)));
            return;
        }
        /**
         * Variable load.
         */
        if (node.name === "Id") {
            const entry = this.lookupStatic(node);
            if (!entry) {
                this.errors.push(`Code generation error: variable '${node.value}' was not found.`);
                return;
            }
            /**
             * AD = Load accumulator from memory.
             */
            this.emit("AD");
            this.emit(entry.temp);
            this.emit("XX");
            return;
        }
        /**
         * Boolean literal handling.
         */
        if (node.name === "BoolVal") {
            this.emit("A9");
            this.emit(node.value === "true"
                ? "01"
                : "00");
            return;
        }
        /**
         * Boolean expression handling.
         */
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
    /**
     * Generates string expressions into the accumulator.
     *
     * The accumulator stores the heap address
     * of the string.
     */
    generateStringIntoAccumulator(node) {
        // Direct string literal.
        if (node.name === "StringExpr") {
            const address = this.writeStringToHeap(node.value);
            this.emit("A9");
            this.emit(this.toHexByte(address));
            return;
        }
        // String variable reference.
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
    /**
     * Generates boolean evaluation logic
     * and stores the result in memory.
     */
    generateBooleanIntoMemory(node, targetTemp) {
        // Simple boolean literal expression.
        if (node.name === "BooleanExpr" &&
            node.children.length === 1) {
            const boolVal = node.children[0];
            this.emit("A9");
            this.emit(boolVal.value === "true"
                ? "01"
                : "00");
            this.emit("8D");
            this.emit(targetTemp);
            this.emit("XX");
            return;
        }
        // Direct BoolVal node.
        if (node.name === "BoolVal") {
            this.emit("A9");
            this.emit(node.value === "true"
                ? "01"
                : "00");
            this.emit("8D");
            this.emit(targetTemp);
            this.emit("XX");
            return;
        }
        /**
         * Default false initialization.
         */
        this.emit("A9");
        this.emit("00");
        this.emit("8D");
        this.emit(targetTemp);
        this.emit("XX");
        // Generate comparison logic.
        this.generateComparison(node);
        const jumpOverTrue = this.emitJumpPlaceholder();
        // Store true if comparison succeeds.
        this.emit("A9");
        this.emit("01");
        this.emit("8D");
        this.emit(targetTemp);
        this.emit("XX");
        this.patchJump(jumpOverTrue);
    }
    /**
     * Generates comparison instructions
     * for boolean expressions.
     */
    generateComparison(node) {
        if (node.name !== "BooleanExpr") {
            this.errors.push(`Expected BooleanExpr for comparison but found ${node.name}.`);
            return;
        }
        /**
         * Single boolean literal comparison.
         */
        if (node.children.length === 1) {
            const boolVal = node.children[0];
            const temp = this.newInternalStatic("boolcompare", "boolean");
            this.emit("A9");
            this.emit(boolVal.value === "true"
                ? "01"
                : "00");
            this.emit("8D");
            this.emit(temp);
            this.emit("XX");
            this.emit("A2");
            this.emit("01");
            /**
             * EC = Compare memory to X register.
             */
            this.emit("EC");
            this.emit(temp);
            this.emit("XX");
            return;
        }
        const left = node.children[0];
        const op = node.children[1];
        const right = node.children[2];
        // Load left expression into X register.
        this.loadXFromExpr(left);
        const rightTemp = this.newInternalStatic("compare", "int");
        // Generate right expression.
        this.generateExprIntoAccumulator(right);
        // Store right value temporarily.
        this.emit("8D");
        this.emit(rightTemp);
        this.emit("XX");
        // Compare X register against memory.
        this.emit("EC");
        this.emit(rightTemp);
        this.emit("XX");
        /**
         * Special handling for != comparisons.
         */
        if (op.value === "!=") {
            const resultTemp = this.newInternalStatic("noteq", "boolean");
            // Default false.
            this.emit("A9");
            this.emit("00");
            this.emit("8D");
            this.emit(resultTemp);
            this.emit("XX");
            const jumpToTrue = this.emitJumpPlaceholder();
            this.emitAlwaysBranchPlaceholder();
            this.patchJump(jumpToTrue);
            // Store true if values differ.
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
    /**
     * Loads an expression value into the X register.
     */
    loadXFromExpr(node) {
        // Variable reference.
        if (node.name === "Id") {
            const entry = this.lookupStatic(node);
            if (!entry) {
                this.errors.push(`Code generation error: variable '${node.value}' was not found.`);
                return;
            }
            /**
             * AE = Load X register from memory.
             */
            this.emit("AE");
            this.emit(entry.temp);
            this.emit("XX");
            return;
        }
        // Integer literal.
        if (node.name === "IntExpr") {
            const digit = node.children[0];
            this.emit("A2");
            this.emit(this.toHexByte(Number(digit.value)));
            return;
        }
        // Boolean literal.
        if (node.name === "BooleanExpr" &&
            node.children.length === 1) {
            const boolVal = node.children[0];
            this.emit("A2");
            this.emit(boolVal.value === "true"
                ? "01"
                : "00");
            return;
        }
        // String literal.
        if (node.name === "StringExpr") {
            const address = this.writeStringToHeap(node.value);
            this.emit("A2");
            this.emit(this.toHexByte(address));
            return;
        }
        this.errors.push(`Cannot load X from expression ${node.name}.`);
    }
    /**
     * Writes a string into heap memory.
     *
     * Strings are stored backwards and terminated with 00.
     */
    writeStringToHeap(value) {
        Logger.log(`CODE GENERATION → Writing string '${value}' to heap`);
        // Null terminator.
        this.heapMemory.set(this.heapPointer, "00");
        this.heapPointer--;
        // Write characters backwards.
        for (let i = value.length - 1; i >= 0; i--) {
            this.heapMemory.set(this.heapPointer, this.toHexByte(value.charCodeAt(i)));
            this.heapPointer--;
        }
        // Return heap start address.
        return this.heapPointer + 1;
    }
    /**
     * Emits a temporary branch placeholder.
     */
    emitJumpPlaceholder() {
        const placeholder = `J${this.jumpCounter++}`;
        const index = this.code.length + 1;
        /**
         * D0 = Branch if Z flag is 0.
         */
        this.emit("D0");
        this.emit(placeholder);
        this.jumps.push({
            placeholder,
            index
        });
        return placeholder;
    }
    /**
     * Emits a guaranteed branch sequence.
     *
     * Used internally for unconditional control flow.
     */
    emitAlwaysBranchPlaceholder() {
        const zero = this.ensureZeroTemp();
        this.emit("A2");
        this.emit("01");
        this.emit("EC");
        this.emit(zero);
        this.emit("XX");
        this.emitJumpPlaceholder();
    }
    /**
     * Emits a backwards branch for loops.
     */
    emitAlwaysBranchBack(targetIndex) {
        const zero = this.ensureZeroTemp();
        this.emit("A2");
        this.emit("01");
        this.emit("EC");
        this.emit(zero);
        this.emit("XX");
        this.emit("D0");
        /**
         * Calculate negative branch distance.
         */
        const distance = 256 - ((this.code.length + 1)
            - targetIndex);
        this.emit(this.toHexByte(distance));
    }
    /**
     * Resolves a branch placeholder with
     * its final jump distance.
     */
    patchJump(placeholder) {
        const jump = this.jumps.find(j => j.placeholder === placeholder);
        if (!jump) {
            this.errors.push(`Jump placeholder ${placeholder} was not found.`);
            return;
        }
        const distance = this.code.length
            - jump.index
            - 1;
        this.code[jump.index] =
            this.toHexByte(distance);
        Logger.log(`CODE GENERATION → Backpatched ${placeholder} with distance ${distance}`);
    }
    /**
     * Creates or retrieves a reusable
     * zero-value memory location.
     */
    ensureZeroTemp() {
        if (this.zeroTemp) {
            return this.zeroTemp;
        }
        this.zeroTemp =
            this.newInternalStatic("zero", "int");
        this.emit("A9");
        this.emit("00");
        this.emit("8D");
        this.emit(this.zeroTemp);
        this.emit("XX");
        return this.zeroTemp;
    }
    /**
     * Creates an internal temporary variable.
     */
    newInternalStatic(name, type) {
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
    /**
     * Searches for a variable in the static table.
     */
    lookupStatic(node) {
        const scope = node.scopeId;
        // First attempt exact scope match.
        if (scope !== null) {
            const exact = this.staticTable.find(e => e.name === node.value &&
                e.scope === scope);
            if (exact) {
                return exact;
            }
        }
        // Fallback search from newest declaration backward.
        for (let i = this.staticTable.length - 1; i >= 0; i--) {
            if (this.staticTable[i].name === node.value) {
                return this.staticTable[i];
            }
        }
        return null;
    }
    /**
     * Replaces temporary placeholders with
     * final memory addresses.
     */
    backpatch() {
        Logger.log("CODE GENERATION → Backpatching static addresses...");
        // Final 256-byte memory image.
        const finalMemory = new Array(256).fill("00");
        // Static area begins after generated code.
        let staticAddress = this.code.length;
        /**
         * Assign real addresses to all static variables.
         */
        for (const entry of this.staticTable) {
            entry.address =
                staticAddress;
            const hexAddress = this.toHexByte(staticAddress);
            Logger.log(`CODE GENERATION → ${entry.name}@${entry.scope} (${entry.temp}) patched to ${hexAddress}`);
            /**
             * Replace temporary placeholders in code.
             */
            for (let i = 0; i < this.code.length; i++) {
                if (this.code[i] === entry.temp &&
                    this.code[i + 1] === "XX") {
                    this.code[i] = hexAddress;
                    this.code[i + 1] = "00";
                }
            }
            staticAddress++;
        }
        /**
         * Detect heap/static collisions.
         */
        if (staticAddress > this.heapPointer) {
            this.errors.push("Generated code/static area collided with heap.");
        }
        /**
         * Detect memory overflow.
         */
        if (this.code.length > 256) {
            this.errors.push("Generated code exceeded 256 bytes.");
        }
        // Copy executable code into final memory image.
        for (let i = 0; i < this.code.length && i < 256; i++) {
            finalMemory[i] = this.code[i];
        }
        // Copy heap memory into final memory image.
        for (const [address, byte] of this.heapMemory.entries()) {
            finalMemory[address] = byte;
        }
        return finalMemory;
    }
    /**
     * Appends a single byte to the code segment.
     */
    emit(byte) {
        this.code.push(byte);
    }
    /**
     * Generates a unique temporary placeholder.
     */
    newTemp() {
        return `T${this.tempCounter++}`;
    }
    /**
     * Converts a numeric value into
     * a two-digit uppercase hexadecimal byte.
     */
    toHexByte(value) {
        return value
            .toString(16)
            .toUpperCase()
            .padStart(2, "0");
    }
    /**
     * Builds the final code generation result object.
     */
    result(success) {
        return {
            success,
            code: this.code,
            errors: this.errors
        };
    }
}
