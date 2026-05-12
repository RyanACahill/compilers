/**
 * Represents a single jump table entry used during
 * code generation branch backpatching.
 */
export class JumpTableEntry {

    /**
     * Creates a jump table entry.
     *
     * @param placeholder Temporary jump label
     * @param distance    Final calculated branch distance
     */
    constructor(

        // Temporary branch placeholder (ex: J0, J1, J2).
        public placeholder: string,

        // Final branch distance assigned during backpatching.
        public distance: number | null = null
    ) {}
}