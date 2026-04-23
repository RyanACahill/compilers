import { Lexer } from "../lexer/Lexer.js";
import { Parser } from "../parser/Parser.js";
import { ErrorReporter } from "../util/ErrorReporter.js";
import { Logger } from "../util/Logger.js";

export class BrowserRunner {
    public static run(source: string): string {
        let output = "";

        const programs = source.split("$");
        let programNumber = 1;

        for (let program of programs) {
            if (program.trim().length === 0) {
                continue;
            }

            program = program.trim() + "$";

            output += `\n================ PROGRAM ${programNumber} ================\n\n`;

            // Capture verbose output for this program
            const originalLog = console.log;
            const originalError = console.error;
            const originalWarn = console.warn;

            const captured: string[] = [];

            console.log = (...args: unknown[]) => {
                captured.push(args.join(" "));
            };

            console.error = (...args: unknown[]) => {
                captured.push(args.join(" "));
            };

            console.warn = (...args: unknown[]) => {
                captured.push(args.join(" "));
            };

            try {
                Logger.verbose = true;

                const lexer = new Lexer();
                const lexResult = lexer.lex(program);

                output += captured.join("\n");
                captured.length = 0;

                output += "\n";
                output += lexResult.success ? "Lex successful.\n" : "Lex unsuccessful.\n";

                if (lexResult.errors.length > 0 || lexResult.warnings.length > 0) {
                    output += "\nLex Summary:\n";

                    if (lexResult.errors.length > 0) {
                        output += "Errors:\n";
                        for (const err of lexResult.errors) {
                            output += `- ${ErrorReporter.format(err)}\n`;
                        }
                    }

                    if (lexResult.warnings.length > 0) {
                        output += "Warnings:\n";
                        for (const warning of lexResult.warnings) {
                            output += `- ${ErrorReporter.format(warning)}\n`;
                        }
                    }
                }

                if (!lexResult.success) {
                    output += "\nParse skipped due to lex errors.\n\n";
                    programNumber++;
                    continue;
                }

                const parser = new Parser();
                const parseResult = parser.parse(lexResult.tokens);

                output += captured.join("\n");
                captured.length = 0;

                output += "\n";
                output += parseResult.success ? "Parse successful.\n" : "Parse unsuccessful.\n";

                if (
                    parseResult.errors.length > 0 ||
                    parseResult.warnings.length > 0 ||
                    parseResult.hints.length > 0
                ) {
                    output += "\nParse Summary:\n";

                    if (parseResult.errors.length > 0) {
                        output += "Errors:\n";
                        for (const err of parseResult.errors) {
                            output += `- ${ErrorReporter.format(err)}\n`;
                        }
                    }

                    if (parseResult.warnings.length > 0) {
                        output += "Warnings:\n";
                        for (const warning of parseResult.warnings) {
                            output += `- ${ErrorReporter.format(warning)}\n`;
                        }
                    }

                    if (parseResult.hints.length > 0) {
                        output += "Hints:\n";
                        for (const hint of parseResult.hints) {
                            output += `- ${ErrorReporter.format(hint)}\n`;
                        }
                    }
                }

                if (parseResult.success && parseResult.cst) {
                    output += "\nCST:\n";
                    output += parseResult.cst.toString() + "\n";
                }

                output += "\n";
                programNumber++;
            } finally {
                console.log = originalLog;
                console.error = originalError;
                console.warn = originalWarn;
            }
        }

        return output;
    }
}