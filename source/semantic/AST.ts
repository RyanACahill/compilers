import { ASTNode } from "./ASTNode.js";

export class AST {
    public root: ASTNode | null = null;

    public toString(): string {
        if (!this.root) return "(empty AST)";

        let output = "";

        const walk = (node: ASTNode, depth: number): void => {
            const label = node.value ? `<${node.name}: ${node.value}>` : `<${node.name}>`;
            output += `${"-".repeat(depth)}${label}\n`;

            for (const child of node.children) {
                walk(child, depth + 1);
            }
        };

        walk(this.root, 0);
        return output;
    }
}