import { AST } from "../semantic/AST.js";
import { ASTNode } from "../semantic/ASTNode.js";
import { Logger } from "../util/Logger.js";

/**
 * Final result returned by the LLVM IR generator.
 *
 * Includes:
 * - success/failure state
 * - generated LLVM IR source
 * - generation errors
 */
export interface LLVMIRCodeGenResult {
    success: boolean;
    source: string;
    errors: string[];
}

/**
 * Generates LLVM Intermediate Representation (IR)
 * from the optimized AST.
 *
 * Responsibilities:
 * - Generate LLVM variable allocations
 * - Translate expressions into LLVM instructions
 * - Generate print calls using printf
 * - Create string constants
 * - Produce executable LLVM IR source
 */
export class LLVMIRCodeGenerator {

    // Stores generated LLVM IR line-by-line.
    private output: string[] = [];

    // Stores generation errors.
    private errors: string[] = [];

    // Counter for temporary LLVM registers.
    private tempCounter = 0;

    // Counter for generated string constants.
    private stringCounter = 0;

    /**
     * Tracks declared variables and their LLVM types.
     *
     * Key format:
     * variable_scope
     */
    private variables: Map<string, string> = new Map();

    // Stores generated global string constants.
    private strings: string[] = [];

    /**
     * Entry point for LLVM IR generation.
     */
    public generate(ast: AST): LLVMIRCodeGenResult {

        // Reset generator state.
        this.output = [];
        this.errors = [];

        this.tempCounter = 0;
        this.stringCounter = 0;

        this.variables = new Map();
        this.strings = [];

        Logger.log(
            "\nLLVM IR CODE GENERATION → Starting LLVM IR generation...\n"
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
         * LLVM IR program header.
         */
        this.output.push("; Generated LLVM IR");

        // External printf declaration.
        this.output.push(
            "declare i32 @printf(i8*, ...)"
        );

        // Integer print format string.
        this.output.push(
            "@.intfmt = private constant [4 x i8] c\"%d\\0A\\00\""
        );

        // String print format string.
        this.output.push(
            "@.strfmt = private constant [4 x i8] c\"%s\\0A\\00\""
        );

        this.output.push("");

        /**
         * Main function entry.
         */
        this.output.push(
            "define i32 @main() {"
        );

        this.output.push("entry:");

        // Generate all program statements.
        this.generateNode(ast.root);

        // Return success status.
        this.output.push("  ret i32 0");

        this.output.push("}");

        /**
         * Place global string constants
         * before generated code.
         */
        const finalSource = [
            ...this.strings,
            ...this.output
        ].join("\n");

        Logger.log(
            "LLVM IR CODE GENERATION → Completed LLVM IR generation.\n"
        );

        return {
            success: this.errors.length === 0,
            source: finalSource,
            errors: this.errors
        };
    }

    /**
     * Dispatches generation logic based on AST node type.
     */
    private generateNode(node: ASTNode): void {

        switch (node.name) {

            case "Block":

                // Generate all block statements.
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

                this.errors.push(
                    `LLVM IR generator does not yet support node ${node.name}.`
                );
        }
    }

    /**
     * Generates LLVM variable allocation instructions.
     *
     * Example:
     * %a_0 = alloca i32
     */
    private generateVarDecl(node: ASTNode): void {

        const typeNode = node.children[0];
        const idNode = node.children[1];

        const name =
            this.scopedName(idNode);

        // Convert compiler types into LLVM types.
        const llvmType =
            this.mapType(typeNode.value);

        this.variables.set(name, llvmType);

        /**
         * alloca reserves stack memory.
         */
        this.output.push(
            `  %${name} = alloca ${llvmType}`
        );

        /**
         * Initialize primitive types to 0.
         */
        if (
            typeNode.value === "int" ||
            typeNode.value === "boolean"
        ) {

            this.output.push(
                `  store ${llvmType} 0, ${llvmType}* %${name}`
            );
        }
    }

    /**
     * Generates LLVM assignment instructions.
     */
    private generateAssignment(node: ASTNode): void {

        const idNode = node.children[0];
        const exprNode = node.children[1];

        const name =
            this.scopedName(idNode);

        const llvmType =
            this.variables.get(name);

        if (!llvmType) {

            this.errors.push(
                `Variable '${name}' was not declared.`
            );

            return;
        }

        // Generate expression value.
        const expr =
            this.generateExpr(exprNode);

        /**
         * store writes a value into memory.
         */
        this.output.push(
            `  store ${llvmType} ${expr.value}, ${llvmType}* %${name}`
        );
    }

    /**
     * Generates LLVM printf print calls.
     */
    private generatePrint(node: ASTNode): void {

        const expr =
            this.generateExpr(node.children[0]);

        /**
         * Integer and boolean print handling.
         */
        if (
            expr.type === "i32" ||
            expr.type === "i1"
        ) {

            // Booleans must be widened to i32.
            const value =
                expr.type === "i1"
                    ? this.boolToInt(expr.value)
                    : expr.value;

            this.output.push(
                `  call i32 (i8*, ...) @printf(i8* getelementptr ([4 x i8], [4 x i8]* @.intfmt, i32 0, i32 0), i32 ${value})`
            );

            return;
        }

        /**
         * String print handling.
         */
        if (expr.type === "i8*") {

            this.output.push(
                `  call i32 (i8*, ...) @printf(i8* getelementptr ([4 x i8], [4 x i8]* @.strfmt, i32 0, i32 0), i8* ${expr.value})`
            );

            return;
        }

        this.errors.push(
            `Cannot print LLVM expression type ${expr.type}.`
        );
    }

    /**
     * Recursively generates LLVM expressions.
     */
    private generateExpr(
        node: ASTNode
    ): { type: string; value: string } {

        switch (node.name) {

            case "IntExpr":

                // Single integer literal.
                if (node.children.length === 1) {
                    return this.generateExpr(node.children[0]);
                }

                const left =
                    this.generateExpr(node.children[0]);

                const right =
                    this.generateExpr(node.children[2]);

                const temp =
                    this.nextTemp();

                /**
                 * add instruction for integer addition.
                 */
                this.output.push(
                    `  ${temp} = add i32 ${left.value}, ${right.value}`
                );

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

                    // LLVM booleans use 1/0.
                    value:
                        node.value === "true"
                            ? "1"
                            : "0"
                };

            case "StringExpr":

                return this.makeStringConstant(
                    node.value
                );

            case "Id": {

                const name =
                    this.scopedName(node);

                const llvmType =
                    this.variables.get(name);

                if (!llvmType) {

                    this.errors.push(
                        `Variable '${name}' was not declared.`
                    );

                    return {
                        type: "i32",
                        value: "0"
                    };
                }

                const temp =
                    this.nextTemp();

                /**
                 * load reads variable values from memory.
                 */
                this.output.push(
                    `  ${temp} = load ${llvmType}, ${llvmType}* %${name}`
                );

                return {
                    type: llvmType,
                    value: temp
                };
            }

            case "BooleanExpr": {

                // Boolean literal case.
                if (node.children.length === 1) {
                    return this.generateExpr(node.children[0]);
                }

                const leftExpr =
                    this.generateExpr(node.children[0]);

                const rightExpr =
                    this.generateExpr(node.children[2]);

                /**
                 * LLVM comparison operators:
                 * eq = equal
                 * ne = not equal
                 */
                const op =
                    node.children[1].value === "=="
                        ? "eq"
                        : "ne";

                const temp =
                    this.nextTemp();

                /**
                 * icmp performs integer comparison.
                 */
                this.output.push(
                    `  ${temp} = icmp ${op} ${leftExpr.type} ${leftExpr.value}, ${rightExpr.value}`
                );

                return {
                    type: "i1",
                    value: temp
                };
            }

            default:

                this.errors.push(
                    `Unsupported LLVM expression ${node.name}.`
                );

                return {
                    type: "i32",
                    value: "0"
                };
        }
    }

    /**
     * Converts LLVM boolean values into i32 values.
     *
     * Required for printf integer printing.
     */
    private boolToInt(value: string): string {

        // Already an integer-compatible value.
        if (
            value === "0" ||
            value === "1"
        ) {

            return value;
        }

        const temp =
            this.nextTemp();

        /**
         * zext = zero extension instruction.
         *
         * Converts i1 → i32.
         */
        this.output.push(
            `  ${temp} = zext i1 ${value} to i32`
        );

        return temp;
    }

    /**
     * Creates a global LLVM string constant.
     */
    private makeStringConstant(
        value: string
    ): { type: string; value: string } {

        const id =
            this.stringCounter++;

        /**
         * Escape special characters for LLVM syntax.
         */
        const escaped =
            value
                .replace(/\\/g, "\\5C")
                .replace(/"/g, "\\22");

        const length =
            value.length + 1;

        const globalName =
            `@.str${id}`;

        // Create global constant declaration.
        this.strings.push(
            `${globalName} = private constant [${length} x i8] c"${escaped}\\00"`
        );

        return {
            type: "i8*",

            /**
             * getelementptr retrieves pointer
             * to first string character.
             */
            value:
                `getelementptr ([${length} x i8], [${length} x i8]* ${globalName}, i32 0, i32 0)`
        };
    }

    /**
     * Produces a unique variable name using scope IDs.
     */
    private scopedName(node: ASTNode): string {

        return `${node.value}_${node.scopeId ?? 0}`;
    }

    /**
     * Maps compiler language types into LLVM IR types.
     */
    private mapType(type: string): string {

        switch (type) {

            case "int":
                return "i32";

            case "boolean":
                return "i1";

            case "string":
                return "i8*";

            default:

                this.errors.push(
                    `Unknown type '${type}'.`
                );

                return "i32";
        }
    }

    /**
     * Generates a unique temporary LLVM register.
     *
     * Example:
     * %t0
     * %t1
     * %t2
     */
    private nextTemp(): string {

        return `%t${this.tempCounter++}`;
    }
}