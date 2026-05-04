export class AST {
    constructor() {
        this.root = null;
    }
    toString() {
        if (!this.root)
            return "(empty AST)";
        let output = "";
        const walk = (node, depth) => {
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
