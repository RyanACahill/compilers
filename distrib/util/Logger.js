export class Logger {
    /**
     * Clears all previously stored compiler output.
     */
    static clear() {
        this.buffer = [];
    }
    /**
     * Returns the full compiler output as a single string.
     */
    static getOutput() {
        return this.buffer.join("\n");
    }
    static log(message) {
        // Only print verbose logs when enabled.
        if (this.verbose) {
            this.buffer.push(message);
            console.log(message);
        }
    }
    /**
     * Records a compiler error message.
     *
     * Errors are always logged regardless of verbose mode.
     */
    static error(message) {
        const line = "ERROR → " + message;
        this.buffer.push(line);
        console.error(line);
    }
    /**
     * Records a compiler warning message.
     *
     * Warnings are always logged regardless of verbose mode.
     */
    static warning(message) {
        const line = "WARNING → " + message;
        this.buffer.push(line);
        console.warn(line);
    }
}
/**
 * Controls whether normal verbose logging is enabled.
 *
 * Errors and warnings are still recorded regardless
 * of this setting.
 */
Logger.verbose = true;
/**
 * Internal output buffer storing all compiler messages.
 *
 * The browser UI reads from this buffer to display
 * compiler output to the user.
 */
Logger.buffer = [];
