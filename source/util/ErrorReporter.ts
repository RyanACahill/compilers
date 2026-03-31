/**
 * Diagnostic represents a structured error or warning.
 * This allows us to store issues and summarize them later.
 */
export interface Diagnostic {
    kind: "ERROR" | "WARNING";
    phase: string;
    message: string;
    line: number;
    column: number;
}

/**
 * ErrorReporter formats diagnostics consistently across the compiler.
 */
export class ErrorReporter {

    /**
     * Converts a diagnostic object into a readable string.
     */
    public static format(d: Diagnostic): string {
        return `${d.phase} ${d.kind} at (${d.line}:${d.column}) → ${d.message}`;
    }
}