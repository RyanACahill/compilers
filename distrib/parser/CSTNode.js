"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CSTNode = void 0;
/**
 * CSTNode represents one node in the Concrete Syntax Tree.
 * Branch nodes are grammar constructs like <Block> or <Expr>.
 * Leaf nodes are concrete tokens like [ID: a] or [DIGIT: 5].
 */
class CSTNode {
    constructor(name, parent = null) {
        this.name = name;
        this.children = [];
        this.parent = parent;
    }
    /**
     * Attaches a child node to this node.
     */
    addChild(child) {
        child.parent = this;
        this.children.push(child);
    }
}
exports.CSTNode = CSTNode;
//# sourceMappingURL=CSTNode.js.map