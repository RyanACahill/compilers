"use strict";
// import { Lexer } from "../lexer/Lexer.js";
// import { Parser } from "../parser/Parser.js";
// import { ErrorReporter } from "../util/ErrorReporter.js";
// import { Logger } from "../util/Logger.js";
// import { SemanticAnalyzer } from "../semantic/SemanticAnalyzer.js";
// interface ProgramInfo {
//     source: string;
//     number: number;
//     startLine: number;
// }
// export class ProgramRunner {
//     public static run(source: string): void {
//         const programs: ProgramInfo[] = [];
//         let currentProgram = "";
//         let currentLine = 1;
//         let programStartLine = 1;
//         let programNumber = 1;
//         for (let i = 0; i < source.length; i++) {
//             const char = source[i];
//             currentProgram += char;
//             if (char === "$") {
//                 programs.push({
//                     source: currentProgram,
//                     number: programNumber,
//                     startLine: programStartLine
//                 });
//                 currentProgram = "";
//                 programNumber++;
//                 programStartLine = currentLine;
//             }
//             if (char === "\n") {
//                 currentLine++;
//             }
//         }
//         if (currentProgram.trim().length > 0) {
//             programs.push({
//                 source: currentProgram,
//                 number: programNumber,
//                 startLine: programStartLine
//             });
//         }
//         for (const program of programs) {
//             if (program.source.trim().length === 0) {
//                 continue;
//             }
//             Logger.log(`\n================ PROGRAM ${program.number} ================`);
//             const lexer = new Lexer();
//             const lexResult = lexer.lex(program.source, program.startLine);
//             if (lexResult.success) {
//                 Logger.log("Lex successful.");
//             } else {
//                 Logger.log("Lex unsuccessful.");
//             }
//             if (lexResult.errors.length > 0 || lexResult.warnings.length > 0) {
//                 Logger.log("\nLex Summary:");
//                 if (lexResult.errors.length > 0) {
//                     Logger.log("Errors:");
//                     for (const error of lexResult.errors) {
//                         Logger.log(`- ${ErrorReporter.format(error)}`);
//                     }
//                 }
//                 if (lexResult.warnings.length > 0) {
//                     Logger.log("Warnings:");
//                     for (const warning of lexResult.warnings) {
//                         Logger.log(`- ${ErrorReporter.format(warning)}`);
//                     }
//                 }
//             }
//             if (!lexResult.success) {
//                 Logger.log("Parse skipped due to lex errors.\n");
//                 continue;
//             }
//             const parser = new Parser();
//             const parseResult = parser.parse(lexResult.tokens);
//            if (parseResult.success) {
//                 Logger.log("Parse successful.");
//                 Logger.log("\nCST:");
//                 Logger.log(parseResult.cst?.toString() ?? "");
//                 // ========================
//                 // SEMANTIC ANALYSIS PHASE
//                 // ========================
//                 const semanticAnalyzer = new SemanticAnalyzer();
//                 const semanticResult = semanticAnalyzer.analyze(lexResult.tokens);
//                 if (semanticResult.success) {
//                     Logger.log("\nSemantic Analysis successful.");
//                     Logger.log("\nAST:");
//                     Logger.log(semanticResult.ast?.toString() ?? "");
//                     Logger.log("\nSymbol Table:");
//                     Logger.log(semanticResult.symbolTable?.toString() ?? "");
//                 } else {
//                     Logger.log("\nSemantic Analysis unsuccessful.");
//                     Logger.log("Code Generation skipped due to semantic errors.");
//                 }
//             } else {
//                 Logger.log("Parse unsuccessful.");
//             }
//             if (
//                 parseResult.errors.length > 0 ||
//                 parseResult.warnings.length > 0 ||
//                 parseResult.hints.length > 0
//             ) {
//                 Logger.log("\nParse Summary:");
//                 if (parseResult.errors.length > 0) {
//                     Logger.log("Errors:");
//                     for (const error of parseResult.errors) {
//                         Logger.log(`- ${ErrorReporter.format(error)}`);
//                     }
//                 }
//                 if (parseResult.warnings.length > 0) {
//                     Logger.log("Warnings:");
//                     for (const warning of parseResult.warnings) {
//                         Logger.log(`- ${ErrorReporter.format(warning)}`);
//                     }
//                 }
//                 if (parseResult.hints.length > 0) {
//                     Logger.log("Hints:");
//                     for (const hint of parseResult.hints) {
//                         Logger.log(`- ${ErrorReporter.format(hint)}`);
//                     }
//                 }
//             }
//             Logger.log("");
//         }
//     }
// }
