/**
 * Represents a single entry within the symbol table.
 *
 * Each entry stores semantic information about
 * a declared identifier, including:
 * - variable name
 * - declared type
 * - scope ownership
 * - source code location
 * - initialization state
 * - usage tracking
 */
export class SymbolTableEntry {
    /**
     * Creates a symbol table entry for a declared identifier.
     *
     * @param name         Identifier name
     * @param type         Declared data type
     * @param scope        Scope level where the identifier exists
     * @param line         Source code line number
     * @param column       Source code column number
     * @param initialized  Tracks whether the variable has been assigned
     * @param used         Tracks whether the variable has been referenced
     */
    constructor(name, type, scope, line, column, 
    // Semantic analysis flags.
    initialized = false, used = false) {
        this.name = name;
        this.type = type;
        this.scope = scope;
        this.line = line;
        this.column = column;
        this.initialized = initialized;
        this.used = used;
    }
}
