export class Logger {
    public static verbose: boolean = true;

    public static log(message: string): void {
        if (this.verbose) {
            console.log(message);
        }
    }

    public static error(message: string): void {
        console.error("ERROR → " + message);
    }

    public static warning(message: string): void {
        console.warn("WARNING → " + message);
    }
}