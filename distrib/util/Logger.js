"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Logger = void 0;
const globals_1 = require("../globals");
class Logger {
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
exports.Logger = Logger;
Logger.verbose = globals_1.VERBOSE_DEFAULT;
//# sourceMappingURL=Logger.js.map