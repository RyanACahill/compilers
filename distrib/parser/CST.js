"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CST = void 0;
const CSTNode_1 = require("./CSTNode");
/**
 * CST manages construction of the Concrete Syntax Tree during parsing.
 * The parser adds branch nodes for grammar rules and leaf nodes for matched tokens.
 */
class CST {
    constructor() {
        this.root = null;
        this.current = null;
    }
    /**
     * Adds a branch node and moves the current pointer into it.
     */
    addBranchNode(name) {
        const node = new CSTNode_1.CSTNode(name);
        if (this.root === null) {
            this.root = node;
            this.current = node;
        }
        else if (this.current !== null) {
            this.current.addChild(node);
            this.current = node;
        }
    }
    /**
     * Adds a leaf node under the current branch.
     */
    addLeafNode(name) {
        const node = new CSTNode_1.CSTNode(name);
        if (this.root === null) {
            this.root = node;
            this.current = node;
        }
        else if (this.current !== null) {
            this.current.addChild(node);
        }
    }
    /**
     * Moves back up to the parent branch after finishing a production.
     */
    moveUp() {
        if (this.current !== null && this.current.parent !== null) {
            this.current = this.current.parent;
        }
    }
    /**
     * Returns the root node.
     */
    getRoot() {
        return this.root;
    }
    /**
     * Produces a readable tree representation.
     */
    toString() {
        if (this.root === null) {
            return "(empty CST)";
        }
        let output = "";
        const expand = (node, depth) => {
            output += `${"-".repeat(depth)}${node.name}\n`;
            for (const child of node.children) {
                expand(child, depth + 1);
            }
        };
        expand(this.root, 0);
        return output;
    }
}
exports.CST = CST;
//# sourceMappingURL=CST.js.map