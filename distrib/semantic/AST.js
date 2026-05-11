/**
 * Represents the Abstract Syntax Tree (AST)
 * generated during semantic analysis.
 */
export class AST {
    constructor() {
        // Root node of the AST.
        this.root = null;
    }
    /**
     * Produces a readable tree-style string representation
     * of the AST for debugging and visualization.
     */
    toString() {
        // Handle empty AST case.
        if (!this.root) {
            return "(empty AST)";
        }
        let output = "";
        /**
         * Recursively traverses the AST using depth-first traversal
         * and builds the formatted tree output.
         */
        const walk = (node, depth) => {
            // Include node value when present.
            const label = node.value
                ? `<${node.name}: ${node.value}>`
                : `<${node.name}>`;
            // Indentation depth is represented using dashes.
            output += `${"-".repeat(depth)}${label}\n`;
            // Recursively visit all child nodes.
            for (const child of node.children) {
                walk(child, depth + 1);
            }
        };
        // Begin traversal from the AST root.
        walk(this.root, 0);
        return output;
    }
}
