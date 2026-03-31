"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProgramRunner = void 0;
const Lexer_1 = require("../lexer/Lexer");
const ErrorReporter_1 = require("../util/ErrorReporter");
class ProgramRunner {
    static run(source) {
        const programs = source.split("$");
        programs.forEach((program, index) => {
            if (program.trim().length === 0) {
                return;
            }
            console.log(`\n================ PROGRAM ${index + 1} ================`);
            const lexer = new Lexer_1.Lexer();
            const result = lexer.lex(program + "$");
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
        });
    }
}
exports.ProgramRunner = ProgramRunner;
//# sourceMappingURL=ProgramRunner.js.map