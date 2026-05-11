import { SymbolTableEntry } from "./SymbolTableEntry.js";

/**
 * Represents the compiler's symbol table.
 *
 * The symbol table stores information about identifiers
 * declared throughout the program, including:
 * - variable names
 * - types
 * - scope ownership
 * - initialization state
 * - usage tracking
 */
export class SymbolTable {

    // Collection of all symbol table entries.
    private entries: SymbolTableEntry[] = [];

    /**
     * Inserts a new symbol table entry.
     */
    public add(entry: SymbolTableEntry): void {
        this.entries.push(entry);
    }

    /**
     * Searches for an identifier only within the current scope.
     *
     * Used to detect redeclaration errors.
     */
    public lookupCurrentScope(
        name: string,
        scope: number
    ): SymbolTableEntry | null {

        return (
            this.entries.find(
                e => e.name === name && e.scope === scope
            ) ?? null
        );
    }

    /**
     * Searches for an identifier across all active scopes.
     *
     * Scope lookup proceeds from innermost scope outward,
     * matching normal lexical scope resolution rules.
     */
    public lookup(
        name: string,
        activeScopes: number[]
    ): SymbolTableEntry | null {

        // Search from innermost scope outward.
        for (let i = activeScopes.length - 1; i >= 0; i--) {

            const scope = activeScopes[i];

            const found = this.entries.find(
                e => e.name === name && e.scope === scope
            );

            if (found) {
                return found;
            }
        }

        return null;
    }

    /**
     * Returns all symbol table entries.
     */
    public all(): SymbolTableEntry[] {
        return this.entries;
    }

    /**
     * Produces a formatted table representation
     * of the symbol table for debugging and diagnostics.
     */
    public toString(): string {

        let output =
            "Name\tType\tScope\tLine\tCol\tInitialized\tUsed\n";

        // Format each symbol table entry as a row.
        for (const e of this.entries) {
            output +=
                `${e.name}\t${e.type}\t${e.scope}\t${e.line}\t${e.column}\t${e.initialized}\t\t${e.used}\n`;
        }

        return output;
    }
}