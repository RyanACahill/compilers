export class SymbolTable {
    constructor() {
        this.entries = [];
    }
    add(entry) {
        this.entries.push(entry);
    }
    lookupCurrentScope(name, scope) {
        var _a;
        return (_a = this.entries.find(e => e.name === name && e.scope === scope)) !== null && _a !== void 0 ? _a : null;
    }
    lookup(name, activeScopes) {
        for (let i = activeScopes.length - 1; i >= 0; i--) {
            const scope = activeScopes[i];
            const found = this.entries.find(e => e.name === name && e.scope === scope);
            if (found)
                return found;
        }
        return null;
    }
    all() {
        return this.entries;
    }
    toString() {
        let output = "Name\tType\tScope\tLine\tCol\tInitialized\tUsed\n";
        for (const e of this.entries) {
            output += `${e.name}\t${e.type}\t${e.scope}\t${e.line}\t${e.column}\t${e.initialized}\t\t${e.used}\n`;
        }
        return output;
    }
}
