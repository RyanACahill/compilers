import { Lexer } from "../lexer/Lexer.js";
import { Parser } from "../parser/Parser.js";
import { Logger } from "../util/Logger.js";
import { SemanticAnalyzer } from "../semantic/SemanticAnalyzer.js";
export class BrowserRunner {
    static run(source) {
        var _a, _b, _c, _d;
        Logger.clear();
        Logger.verbose = true;
        const programs = [];
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
            if (program.source.trim().length === 0)
                continue;
            Logger.log(`\n================ PROGRAM ${program.number} ================`);
            const lexer = new Lexer();
            const lexResult = lexer.lex(program.source, program.startLine);
            Logger.log(lexResult.success ? "\nLex successful." : "\nLex unsuccessful.");
            if (!lexResult.success) {
                Logger.log("Parse skipped due to lex errors.\n");
                continue;
            }
            const parser = new Parser();
            const parseResult = parser.parse(lexResult.tokens);
            if (!parseResult.success) {
                Logger.log("\nParse unsuccessful.\n");
                continue;
            }
            Logger.log("\nParse successful.");
            if (parseResult.cst) {
                Logger.log("\nCST:");
                Logger.log(parseResult.cst.toString());
            }
            const semanticAnalyzer = new SemanticAnalyzer();
            const semanticResult = semanticAnalyzer.analyze(lexResult.tokens);
            if (semanticResult.success) {
                Logger.log("\nSemantic Analysis successful.");
                Logger.log("\nAST:");
                Logger.log((_b = (_a = semanticResult.ast) === null || _a === void 0 ? void 0 : _a.toString()) !== null && _b !== void 0 ? _b : "");
                Logger.log("\nSymbol Table:");
                Logger.log((_d = (_c = semanticResult.symbolTable) === null || _c === void 0 ? void 0 : _c.toString()) !== null && _d !== void 0 ? _d : "");
            }
            else {
                Logger.log("\nSemantic Analysis unsuccessful.");
                Logger.log("Code Generation skipped due to semantic errors.");
            }
        }
        return Logger.getOutput();
    }
}
