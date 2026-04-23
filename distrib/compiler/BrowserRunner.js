"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BrowserRunner = void 0;
const Lexer_js_1 = require("../lexer/Lexer.js");
const Parser_js_1 = require("../parser/Parser.js");
const ErrorReporter_js_1 = require("../util/ErrorReporter.js");
class BrowserRunner {
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
            const lexer = new Lexer_js_1.Lexer();
            const lexResult = lexer.lex(program);
            output += lexResult.success ? "Lex successful.\n" : "Lex unsuccessful.\n";
            if (!lexResult.success) {
                for (const err of lexResult.errors) {
                    output += ErrorReporter_js_1.ErrorReporter.format(err) + "\n";
                }
                programNumber++;
                continue;
            }
            const parser = new Parser_js_1.Parser();
            const parseResult = parser.parse(lexResult.tokens);
            output += parseResult.success ? "Parse successful.\n" : "Parse unsuccessful.\n";
            if (parseResult.success) {
                output += "\nCST:\n";
                output += ((_a = parseResult.cst) === null || _a === void 0 ? void 0 : _a.toString()) + "\n";
            }
            else {
                for (const err of parseResult.errors) {
                    output += ErrorReporter_js_1.ErrorReporter.format(err) + "\n";
                }
            }
            programNumber++;
        }
        return output;
    }
}
exports.BrowserRunner = BrowserRunner;
