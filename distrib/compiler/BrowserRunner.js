import { Lexer } from "../lexer/Lexer.js";
import { Parser } from "../parser/Parser.js";
import { ErrorReporter } from "../util/ErrorReporter.js";
export class BrowserRunner {
    static run(source) {
        var _a;
        let output = "";
        const programs = source.split("$");
        let programNumber = 1;
        for (let program of programs) {
            program = program.trim();
            if (program.length === 0)
                continue;
            program += "$";
            output += `\n================ PROGRAM ${programNumber} ================\n`;
            const lexer = new Lexer();
            const lexResult = lexer.lex(program);
            output += lexResult.success ? "Lex successful.\n" : "Lex unsuccessful.\n";
            if (!lexResult.success) {
                for (const err of lexResult.errors) {
                    output += ErrorReporter.format(err) + "\n";
                }
                programNumber++;
                continue;
            }
            const parser = new Parser();
            const parseResult = parser.parse(lexResult.tokens);
            output += parseResult.success ? "Parse successful.\n" : "Parse unsuccessful.\n";
            if (parseResult.success) {
                output += "\nCST:\n";
                output += ((_a = parseResult.cst) === null || _a === void 0 ? void 0 : _a.toString()) + "\n";
            }
            else {
                for (const err of parseResult.errors) {
                    output += ErrorReporter.format(err) + "\n";
                }
            }
            programNumber++;
        }
        return output;
    }
}
