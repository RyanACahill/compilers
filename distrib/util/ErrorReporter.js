"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ErrorReporter = void 0;
class ErrorReporter {
    static format(diagnostic) {
        return `${diagnostic.phase} ${diagnostic.kind} at (${diagnostic.line}:${diagnostic.column}) → ${diagnostic.message}`;
    }
}
exports.ErrorReporter = ErrorReporter;
//# sourceMappingURL=ErrorReporter.js.map