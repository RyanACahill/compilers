export class Logger {
    public static verbose: boolean = true;
    private static buffer: string[] = [];

    public static clear(): void {
        this.buffer = [];
    }

    public static getOutput(): string {
        return this.buffer.join("\n");
    }

    public static log(message: string): void {
        if (this.verbose) {
            this.buffer.push(message);
            console.log(message);
        }
    }

    public static error(message: string): void {
        const line = "ERROR → " + message;
        this.buffer.push(line);
        console.error(line);
    }

    public static warning(message: string): void {
        const line = "WARNING → " + message;
        this.buffer.push(line);
        console.warn(line);
    }
}