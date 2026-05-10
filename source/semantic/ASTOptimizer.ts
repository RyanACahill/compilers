import { AST } from "./AST.js";
import { ASTNode } from "./ASTNode.js";
import { Logger } from "../util/Logger.js";

export class ASTOptimizer {
    private constants: Map<string, ASTNode> = new Map();

    public optimize(ast: AST): AST {
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

    private optimizeNode(node: ASTNode): ASTNode {
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

    private optimizeBlock(block: ASTNode): ASTNode {
        const optimizedChildren: ASTNode[] = [];

        for (const child of block.children) {
            const optimized = this.optimizeNode(child);

            if (optimized.name !== "DeadCode") {
                optimizedChildren.push(optimized);
            }
        }

        block.children = optimizedChildren;
        return block;
    }

    private optimizeAssignment(node: ASTNode): ASTNode {
        const idNode = node.children[0];
        const exprNode = this.optimizeExpr(node.children[1]);

        node.children[1] = exprNode;

       const constantValue = this.getConstantValue(exprNode);

        if (constantValue !== null) {
            this.constants.set(this.key(idNode), this.clone(exprNode));
            Logger.log(`AST OPTIMIZATION → Constant propagation saved '${idNode.value}' = ${constantValue}`);
        } else {
            this.constants.delete(this.key(idNode));
        }

        return node;
    }

    private optimizeExpr(node: ASTNode): ASTNode {
        if (node.name === "Id") {
            const known = this.constants.get(this.key(node));

            if (known) {
                const replacementValue = this.getConstantValue(known);

                Logger.log(
                    `AST OPTIMIZATION → Constant propagation replaced '${node.value}' with '${replacementValue}'`
                );

                return this.clone(known);
            }

            return node;
}
        if (node.name === "IntExpr") {
            node.children = node.children.map(child => this.optimizeExpr(child));

            if (node.children.length === 3) {
                const leftValue = this.getConstantValue(node.children[0]);
                const rightValue = this.getConstantValue(node.children[2]);

                if (leftValue !== null && rightValue !== null) {
                    const value = Number(leftValue) + Number(rightValue);

                    Logger.log(`AST OPTIMIZATION → Constant folded ${leftValue} + ${rightValue} to ${value}`);

                    const folded = new ASTNode("IntExpr", "", node.token);
                    folded.addChild(new ASTNode("Digit", String(value), node.token));
                    return folded;
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

                const leftValue = this.getConstantValue(left);
                const rightValue = this.getConstantValue(right);

                if (leftValue !== null && rightValue !== null) {
                    const result = op.value === "=="
                        ? leftValue === rightValue
                        : leftValue !== rightValue;

                    Logger.log(
                        `AST OPTIMIZATION → Constant folded boolean expression to ${result}`
                    );

                    const boolExpr = new ASTNode("BooleanExpr", "", node.token);

                    boolExpr.addChild(
                        new ASTNode(
                            "BoolVal",
                            result ? "true" : "false",
                            node.token
                        )
                    );

                    return boolExpr;
                }
            }

            return node;
        }

        node.children = node.children.map(child => this.optimizeExpr(child));
        return node;
    }

    private optimizeIf(node: ASTNode): ASTNode {
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

    private optimizeWhile(node: ASTNode): ASTNode {
        const oldConstants = new Map(this.constants);

        const condition = this.optimizeExpr(node.children[0]);

        // Do not trust constants across loops.
        this.constants.clear();

        const block = this.optimizeNode(node.children[1]);

        this.constants = oldConstants;

        node.children[0] = condition;
        node.children[1] = block;

        if (condition.name === "BooleanExpr" && condition.children.length === 1) {
            const boolVal = condition.children[0];

            if (boolVal.value === "false") {
                Logger.log("AST OPTIMIZATION → Dead code elimination removed while(false) loop.");
                return new ASTNode("DeadCode");
            }
        }

        Logger.log("AST OPTIMIZATION → Loop unrolling skipped unless loop count is statically known.");
        return node;
    }
    private isConstant(node: ASTNode): boolean {
    return (
        node.name === "StringExpr" ||
        node.name === "Digit" ||
        node.name === "BoolVal" ||
        this.getConstantValue(node) !== null
    );
}

    private getConstantValue(node: ASTNode): string | null {
        if (node.name === "Digit") return node.value;
        if (node.name === "StringExpr") return node.value;
        if (node.name === "BoolVal") return node.value;

        if (
            node.name === "IntExpr" &&
            node.children.length === 1 &&
            node.children[0].name === "Digit"
        ) {
            return node.children[0].value;
        }

        if (
            node.name === "BooleanExpr" &&
            node.children.length === 1 &&
            node.children[0].name === "BoolVal"
        ) {
            return node.children[0].value;
        }

        return null;
    }
    private key(node: ASTNode): string {
        return `${node.value}@${node.scopeId ?? "unknown"}`;
    }

    private clone(node: ASTNode): ASTNode {
        const copy = new ASTNode(node.name, node.value, node.token);
        copy.scopeId = node.scopeId;
        copy.semanticType = node.semanticType;
        copy.children = node.children.map(child => this.clone(child));
        return copy;
    }
}