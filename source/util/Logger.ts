
export class Logger {

    /**
     * Controls whether normal verbose logging is enabled.
     *
     * Errors and warnings are still recorded regardless
     * of this setting.
     */
    public static verbose: boolean = true;

    /**
     * Internal output buffer storing all compiler messages.
     *
     * The browser UI reads from this buffer to display
     * compiler output to the user.
     */
    private static buffer: string[] = [];

    /**
     * Clears all previously stored compiler output.
     */
    public static clear(): void {
        this.buffer = [];
    }

    /**
     * Returns the full compiler output as a single string.
     */
    public static getOutput(): string {
        return this.buffer.join("\n");
    }


    public static log(message: string): void {

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
    public static error(message: string): void {

        const line = "ERROR → " + message;

        this.buffer.push(line);

        console.error(line);
    }

    /**
     * Records a compiler warning message.
     *
     * Warnings are always logged regardless of verbose mode.
     */
    public static warning(message: string): void {

        const line = "WARNING → " + message;

        this.buffer.push(line);

        console.warn(line);
    }
}