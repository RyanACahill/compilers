import { Logger } from "../util/Logger.js";
export class LexerRepair {
    static repair(source) {
        const originalSource = source;
        const messages = [];
        let repairedSource = source;
        const smartQuoteFixed = repairedSource.replace(/[“”]/g, "\"");
        if (smartQuoteFixed !== repairedSource) {
            repairedSource = smartQuoteFixed;
            messages.push("Converted smart quotes to normal double quotes.");
        }
        if (repairedSource.trim().length > 0 && !repairedSource.trim().endsWith("$")) {
            repairedSource = repairedSource.trim() + "$";
            messages.push("Inserted missing end-of-program marker '$'.");
        }
        const changed = originalSource !== repairedSource;
        if (changed) {
            Logger.log("\nLEXER REPAIR → Safe lexer repair applied.");
            for (const message of messages) {
                Logger.log(`LEXER REPAIR → ${message}`);
            }
            Logger.log("\nLEXER REPAIR → Repaired Source:");
            Logger.log(repairedSource);
        }
        return {
            originalSource,
            repairedSource,
            changed,
            messages
        };
    }
}
