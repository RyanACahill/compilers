export interface Diagnostic {
    kind: "ERROR" | "WARNING" | "HINT";
    phase: string;
    message: string;
    fileLine: number;
    fileColumn: number;
    programLine: number;
    programColumn: number;
}

export class ErrorReporter {
    public static format(d: Diagnostic): string {
        return `${d.phase} ${d.kind} at file (${d.fileLine}:${d.fileColumn}), program (${d.programLine}:${d.programColumn}) → ${d.message}`;
    }
}