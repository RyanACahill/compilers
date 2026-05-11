import { Lexer } from "../lexer/Lexer.js";
import { Parser } from "../parser/Parser.js";
import { Logger } from "../util/Logger.js";
import { ErrorReporter } from "../util/ErrorReporter.js";
import { SemanticAnalyzer } from "../semantic/SemanticAnalyzer.js";
import type { Diagnostic } from "../util/ErrorReporter.js";
import { CodeGenerator } from "../codegen/CodeGenerator.js";
import { ASTOptimizer } from "../semantic/ASTOptimizer.js";
import { TypeScriptCodeGenerator } from "../codegen/TypeScriptCodeGenerator.js";
import { LLVMIRCodeGenerator } from "../codegen/LLVMIRCodeGenerator.js";
import { JavaCodeGenerator } from "../codegen/JavaCodeGenerator.js";
import { LexerRepair } from "../lexer/LexerRepair.js";
import { ParserRepair } from "../parser/ParserRepair.js";

/**
 * Multiple programs may exist in one source file,
 * separated by the '$' end-of-program marker.
 */
interface ProgramInfo {
    source: string;
    number: number;
    startLine: number;
}

/**
 * Final result returned to the browser UI.
 *
 * Includes:
 * - full compiler logs
 * - machine code output
 * - generated TypeScript
 * - generated LLVM IR
 * - generated Java source
 */
export interface BrowserRunResult {
    fullOutput: string;
    codeGenOutput: string;
    tsOutput: string;
    llvmirOutput: string;
    javaOutput: string;
}

/**
 * Browser-based compiler execution runner.
 *
 * Coordinates the complete compiler pipeline:
 * - Lexer
 * - Parser
 * - Semantic Analysis
 * - AST Optimization
 * - Code Generation
 *
 * Also manages compiler logging and browser output formatting.
 */
export class BrowserRunner {

    /**
     * Executes the compiler pipeline on browser input source code.
     */
    public static run(source: string): BrowserRunResult {

        // Reset logger state before compilation begins.
        Logger.clear();

        Logger.verbose = true;

        // Final generated outputs for each backend target.
        let codeGenOutput = "";
        let llvmirOutput = "";
        let javaOutput = "";
        let tsOutput = "";

        // Stores all discovered programs from the source input.
        const programs: ProgramInfo[] = [];

        // Temporary program parsing state.
        let currentProgram = "";
        let currentLine = 1;
        let programStartLine = 1;
        let programNumber = 1;

        /**
         * Split the full input stream into separate programs.
         *
         * Programs are delimited using '$'.
         */
        for (let i = 0; i < source.length; i++) {

            const char = source[i];

            currentProgram += char;

            // End-of-program marker found.
            if (char === "$") {

                programs.push({
                    source: currentProgram,
                    number: programNumber,
                    startLine: programStartLine
                });

                currentProgram = "";

                programNumber++;

                programStartLine = currentLine;
            }

            // Track source line numbers.
            if (char === "\n") {
                currentLine++;
            }
        }

        /**
         * Handle programs missing a trailing '$'.
         */
        if (currentProgram.trim().length > 0) {

            programs.push({
                source: currentProgram,
                number: programNumber,
                startLine: programStartLine
            });
        }

        /**
         * Compile each discovered program independently.
         */
        for (const program of programs) {

            if (program.source.trim().length === 0) {
                continue;
            }

            Logger.log(
                `\n================ PROGRAM ${program.number} ================`
            );

            /**
             * ======================
             * LEXER REPAIR PHASE
             * ======================
             */

            const lexerRepairResult =
                LexerRepair.repair(program.source);

            const sourceForLex =
                lexerRepairResult.repairedSource;

            /**
             * ======================
             * LEXER PHASE
             * ======================
             */

            const lexer = new Lexer();

            const lexResult =
                lexer.lex(sourceForLex, program.startLine);

            Logger.log(
                lexResult.success
                    ? "\nLex successful."
                    : "\nLex unsuccessful."
            );

            // Print lexer diagnostics.
            if (
                lexResult.errors.length > 0 ||
                lexResult.warnings.length > 0
            ) {

                this.printSummary(
                    "Lex",
                    lexResult.errors,
                    lexResult.warnings,
                    []
                );
            }

            // Stop compilation if lexing failed.
            if (!lexResult.success) {

                Logger.log(
                    "Parse skipped due to lex errors.\n"
                );

                codeGenOutput +=
                    `PROGRAM ${program.number}: Code Generation skipped due to lex errors.\n\n`;

                continue;
            }

            /**
             * ======================
             * PARSER REPAIR PHASE
             * ======================
             */

            const parserRepairResult =
                ParserRepair.repair(lexResult.tokens);

            const tokensForParse =
                parserRepairResult.tokens;

            /**
             * ======================
             * PARSER PHASE
             * ======================
             */

            const parser = new Parser();

            const parseResult =
                parser.parse(tokensForParse);

            Logger.log(
                parseResult.success
                    ? "\nParse successful."
                    : "\nParse unsuccessful."
            );

            // Print parser diagnostics.
            if (
                parseResult.errors.length > 0 ||
                parseResult.warnings.length > 0 ||
                parseResult.hints.length > 0
            ) {

                this.printSummary(
                    "Parse",
                    parseResult.errors,
                    parseResult.warnings,
                    parseResult.hints
                );
            }

            // Stop compilation if parsing failed.
            if (!parseResult.success) {

                Logger.log(
                    "Semantic Analysis skipped due to parse errors.\n"
                );

                codeGenOutput +=
                    `PROGRAM ${program.number}: Code Generation skipped due to parse errors.\n\n`;

                continue;
            }

            /**
             * Display generated CST.
             */
            if (parseResult.cst) {

                Logger.log("\nCST:");

                Logger.log(parseResult.cst.toString());
            }

            /**
             * ======================
             * SEMANTIC ANALYSIS PHASE
             * ======================
             */

            const semanticAnalyzer =
                new SemanticAnalyzer();

            const semanticResult =
                semanticAnalyzer.analyze(tokensForParse);

            Logger.log(
                semanticResult.success
                    ? "\nSemantic Analysis successful."
                    : "\nSemantic Analysis unsuccessful."
            );

            // Print semantic diagnostics.
            if (
                semanticResult.errors.length > 0 ||
                semanticResult.warnings.length > 0 ||
                semanticResult.hints.length > 0
            ) {

                this.printSummary(
                    "Semantic Analysis",
                    semanticResult.errors,
                    semanticResult.warnings,
                    semanticResult.hints
                );
            }

            /**
             * Continue only if semantic analysis succeeded.
             */
            if (semanticResult.success) {

                Logger.log("\nAST Before Optimization:");

                Logger.log(
                    semanticResult.ast?.toString() ?? ""
                );

                /**
                 * ======================
                 * AST OPTIMIZATION PHASE
                 * ======================
                 */

                const optimizer = new ASTOptimizer();

                const optimizedAst =
                    optimizer.optimize(semanticResult.ast!);

                Logger.log("\nAST After Optimization:");

                Logger.log(optimizedAst.toString());

                /**
                 * Display generated symbol table.
                 */
                Logger.log("\nSymbol Table:");

                Logger.log(
                    semanticResult.symbolTable?.toString() ?? ""
                );

                /**
                 * ======================
                 * 6502 CODE GENERATION
                 * ======================
                 */

                const codeGenerator =
                    new CodeGenerator();

                const codeGenResult =
                    codeGenerator.generate(optimizedAst);

                if (codeGenResult.success) {

                    Logger.log(
                        "\nCode Generation successful."
                    );

                    const formattedCode =
                        this.formatMachineCode(
                            codeGenResult.code
                        );

                    Logger.log(
                        "\n6502a Machine Code:"
                    );

                    Logger.log(formattedCode);

                    codeGenOutput +=
                        `PROGRAM ${program.number}\n`;

                    codeGenOutput +=
                        formattedCode + "\n\n";

                    /**
                     * ======================
                     * TYPESCRIPT GENERATION
                     * ======================
                     */

                    const tsGenerator =
                        new TypeScriptCodeGenerator();

                    const tsResult =
                        tsGenerator.generate(
                            semanticResult.ast!
                        );

                    if (tsResult.success) {

                        Logger.log(
                            "\nTypeScript Code Generation successful."
                        );

                        Logger.log(
                            "\nGenerated TypeScript Source:"
                        );

                        Logger.log(tsResult.source);

                        tsOutput +=
                            `PROGRAM ${program.number}\n`;

                        tsOutput +=
                            tsResult.source + "\n\n";

                    } else {

                        Logger.log(
                            "\nTypeScript Code Generation unsuccessful."
                        );

                        for (const error of tsResult.errors) {
                            Logger.error(error);
                        }
                    }

                    /**
                     * ======================
                     * LLVM IR GENERATION
                     * ======================
                     */

                    const llvmGenerator =
                        new LLVMIRCodeGenerator();

                    const llvmResult =
                        llvmGenerator.generate(
                            optimizedAst
                        );

                    if (llvmResult.success) {

                        Logger.log(
                            "\nLLVM IR Code Generation successful."
                        );

                        Logger.log(
                            "\nGenerated LLVM IR:"
                        );

                        Logger.log(
                            llvmResult.source
                        );

                        llvmirOutput +=
                            `PROGRAM ${program.number}\n`;

                        llvmirOutput +=
                            llvmResult.source + "\n\n";

                    } else {

                        Logger.log(
                            "\nLLVM IR Code Generation unsuccessful."
                        );

                        llvmirOutput +=
                            `PROGRAM ${program.number}: LLVM IR Code Generation unsuccessful.\n`;

                        for (const error of llvmResult.errors) {

                            Logger.error(error);

                            llvmirOutput +=
                                `- ${error}\n`;
                        }

                        llvmirOutput += "\n";
                    }

                    /**
                     * ======================
                     * JAVA GENERATION
                     * ======================
                     */

                    const javaGenerator =
                        new JavaCodeGenerator();

                    const javaResult =
                        javaGenerator.generate(
                            optimizedAst
                        );

                    if (javaResult.success) {

                        Logger.log(
                            "\nJava Code Generation successful."
                        );

                        Logger.log(
                            "\nGenerated Java Source:"
                        );

                        Logger.log(
                            javaResult.source
                        );

                        javaOutput +=
                            `PROGRAM ${program.number}\n`;

                        javaOutput +=
                            javaResult.source + "\n\n";

                    } else {

                        Logger.log(
                            "\nJava Code Generation unsuccessful."
                        );

                        javaOutput +=
                            `PROGRAM ${program.number}: Java Code Generation unsuccessful.\n`;

                        for (const error of javaResult.errors) {

                            Logger.error(error);

                            javaOutput +=
                                `- ${error}\n`;
                        }

                        javaOutput += "\n";
                    }

                } else {

                    Logger.log(
                        "\nCode Generation unsuccessful."
                    );

                    Logger.log(
                        "\nCode Generation Errors:"
                    );

                    codeGenOutput +=
                        `PROGRAM ${program.number}: Code Generation unsuccessful.\n`;

                    for (const error of codeGenResult.errors) {

                        Logger.error(error);

                        codeGenOutput +=
                            `- ${error}\n`;
                    }

                    codeGenOutput += "\n";
                }

            } else {

                Logger.log(
                    "Code Generation skipped due to semantic errors."
                );

                codeGenOutput +=
                    `PROGRAM ${program.number}: Code Generation skipped due to semantic errors.\n\n`;
            }
        }

        /**
         * Return all browser-visible compiler outputs.
         */
        return {
            fullOutput: Logger.getOutput(),
            codeGenOutput: codeGenOutput.trim(),
            tsOutput: tsOutput.trim(),
            llvmirOutput: llvmirOutput.trim(),
            javaOutput: javaOutput.trim()
        };
    }

    /**
     * Formats machine code into rows of 16 bytes
     * for improved readability.
     */
    private static formatMachineCode(
        code: string[]
    ): string {

        let output = "";

        for (let i = 0; i < code.length; i += 16) {

            const row =
                code.slice(i, i + 16).join(" ");

            output += row + "\n";
        }

        return output.trim();
    }

    /**
     * Prints a formatted diagnostic summary
     * for a compiler phase.
     */
    private static printSummary(
        phase: string,
        errors: Diagnostic[],
        warnings: Diagnostic[],
        hints: Diagnostic[]
    ): void {

        Logger.log(
            `\n${phase} Summary: ${errors.length} error(s), ${warnings.length} warning(s), ${hints.length} hint(s).`
        );

        // Print all errors.
        if (errors.length > 0) {

            Logger.log("Errors:");

            for (const error of errors) {
                Logger.log(
                    `- ${ErrorReporter.format(error)}`
                );
            }
        }

        // Print all warnings.
        if (warnings.length > 0) {

            Logger.log("Warnings:");

            for (const warning of warnings) {
                Logger.log(
                    `- ${ErrorReporter.format(warning)}`
                );
            }
        }

        // Print all hints.
        if (hints.length > 0) {

            Logger.log("Hints:");

            for (const hint of hints) {
                Logger.log(
                    `- ${ErrorReporter.format(hint)}`
                );
            }
        }
    }
}