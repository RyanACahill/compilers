/**
 * Represents a single node within the Abstract Syntax Tree (AST).
 *
 * AST nodes store the semantic structure of the program,
 * including identifiers, expressions, statements, and types.
 */
export class ASTNode {
    /**
     * Creates a new AST node.
     *
     * @param name  Logical name of the AST node
     * @param value Optional associated value
     * @param token Original source token related to this node
     */
    constructor(name, value = "", token = null) {
        this.name = name;
        this.value = value;
        this.token = token;
        // Child nodes connected to this AST node.
        this.children = [];
        // Scope identifier assigned during semantic analysis.
        this.scopeId = null;
        // Semantic type assigned during type checking.
        this.semanticType = null;
    }
    /**
     * Adds a child node to the current AST node.
     */
    addChild(child) {
        this.children.push(child);
    }
    /**
     * Replaces the current child list and returns the node.
     */
    withChildren(children) {
        this.children = children;
        return this;
    }
}
