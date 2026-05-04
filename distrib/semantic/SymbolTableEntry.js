export class SymbolTableEntry {
    constructor(name, type, scope, line, column, initialized = false, used = false) {
        this.name = name;
        this.type = type;
        this.scope = scope;
        this.line = line;
        this.column = column;
        this.initialized = initialized;
        this.used = used;
    }
}
