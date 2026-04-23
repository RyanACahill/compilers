/**
 * ErrorReporter formats diagnostics consistently for live output and summaries.
 */
export class ErrorReporter {
    static format(d) {
        return `${d.phase} ${d.kind} at file (${d.fileLine}:${d.fileColumn}), program (${d.programLine}:${d.programColumn}) → ${d.message}`;
    }
}
//# sourceMappingURL=ErrorReporter.js.map