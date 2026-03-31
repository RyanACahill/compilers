import * as fs from "fs";
import { ProgramRunner } from "./ProgramRunner";

/**
 * Entry point for the compiler.
 * Reads input file from command line and passes it to ProgramRunner.
 */

const filePath = process.argv[2];

if (!filePath) {
    console.error("Usage: node distrib/compiler/Compiler.js <source-file>");
    process.exit(1);
}

// Read entire source file
const source = fs.readFileSync(filePath, "utf-8");

// Begin compilation pipeline (currently only lexer phase)
ProgramRunner.run(source);