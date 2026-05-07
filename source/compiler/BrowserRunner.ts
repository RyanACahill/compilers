import { Lexer } from "../lexer/Lexer.js";
import { Parser } from "../parser/Parser.js";
import { Logger } from "../util/Logger.js";
import { ErrorReporter } from "../util/ErrorReporter.js";
import { SemanticAnalyzer } from "../semantic/SemanticAnalyzer.js";
import type { Diagnostic } from "../util/ErrorReporter.js";
import { CodeGenerator } from "../codegen/CodeGenerator.js";

interface ProgramInfo {
    source: string;
    number: number;
    startLine: number;
}

export interface BrowserRunResult {
    fullOutput: string;
    codeGenOutput: string;
}

export class BrowserRunner {
    public static run(source: string): BrowserRunResult {
        Logger.clear();
        Logger.verbose = true;

        let codeGenOutput = "";

        const programs: ProgramInfo[] = [];

        let currentProgram = "";
        let currentLine = 1;
        let programStartLine = 1;
        let programNumber = 1;

        for (let i = 0; i < source.length; i++) {
            const char = source[i];
            currentProgram += char;

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

            if (char === "\n") {
                currentLine++;
            }
        }

        if (currentProgram.trim().length > 0) {
            programs.push({
                source: currentProgram,
                number: programNumber,
                startLine: programStartLine
            });
        }

        for (const program of programs) {
            if (program.source.trim().length === 0) {
                continue;
            }

            Logger.log(`\n================ PROGRAM ${program.number} ================`);

            const lexer = new Lexer();
            const lexResult = lexer.lex(program.source, program.startLine);

            Logger.log(lexResult.success ? "\nLex successful." : "\nLex unsuccessful.");

            if (lexResult.errors.length > 0 || lexResult.warnings.length > 0) {
                this.printSummary("Lex", lexResult.errors, lexResult.warnings, []);
            }

            if (!lexResult.success) {
                Logger.log("Parse skipped due to lex errors.\n");
                codeGenOutput += `PROGRAM ${program.number}: Code Generation skipped due to lex errors.\n\n`;
                continue;
            }

            const parser = new Parser();
            const parseResult = parser.parse(lexResult.tokens);

            Logger.log(parseResult.success ? "\nParse successful." : "\nParse unsuccessful.");

            if (
                parseResult.errors.length > 0 ||
                parseResult.warnings.length > 0 ||
                parseResult.hints.length > 0
            ) {
                this.printSummary("Parse", parseResult.errors, parseResult.warnings, parseResult.hints);
            }

            if (!parseResult.success) {
                Logger.log("Semantic Analysis skipped due to parse errors.\n");
                codeGenOutput += `PROGRAM ${program.number}: Code Generation skipped due to parse errors.\n\n`;
                continue;
            }

            if (parseResult.cst) {
                Logger.log("\nCST:");
                Logger.log(parseResult.cst.toString());
            }

            const semanticAnalyzer = new SemanticAnalyzer();
            const semanticResult = semanticAnalyzer.analyze(lexResult.tokens);

            Logger.log(
                semanticResult.success
                    ? "\nSemantic Analysis successful."
                    : "\nSemantic Analysis unsuccessful."
            );

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

            if (semanticResult.success) {
                Logger.log("\nAST:");
                Logger.log(semanticResult.ast?.toString() ?? "");

                Logger.log("\nSymbol Table:");
                Logger.log(semanticResult.symbolTable?.toString() ?? "");

                const codeGenerator = new CodeGenerator();
                const codeGenResult = codeGenerator.generate(semanticResult.ast!);

                if (codeGenResult.success) {
                    Logger.log("\nCode Generation successful.");

                    const formattedCode = this.formatMachineCode(codeGenResult.code);

                    Logger.log("\n6502a Machine Code:");
                    Logger.log(formattedCode);

                    codeGenOutput += `PROGRAM ${program.number}\n`;
                    codeGenOutput += formattedCode + "\n\n";
                } else {
                    Logger.log("\nCode Generation unsuccessful.");
                    Logger.log("\nCode Generation Errors:");

                    codeGenOutput += `PROGRAM ${program.number}: Code Generation unsuccessful.\n`;

                    for (const error of codeGenResult.errors) {
                        Logger.error(error);
                        codeGenOutput += `- ${error}\n`;
                    }

                    codeGenOutput += "\n";
                }
            } else {
                Logger.log("Code Generation skipped due to semantic errors.");
                codeGenOutput += `PROGRAM ${program.number}: Code Generation skipped due to semantic errors.\n\n`;
            }
        }

        return {
            fullOutput: Logger.getOutput(),
            codeGenOutput: codeGenOutput.trim()
        };
    }

    private static formatMachineCode(code: string[]): string {
        let output = "";

        for (let i = 0; i < code.length; i += 16) {
            const row = code.slice(i, i + 16).join(" ");
            output += row + "\n";
        }

        return output.trim();
    }

    private static printSummary(
        phase: string,
        errors: Diagnostic[],
        warnings: Diagnostic[],
        hints: Diagnostic[]
    ): void {
        Logger.log(
            `\n${phase} Summary: ${errors.length} error(s), ${warnings.length} warning(s), ${hints.length} hint(s).`
        );

        if (errors.length > 0) {
            Logger.log("Errors:");
            for (const error of errors) {
                Logger.log(`- ${ErrorReporter.format(error)}`);
            }
        }

        if (warnings.length > 0) {
            Logger.log("Warnings:");
            for (const warning of warnings) {
                Logger.log(`- ${ErrorReporter.format(warning)}`);
            }
        }

        if (hints.length > 0) {
            Logger.log("Hints:");
            for (const hint of hints) {
                Logger.log(`- ${ErrorReporter.format(hint)}`);
            }
        }
    }
}