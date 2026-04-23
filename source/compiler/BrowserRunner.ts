import { Lexer } from "../lexer/Lexer";
import { Parser } from "../parser/Parser";
import { ErrorReporter } from "../util/ErrorReporter";

export class BrowserRunner {
    public static run(source: string): string {
        let output = "";

        const programs = source.split("$");

        let programNumber = 1;

        for (let program of programs) {
            program = program.trim();
            if (program.length === 0) continue;

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
                output += parseResult.cst?.toString() + "\n";
            } else {
                for (const err of parseResult.errors) {
                    output += ErrorReporter.format(err) + "\n";
                }
            }

            programNumber++;
        }

        return output;
    }
}