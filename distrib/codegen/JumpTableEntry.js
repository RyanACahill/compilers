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
    placeholder, 
    // Final branch distance assigned during backpatching.
    distance = null) {
        this.placeholder = placeholder;
        this.distance = distance;
    }
}
