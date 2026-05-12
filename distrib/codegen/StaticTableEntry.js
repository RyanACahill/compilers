/**
 * Represents a single entry in the static table
 * used during code generation.
 */
export class StaticTableEntry {
    /**
     * Creates a static table entry.
     *
     * @param temp          Temporary placeholder label
     * @param variableName  Source variable identifier
     * @param scope         Scope where the variable exists
     * @param address       Final memory address assigned during backpatching
     */
    constructor(
    // Temporary placeholder used before backpatching.
    temp, 
    // Original variable name from the source program.
    variableName, 
    // Scope level where the variable was declared.
    scope, 
    // Final assigned memory address.
    address = null) {
        this.temp = temp;
        this.variableName = variableName;
        this.scope = scope;
        this.address = address;
    }
}
