"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProgramRunner = void 0;
const Lexer_1 = require("../lexer/Lexer");
const ErrorReporter_1 = require("../util/ErrorReporter");
/**
 * ProgramRunner breaks the input file into separate programs using '$'
 * and runs the lexer on each one individually.
 */
class ProgramRunner {
    static run(source) {
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
            const lexer = new Lexer_1.Lexer();
            const result = lexer.lex(program.source, program.startLine);
            if (result.success) {
                console.log("Lex successful.");
            }
            else {
                console.log("Lex unsuccessful.");
            }
            if (result.errors.length > 0 || result.warnings.length > 0) {
                console.log("\nSummary:");
                if (result.errors.length > 0) {
                    console.log("Errors:");
                    for (const error of result.errors) {
                        console.log(`- ${ErrorReporter_1.ErrorReporter.format(error)}`);
                    }
                }
                if (result.warnings.length > 0) {
                    console.log("Warnings:");
                    for (const warning of result.warnings) {
                        console.log(`- ${ErrorReporter_1.ErrorReporter.format(warning)}`);
                    }
                }
            }
            console.log();
        }
    }
}
exports.ProgramRunner = ProgramRunner;
//# sourceMappingURL=ProgramRunner.js.map