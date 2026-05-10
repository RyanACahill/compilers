import { ASTNode } from "./ASTNode.js";
import { Logger } from "../util/Logger.js";
export class ASTOptimizer {
    constructor() {
        this.constants = new Map();
    }
    optimize(ast) {
        Logger.log("\nAST OPTIMIZATION → Starting optimization phase...\n");
        if (!ast.root) {
            Logger.log("AST OPTIMIZATION → No AST root found. Skipping optimization.");
            return ast;
        }
        this.constants.clear();
        ast.root = this.optimizeNode(ast.root);
        Logger.log("AST OPTIMIZATION → Completed optimization phase.\n");
        return ast;
    }
    optimizeNode(node) {
        switch (node.name) {
            case "Block":
                return this.optimizeBlock(node);
            case "Assignment":
                return this.optimizeAssignment(node);
            case "Print":
                node.children = node.children.map(child => this.optimizeExpr(child));
                return node;
            case "If":
                return this.optimizeIf(node);
            case "While":
                return this.optimizeWhile(node);
            default:
                node.children = node.children.map(child => this.optimizeNode(child));
                return node;
        }
    }
    optimizeBlock(block) {
        const optimizedChildren = [];
        for (const child of block.children) {
            const optimized = this.optimizeNode(child);
            if (optimized.name !== "DeadCode") {
                optimizedChildren.push(optimized);
            }
        }
        block.children = optimizedChildren;
        return block;
    }
    optimizeAssignment(node) {
        const idNode = node.children[0];
        const exprNode = this.optimizeExpr(node.children[1]);
        node.children[1] = exprNode;
        if (this.isConstant(exprNode)) {
            this.constants.set(this.key(idNode), this.clone(exprNode));
            Logger.log(`AST OPTIMIZATION → Constant propagation saved '${idNode.value}' = ${exprNode.value}`);
        }
        else {
            this.constants.delete(this.key(idNode));
        }
        return node;
    }
    optimizeExpr(node) {
        if (node.name === "Id") {
            const known = this.constants.get(this.key(node));
            if (known) {
                Logger.log(`AST OPTIMIZATION → Constant propagation replaced '${node.value}' with '${known.value}'`);
                return this.clone(known);
            }
            return node;
        }
        if (node.name === "IntExpr") {
            node.children = node.children.map(child => this.optimizeExpr(child));
            if (node.children.length === 3) {
                const left = node.children[0];
                const right = node.children[2];
                if (left.name === "Digit" && right.name === "Digit") {
                    const value = Number(left.value) + Number(right.value);
                    Logger.log(`AST OPTIMIZATION → Constant folded ${left.value} + ${right.value} to ${value}`);
                    return new ASTNode("IntExpr", "", node.token).withChildren([
                        new ASTNode("Digit", String(value), node.token)
                    ]);
                }
            }
            return node;
        }
        if (node.name === "BooleanExpr") {
            node.children = node.children.map(child => this.optimizeExpr(child));
            if (node.children.length === 3) {
                const left = node.children[0];
                const op = node.children[1];
                const right = node.children[2];
                if (this.isConstant(left) && this.isConstant(right)) {
                    const result = op.value === "=="
                        ? left.value === right.value
                        : left.value !== right.value;
                    Logger.log(`AST OPTIMIZATION → Constant folded boolean expression to ${result}`);
                    const boolExpr = new ASTNode("BooleanExpr", "", node.token);
                    boolExpr.addChild(new ASTNode("BoolVal", result ? "true" : "false", node.token));
                    return boolExpr;
                }
            }
            return node;
        }
        node.children = node.children.map(child => this.optimizeExpr(child));
        return node;
    }
    optimizeIf(node) {
        const condition = this.optimizeExpr(node.children[0]);
        const block = this.optimizeNode(node.children[1]);
        node.children[0] = condition;
        node.children[1] = block;
        if (condition.name === "BooleanExpr" && condition.children.length === 1) {
            const boolVal = condition.children[0];
            if (boolVal.value === "false") {
                Logger.log("AST OPTIMIZATION → Dead code elimination removed if(false) block.");
                return new ASTNode("DeadCode");
            }
            if (boolVal.value === "true") {
                Logger.log("AST OPTIMIZATION → Dead code elimination replaced if(true) with its block.");
                return block;
            }
        }
        return node;
    }
    optimizeWhile(node) {
        const condition = this.optimizeExpr(node.children[0]);
        const block = this.optimizeNode(node.children[1]);
        node.children[0] = condition;
        node.children[1] = block;
        if (condition.name === "BooleanExpr" && condition.children.length === 1) {
            const boolVal = condition.children[0];
            if (boolVal.value === "false") {
                Logger.log("AST OPTIMIZATION → Dead code elimination removed while(false) loop.");
                return new ASTNode("DeadCode");
            }
            if (boolVal.value === "true") {
                Logger.log("AST OPTIMIZATION → Skipped loop unrolling for while(true) to avoid infinite expansion.");
                return node;
            }
        }
        Logger.log("AST OPTIMIZATION → Loop unrolling skipped unless loop count is statically known.");
        return node;
    }
    isConstant(node) {
        return (node.name === "StringExpr" ||
            node.name === "Digit" ||
            node.name === "BoolVal" ||
            (node.name === "IntExpr" && node.children.length === 1 && node.children[0].name === "Digit") ||
            (node.name === "BooleanExpr" && node.children.length === 1 && node.children[0].name === "BoolVal"));
    }
    key(node) {
        var _a;
        return `${node.value}@${(_a = node.scopeId) !== null && _a !== void 0 ? _a : "unknown"}`;
    }
    clone(node) {
        const copy = new ASTNode(node.name, node.value, node.token);
        copy.scopeId = node.scopeId;
        copy.semanticType = node.semanticType;
        copy.children = node.children.map(child => this.clone(child));
        return copy;
    }
}
