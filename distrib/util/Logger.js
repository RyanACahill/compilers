"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Logger = void 0;
/**
 * Logger provides centralized logging functionality.
 * It supports verbose tracing, which is required by the project spec.
 */
class Logger {
    /**
     * Logs a message only if verbose mode is enabled.
     */
    static log(message) {
        if (this.verbose) {
            console.log(message);
        }
    }
    /**
     * Logs an error message (always shown).
     */
    static error(message) {
        console.error("ERROR → " + message);
    }
    /**
     * Logs a warning message (always shown).
     */
    static warning(message) {
        console.warn("WARNING → " + message);
    }
}
exports.Logger = Logger;
// Controls whether detailed tracing is printed
Logger.verbose = true;
//# sourceMappingURL=Logger.js.map