import { Lexer } from "../lexer/Lexer.js";
import { Parser } from "../parser/Parser.js";
import { Logger } from "../util/Logger.js";
import { SemanticAnalyzer } from "../semantic/SemanticAnalyzer.js";
export class BrowserRunner {
    static run(source) {
        var _a, _b, _c, _d;
        // Reset logger output
        Logger.clear();
        Logger.verbose = true;
        const programs = source.split("$");
        let programNumber = 1;
        for (let program of programs) {
            if (program.trim().length === 0)
                continue;
            program = program.trim() + "$";
            Logger.log(`\n================ PROGRAM ${programNumber} ================\n`);
            Logger.log("LEXER → Starting lexical analysis...\n");
            const lexer = new Lexer();
            const lexResult = lexer.lex(program);
            if (!lexResult.success) {
                Logger.log("\nLex unsuccessful.\n");
                programNumber++;
                continue;
            }
            Logger.log("\nLex successful.\n");
            Logger.log("PARSER → Starting parse...\n");
            const parser = new Parser();
            const parseResult = parser.parse(lexResult.tokens);
            if (!parseResult.success) {
                Logger.log("\nParse unsuccessful.\n");
                programNumber++;
                continue;
            }
            Logger.log("\nParse successful.\n");
            if (parseResult.cst) {
                Logger.log("\nCST:\n");
                Logger.log(parseResult.cst.toString());
            }
            // ========================
            // SEMANTIC ANALYSIS PHASE
            // ========================
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
            programNumber++;
        }
        // Return EVERYTHING collected
        return Logger.getOutput();
    }
}
