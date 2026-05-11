import { Logger } from "../util/Logger.js";
export class LexerRepair {
    // Performs safe lexer-level repairs without changing the meaning of the program.
    static repair(source) {
        const originalSource = source;
        const messages = [];
        let repairedSource = source;
        // Replace curly “smart quotes” with normal double quotes so strings lex correctly.
        const smartQuoteFixed = repairedSource.replace(/[“”]/g, "\"");
        if (smartQuoteFixed !== repairedSource) {
            repairedSource = smartQuoteFixed;
            messages.push("Converted smart quotes to normal double quotes.");
        }
        // If the source is not empty and does not end with $, add the required end marker.
        if (repairedSource.trim().length > 0 && !repairedSource.trim().endsWith("$")) {
            repairedSource = repairedSource.trim() + "$";
            messages.push("Inserted missing end-of-program marker '$'.");
        }
        // Track whether any repair actually changed the source code.
        const changed = originalSource !== repairedSource;
        // Log repair details only if a change was made.
        if (changed) {
            Logger.log("\nLEXER REPAIR → Safe lexer repair applied.");
            for (const message of messages) {
                Logger.log(`LEXER REPAIR → ${message}`);
            }
            Logger.log("\nLEXER REPAIR → Repaired Source:");
            Logger.log(repairedSource);
        }
        // Return both the original and repaired source along with repair messages.
        return {
            originalSource,
            repairedSource,
            changed,
            messages
        };
    }
}
