"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ErrorReporter = void 0;
/**
 * ErrorReporter formats diagnostics consistently for live output and summaries.
 */
class ErrorReporter {
    static format(d) {
        return `${d.phase} ${d.kind} at file (${d.fileLine}:${d.fileColumn}), program (${d.programLine - 1}:${d.programColumn}) → ${d.message}`;
    }
}
exports.ErrorReporter = ErrorReporter;
//# sourceMappingURL=ErrorReporter.js.map