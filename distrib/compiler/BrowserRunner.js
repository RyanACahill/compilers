import { Lexer } from "../lexer/Lexer.js";
import { Parser } from "../parser/Parser.js";
import { Logger } from "../util/Logger.js";
export class BrowserRunner {
    static run(source) {
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
            programNumber++;
        }
        // Return EVERYTHING collected
        return Logger.getOutput();
    }
}
