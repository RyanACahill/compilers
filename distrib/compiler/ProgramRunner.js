"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProgramRunner = void 0;
const Lexer_1 = require("../lexer/Lexer");
const Parser_1 = require("../parser/Parser");
const ErrorReporter_1 = require("../util/ErrorReporter");
class ProgramRunner {
    static run(source) {
        var _a;
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
            if (program.source.trim().length === 0) {
                continue;
            }
            console.log(`\n================ PROGRAM ${program.number} ================`);
            const lexer = new Lexer_1.Lexer();
            const lexResult = lexer.lex(program.source, program.startLine);
            if (lexResult.success) {
                console.log("Lex successful.");
            }
            else {
                console.log("Lex unsuccessful.");
            }
            if (lexResult.errors.length > 0 || lexResult.warnings.length > 0) {
                console.log("\nLex Summary:");
                if (lexResult.errors.length > 0) {
                    console.log("Errors:");
                    for (const error of lexResult.errors) {
                        console.log(`- ${ErrorReporter_1.ErrorReporter.format(error)}`);
                    }
                }
                if (lexResult.warnings.length > 0) {
                    console.log("Warnings:");
                    for (const warning of lexResult.warnings) {
                        console.log(`- ${ErrorReporter_1.ErrorReporter.format(warning)}`);
                    }
                }
            }
            if (!lexResult.success) {
                console.log("Parse skipped due to lex errors.\n");
                continue;
            }
            const parser = new Parser_1.Parser();
            const parseResult = parser.parse(lexResult.tokens);
            if (parseResult.success) {
                console.log("Parse successful.");
                console.log("\nCST:");
                console.log((_a = parseResult.cst) === null || _a === void 0 ? void 0 : _a.toString());
            }
            else {
                console.log("Parse unsuccessful.");
            }
            if (parseResult.errors.length > 0 ||
                parseResult.warnings.length > 0 ||
                parseResult.hints.length > 0) {
                console.log("\nParse Summary:");
                if (parseResult.errors.length > 0) {
                    console.log("Errors:");
                    for (const error of parseResult.errors) {
                        console.log(`- ${ErrorReporter_1.ErrorReporter.format(error)}`);
                    }
                }
                if (parseResult.warnings.length > 0) {
                    console.log("Warnings:");
                    for (const warning of parseResult.warnings) {
                        console.log(`- ${ErrorReporter_1.ErrorReporter.format(warning)}`);
                    }
                }
                if (parseResult.hints.length > 0) {
                    console.log("Hints:");
                    for (const hint of parseResult.hints) {
                        console.log(`- ${ErrorReporter_1.ErrorReporter.format(hint)}`);
                    }
                }
            }
            console.log();
        }
    }
}
exports.ProgramRunner = ProgramRunner;
//# sourceMappingURL=ProgramRunner.js.map