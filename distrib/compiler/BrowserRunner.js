import { Lexer } from "../lexer/Lexer.js";
import { Parser } from "../parser/Parser.js";
import { Logger } from "../util/Logger.js";
import { ErrorReporter } from "../util/ErrorReporter.js";
import { SemanticAnalyzer } from "../semantic/SemanticAnalyzer.js";
import { CodeGenerator } from "../codegen/CodeGenerator.js";
import { ASTOptimizer } from "../semantic/ASTOptimizer.js";
import { TypeScriptCodeGenerator } from "../codegen/TypeScriptCodeGenerator.js";
export class BrowserRunner {
    static run(source) {
        var _a, _b, _c, _d;
        Logger.clear();
        Logger.verbose = true;
        let codeGenOutput = "";
        const programs = [];
        let currentProgram = "";
        let currentLine = 1;
        let programStartLine = 1;
        let programNumber = 1;
        let tsOutput = "";
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
            if (parseResult.errors.length > 0 ||
                parseResult.warnings.length > 0 ||
                parseResult.hints.length > 0) {
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
            Logger.log(semanticResult.success
                ? "\nSemantic Analysis successful."
                : "\nSemantic Analysis unsuccessful.");
            if (semanticResult.errors.length > 0 ||
                semanticResult.warnings.length > 0 ||
                semanticResult.hints.length > 0) {
                this.printSummary("Semantic Analysis", semanticResult.errors, semanticResult.warnings, semanticResult.hints);
            }
            if (semanticResult.success) {
                Logger.log("\nAST Before Optimization:");
                Logger.log((_b = (_a = semanticResult.ast) === null || _a === void 0 ? void 0 : _a.toString()) !== null && _b !== void 0 ? _b : "");
                const optimizer = new ASTOptimizer();
                const optimizedAst = optimizer.optimize(semanticResult.ast);
                Logger.log("\nAST After Optimization:");
                Logger.log(optimizedAst.toString());
                Logger.log("\nSymbol Table:");
                Logger.log((_d = (_c = semanticResult.symbolTable) === null || _c === void 0 ? void 0 : _c.toString()) !== null && _d !== void 0 ? _d : "");
                const codeGenerator = new CodeGenerator();
                const codeGenResult = codeGenerator.generate(optimizedAst);
                if (codeGenResult.success) {
                    Logger.log("\nCode Generation successful.");
                    const formattedCode = this.formatMachineCode(codeGenResult.code);
                    Logger.log("\n6502a Machine Code:");
                    Logger.log(formattedCode);
                    codeGenOutput += `PROGRAM ${program.number}\n`;
                    codeGenOutput += formattedCode + "\n\n";
                    const tsGenerator = new TypeScriptCodeGenerator();
                    const tsResult = tsGenerator.generate(semanticResult.ast);
                    if (tsResult.success) {
                        Logger.log("\nTypeScript Code Generation successful.");
                        Logger.log("\nGenerated TypeScript Source:");
                        Logger.log(tsResult.source);
                        tsOutput += `PROGRAM ${program.number}\n`;
                        tsOutput += tsResult.source + "\n\n";
                    }
                    else {
                        Logger.log("\nTypeScript Code Generation unsuccessful.");
                        for (const error of tsResult.errors) {
                            Logger.error(error);
                        }
                    }
                }
                else {
                    Logger.log("\nCode Generation unsuccessful.");
                    Logger.log("\nCode Generation Errors:");
                    codeGenOutput += `PROGRAM ${program.number}: Code Generation unsuccessful.\n`;
                    for (const error of codeGenResult.errors) {
                        Logger.error(error);
                        codeGenOutput += `- ${error}\n`;
                    }
                    codeGenOutput += "\n";
                }
            }
            else {
                Logger.log("Code Generation skipped due to semantic errors.");
                codeGenOutput += `PROGRAM ${program.number}: Code Generation skipped due to semantic errors.\n\n`;
            }
        }
        return {
            fullOutput: Logger.getOutput(),
            codeGenOutput: codeGenOutput.trim(),
            tsOutput: tsOutput.trim()
        };
    }
    static formatMachineCode(code) {
        let output = "";
        for (let i = 0; i < code.length; i += 16) {
            const row = code.slice(i, i + 16).join(" ");
            output += row + "\n";
        }
        return output.trim();
    }
    static printSummary(phase, errors, warnings, hints) {
        Logger.log(`\n${phase} Summary: ${errors.length} error(s), ${warnings.length} warning(s), ${hints.length} hint(s).`);
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
