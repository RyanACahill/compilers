import { Lexer } from "../lexer/Lexer";
import { ErrorReporter } from "../util/ErrorReporter";

/**
 * ProgramInfo stores one extracted program along with where it begins in the file.
 */
interface ProgramInfo {
    source: string;
    number: number;
    startLine: number;
}

/**
 * ProgramRunner breaks the input file into separate programs using '$'
 * and runs the lexer on each one individually.
 */
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

        // Handle a leftover final program with no ending $
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
            const result = lexer.lex(program.source, program.startLine);

            if (result.success) {
                console.log("Lex successful.");
            } else {
                console.log("Lex unsuccessful.");
            }

            if (result.errors.length > 0 || result.warnings.length > 0) {
                console.log("\nSummary:");

                if (result.errors.length > 0) {
                    console.log("Errors:");
                    for (const error of result.errors) {
                        console.log(`- ${ErrorReporter.format(error)}`);
                    }
                }

                if (result.warnings.length > 0) {
                    console.log("Warnings:");
                    for (const warning of result.warnings) {
                        console.log(`- ${ErrorReporter.format(warning)}`);
                    }
                }
            }

            console.log();
        }
    }
}