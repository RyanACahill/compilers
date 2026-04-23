export class Logger {
    static log(message) {
        if (this.verbose) {
            console.log(message);
        }
    }
    static error(message) {
        console.error("ERROR → " + message);
    }
    static warning(message) {
        console.warn("WARNING → " + message);
    }
}
Logger.verbose = true;
