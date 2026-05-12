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
        public temp: string,

        // Original variable name from the source program.
        public variableName: string,

        // Scope level where the variable was declared.
        public scope: number,

        // Final assigned memory address.
        public address: number | null = null
    ) {}
}