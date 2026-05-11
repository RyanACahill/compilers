import { Token } from "../lexer/Token.js";
import { TokenType } from "../lexer/TokenType.js";
import { Logger } from "../util/Logger.js";

// Represents the result of parser-level repair operations.
export interface ParserRepairResult {
    tokens: Token[];
    changed: boolean;
    messages: string[];
}

export class ParserRepair {

    // Applies safe parser repairs to token streams without changing program meaning.
    public static repair(tokens: Token[]): ParserRepairResult {

        // Create a copy so the original token stream is not modified directly.
        const repaired = [...tokens];

        // Stores messages describing all repairs performed.
        const messages: string[] = [];

        // Attempt common safe repairs.
        this.insertMissingRightParens(repaired, messages);
        this.insertMissingRightBraces(repaired, messages);

        // A repair occurred if at least one message was generated.
        const changed = messages.length > 0;

        // Log repair details when changes are made.
        if (changed) {
            Logger.log("\nPARSER REPAIR → Safe parser repair applied.");

            for (const message of messages) {
                Logger.log(`PARSER REPAIR → ${message}`);
            }
        }

        // Return repaired tokens and repair metadata.
        return {
            tokens: repaired,
            changed,
            messages
        };
    }

    // Inserts missing ')' tokens for malformed print statements.
    private static insertMissingRightParens(tokens: Token[], messages: string[]): void {

        // Scan through all tokens looking for print statements.
        for (let i = 0; i < tokens.length; i++) {
            const token = tokens[i];

            // Skip anything that is not a print statement.
            if (token.type !== TokenType.Print) {
                continue;
            }

            let depth = 0;
            let sawLeftParen = false;

            // Scan forward from the print token.
            for (let j = i + 1; j < tokens.length; j++) {
                const current = tokens[j];

                // Track nested parenthesis depth.
                if (current.type === TokenType.LParen) {
                    depth++;
                    sawLeftParen = true;
                }

                if (current.type === TokenType.RParen) {
                    depth--;
                }

                // If we hit a block end or EOP before closing the parenthesis,
                // automatically insert a missing ')'.
                if (
                    sawLeftParen &&
                    depth > 0 &&
                    (current.type === TokenType.RBrace || current.type === TokenType.EOP)
                ) {
                    tokens.splice(j, 0, this.syntheticToken(TokenType.RParen, ")", current));

                    messages.push(
                        `Inserted missing ')' before '${current.value}' at file (${current.line}:${current.column}).`
                    );

                    return;
                }

                // Stop scanning once parentheses are balanced.
                if (sawLeftParen && depth === 0) {
                    break;
                }
            }
        }
    }

    // Inserts missing '}' tokens when block braces are unbalanced.
    private static insertMissingRightBraces(tokens: Token[], messages: string[]): void {
        let balance = 0;

        // Count opening and closing braces.
        for (const token of tokens) {
            if (token.type === TokenType.LBrace) {
                balance++;
            }

            if (token.type === TokenType.RBrace) {
                balance--;
            }
        }

        // If braces are already balanced, no repair is needed.
        if (balance <= 0) {
            return;
        }

        // Find the end-of-program marker.
        const eopIndex = tokens.findIndex(t => t.type === TokenType.EOP);

        if (eopIndex === -1) {
            return;
        }

        const eop = tokens[eopIndex];

        // Insert the required number of missing right braces before '$'.
        for (let i = 0; i < balance; i++) {
            tokens.splice(eopIndex, 0, this.syntheticToken(TokenType.RBrace, "}", eop));

            messages.push(
                `Inserted missing '}' before '$' at file (${eop.line}:${eop.column}).`
            );
        }
    }

    // Creates a synthetic token using the position of a nearby token.
    private static syntheticToken(type: TokenType, value: string, near: Token): Token {
        return new Token(
            type,
            value,
            near.line,
            near.column
        );
    }
}