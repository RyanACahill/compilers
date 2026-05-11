import { Token } from "../lexer/Token.js";
import { TokenType } from "../lexer/TokenType.js";
import { Logger } from "../util/Logger.js";

export interface ParserRepairResult {
    tokens: Token[];
    changed: boolean;
    messages: string[];
}

export class ParserRepair {
    public static repair(tokens: Token[]): ParserRepairResult {
        const repaired = [...tokens];
        const messages: string[] = [];

        this.insertMissingRightParens(repaired, messages);
        this.insertMissingRightBraces(repaired, messages);

        const changed = messages.length > 0;

        if (changed) {
            Logger.log("\nPARSER REPAIR → Safe parser repair applied.");

            for (const message of messages) {
                Logger.log(`PARSER REPAIR → ${message}`);
            }
        }

        return {
            tokens: repaired,
            changed,
            messages
        };
    }

    private static insertMissingRightParens(tokens: Token[], messages: string[]): void {
        for (let i = 0; i < tokens.length; i++) {
            const token = tokens[i];

            if (token.type !== TokenType.Print) {
                continue;
            }

            let depth = 0;
            let sawLeftParen = false;

            for (let j = i + 1; j < tokens.length; j++) {
                const current = tokens[j];

                if (current.type === TokenType.LParen) {
                    depth++;
                    sawLeftParen = true;
                }

                if (current.type === TokenType.RParen) {
                    depth--;
                }

                if (
                    sawLeftParen &&
                    depth > 0 &&
                    (current.type === TokenType.RBrace || current.type === TokenType.LBrace || current.type === TokenType.EOP)
                ) {
                    tokens.splice(j, 0, this.syntheticToken(TokenType.RParen, ")", current));
                    messages.push(
                        `Inserted missing ')' before '${current.value}' at file (${current.line}:${current.column}).`
                    );
                    return;
                }

                if (sawLeftParen && depth === 0) {
                    break;
                }
            }
        }
    }

    private static insertMissingRightBraces(tokens: Token[], messages: string[]): void {
        let balance = 0;

        for (const token of tokens) {
            if (token.type === TokenType.LBrace) {
                balance++;
            }

            if (token.type === TokenType.RBrace) {
                balance--;
            }
        }

        if (balance <= 0) {
            return;
        }

        const eopIndex = tokens.findIndex(t => t.type === TokenType.EOP);

        if (eopIndex === -1) {
            return;
        }

        const eop = tokens[eopIndex];

        for (let i = 0; i < balance; i++) {
            tokens.splice(eopIndex, 0, this.syntheticToken(TokenType.RBrace, "}", eop));
            messages.push(
                `Inserted missing '}' before '$' at file (${eop.line}:${eop.column}).`
            );
        }
    }

    private static syntheticToken(type: TokenType, value: string, near: Token): Token {
        return new Token(
            type,
            value,
            near.line,
            near.column
        );
    }
}