/**
 * Diagnostic represents a structured warning or error produced by a compiler phase.
 * It stores both absolute file position and position relative to the current program.
 */
export interface Diagnostic {
    kind: "ERROR" | "WARNING";
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
        return `${d.phase} ${d.kind} at file (${d.fileLine}:${d.fileColumn}), program (${d.programLine -1}:${d.programColumn}) → ${d.message}`;
    }
}