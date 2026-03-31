import { Lexer } from "../lexer/Lexer";
import { Parser } from "../parser/Parser";
import { ErrorReporter } from "../util/ErrorReporter";

interface ProgramInfo {
    source: string;
    number: number;
    startLine: number;
}

export class ProgramRunner {
    public static run(source: string): void {
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

            console.log(`\n================ PROGRAM ${program.number} ================`);

            const lexer = new Lexer();
            const lexResult = lexer.lex(program.source, program.startLine);

            if (lexResult.success) {
                console.log("Lex successful.");
            } else {
                console.log("Lex unsuccessful.");
            }

            if (lexResult.errors.length > 0 || lexResult.warnings.length > 0) {
                console.log("\nLex Summary:");

                if (lexResult.errors.length > 0) {
                    console.log("Errors:");
                    for (const error of lexResult.errors) {
                        console.log(`- ${ErrorReporter.format(error)}`);
                    }
                }

                if (lexResult.warnings.length > 0) {
                    console.log("Warnings:");
                    for (const warning of lexResult.warnings) {
                        console.log(`- ${ErrorReporter.format(warning)}`);
                    }
                }
            }

            if (!lexResult.success) {
                console.log("Parse skipped due to lex errors.\n");
                continue;
            }

            const parser = new Parser();
            const parseResult = parser.parse(lexResult.tokens);

            if (parseResult.success) {
                console.log("Parse successful.");
                console.log("\nCST:");
                console.log(parseResult.cst?.toString());
            } else {
                console.log("Parse unsuccessful.");
            }

            if (
                parseResult.errors.length > 0 ||
                parseResult.warnings.length > 0 ||
                parseResult.hints.length > 0
            ) {
                console.log("\nParse Summary:");

                if (parseResult.errors.length > 0) {
                    console.log("Errors:");
                    for (const error of parseResult.errors) {
                        console.log(`- ${ErrorReporter.format(error)}`);
                    }
                }

                if (parseResult.warnings.length > 0) {
                    console.log("Warnings:");
                    for (const warning of parseResult.warnings) {
                        console.log(`- ${ErrorReporter.format(warning)}`);
                    }
                }

                if (parseResult.hints.length > 0) {
                    console.log("Hints:");
                    for (const hint of parseResult.hints) {
                        console.log(`- ${ErrorReporter.format(hint)}`);
                    }
                }
            }

            console.log();
        }
    }
}