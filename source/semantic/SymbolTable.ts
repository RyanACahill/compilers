import { SymbolTableEntry } from "./SymbolTableEntry.js";

export class SymbolTable {
    private entries: SymbolTableEntry[] = [];

    public add(entry: SymbolTableEntry): void {
        this.entries.push(entry);
    }

    public lookupCurrentScope(name: string, scope: number): SymbolTableEntry | null {
        return this.entries.find(e => e.name === name && e.scope === scope) ?? null;
    }

    public lookup(name: string, activeScopes: number[]): SymbolTableEntry | null {
        for (let i = activeScopes.length - 1; i >= 0; i--) {
            const scope = activeScopes[i];
            const found = this.entries.find(e => e.name === name && e.scope === scope);
            if (found) return found;
        }

        return null;
    }

    public all(): SymbolTableEntry[] {
        return this.entries;
    }

    public toString(): string {
        let output = "Name\tType\tScope\tLine\tCol\tInitialized\tUsed\n";

        for (const e of this.entries) {
            output += `${e.name}\t${e.type}\t${e.scope}\t${e.line}\t${e.column}\t${e.initialized}\t\t${e.used}\n`;
        }

        return output;
    }
}