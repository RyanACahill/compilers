import { CSTNode } from "./CSTNode";

/**
 * CST manages construction of the Concrete Syntax Tree during parsing.
 * The parser adds branch nodes for grammar rules and leaf nodes for matched tokens.
 */
export class CST {
    private root: CSTNode | null = null;
    private current: CSTNode | null = null;

    /**
     * Adds a branch node and moves the current pointer into it.
     */
    public addBranchNode(name: string): void {
        const node = new CSTNode(name);

        if (this.root === null) {
            this.root = node;
            this.current = node;
        } else if (this.current !== null) {
            this.current.addChild(node);
            this.current = node;
        }
    }

    /**
     * Adds a leaf node under the current branch.
     */
    public addLeafNode(name: string): void {
        const node = new CSTNode(name);

        if (this.root === null) {
            this.root = node;
            this.current = node;
        } else if (this.current !== null) {
            this.current.addChild(node);
        }
    }

    /**
     * Moves back up to the parent branch after finishing a production.
     */
    public moveUp(): void {
        if (this.current !== null && this.current.parent !== null) {
            this.current = this.current.parent;
        }
    }

    /**
     * Returns the root node.
     */
    public getRoot(): CSTNode | null {
        return this.root;
    }

    /**
     * Produces a readable tree representation.
     */
    public toString(): string {
        if (this.root === null) {
            return "(empty CST)";
        }

        let output = "";

        const expand = (node: CSTNode, depth: number): void => {
            output += `${"-".repeat(depth)}${node.name}\n`;
            for (const child of node.children) {
                expand(child, depth + 1);
            }
        };

        expand(this.root, 0);
        return output;
    }
}