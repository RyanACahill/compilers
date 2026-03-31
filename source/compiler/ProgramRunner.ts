import { Lexer } from "../lexer/Lexer";
import { ErrorReporter } from "../util/ErrorReporter";

/**
 * ProgramRunner handles multi-program input.
 * Programs are separated by the '$' end-of-program marker.
 */
export class ProgramRunner {

    public static run(source: string): void {

        const programs = source.split("$");

        programs.forEach((program, index) => {

            // Skip empty programs (common with trailing $)
            if (program.trim().length === 0) return;

            console.log(`\n================ PROGRAM ${index + 1} ================`);

            const lexer = new Lexer();
            const result = lexer.lex(program + "$");

            // Determine success/failure
            if (result.success) {
                console.log("Lex successful.");
            } else {
                console.log("Lex unsuccessful.");
            }

            // Print summary of diagnostics
            if (result.errors.length > 0 || result.warnings.length > 0) {

                console.log("\nSummary:");

                if (result.errors.length > 0) {
                    console.log("Errors:");
                    result.errors.forEach(e =>
                        console.log(`- ${ErrorReporter.format(e)}`)
                    );
                }

                if (result.warnings.length > 0) {
                    console.log("Warnings:");
                    result.warnings.forEach(w =>
                        console.log(`- ${ErrorReporter.format(w)}`)
                    );
                }
            }

            console.log();
        });
    }
}