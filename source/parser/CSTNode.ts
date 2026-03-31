/**
 * CSTNode represents one node in the Concrete Syntax Tree.
 * Branch nodes are grammar constructs like <Block> or <Expr>.
 * Leaf nodes are concrete tokens like [ID: a] or [DIGIT: 5].
 */
export class CSTNode {
    public name: string;
    public children: CSTNode[];
    public parent: CSTNode | null;

    constructor(name: string, parent: CSTNode | null = null) {
        this.name = name;
        this.children = [];
        this.parent = parent;
    }

    /**
     * Attaches a child node to this node.
     */
    public addChild(child: CSTNode): void {
        child.parent = this;
        this.children.push(child);
    }
}