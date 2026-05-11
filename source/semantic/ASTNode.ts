import { Token } from "../lexer/Token.js";

/**
 * Represents a single node within the Abstract Syntax Tree (AST).
 *
 * AST nodes store the semantic structure of the program,
 * including identifiers, expressions, statements, and types.
 */
export class ASTNode {

    // Child nodes connected to this AST node.
    public children: ASTNode[] = [];

    // Scope identifier assigned during semantic analysis.
    public scopeId: number | null = null;

    // Semantic type assigned during type checking.
    public semanticType: string | null = null;

    /**
     * Creates a new AST node.
     *
     * @param name  Logical name of the AST node
     * @param value Optional associated value
     * @param token Original source token related to this node
     */
    constructor(
        public name: string,
        public value: string = "",
        public token: Token | null = null
    ) {}

    /**
     * Adds a child node to the current AST node.
     */
    public addChild(child: ASTNode): void {
        this.children.push(child);
    }

    /**
     * Replaces the current child list and returns the node.
     */
    public withChildren(children: ASTNode[]): ASTNode {
        this.children = children;
        return this;
    }
}