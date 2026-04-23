export class Logger {
    static clear() {
        this.buffer = [];
    }
    static getOutput() {
        return this.buffer.join("\n");
    }
    static log(message) {
        if (this.verbose) {
            this.buffer.push(message);
            console.log(message);
        }
    }
    static error(message) {
        const line = "ERROR → " + message;
        this.buffer.push(line);
        console.error(line);
    }
    static warning(message) {
        const line = "WARNING → " + message;
        this.buffer.push(line);
        console.warn(line);
    }
}
Logger.verbose = true;
Logger.buffer = [];
