/**
 * Diagnostic represents a structured warning or error produced by a compiler phase.
 */
export interface Diagnostic {
    kind: "ERROR" | "WARNING" | "HINT";
    phase: string;
    message: string;
    fileLine: number;
    fileColumn: number;
    programLine: number;
    programColumn: number;
}

/**
 * ErrorReporter formats diagnostics consistently for live output and summaries.
 */
export class ErrorReporter {
    public static format(d: Diagnostic): string {
        return `${d.phase} ${d.kind} at file (${d.fileLine}:${d.fileColumn}) → ${d.message}`;
    }
}