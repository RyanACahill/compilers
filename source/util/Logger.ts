/**
 * Logger provides centralized logging functionality.
 * It supports verbose tracing, which is required by the project spec.
 */
export class Logger {

    // Controls whether detailed tracing is printed
    public static verbose: boolean = true;

    /**
     * Logs a message only if verbose mode is enabled.
     */
    public static log(message: string): void {
        if (this.verbose) {
            console.log(message);
        }
    }

    /**
     * Logs an error message (always shown).
     */
    public static error(message: string): void {
        console.error("ERROR → " + message);
    }

    /**
     * Logs a warning message (always shown).
     */
    public static warning(message: string): void {
        console.warn("WARNING → " + message);
    }
}