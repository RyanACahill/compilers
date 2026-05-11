import { AST } from "./AST.js";
import { ASTNode } from "./ASTNode.js";
import { Logger } from "../util/Logger.js";

/**
 * Performs optimization passes on the Abstract Syntax Tree (AST).
 *
 * Implemented optimizations:
 * - Constant Folding
 * - Constant Propagation
 * - Dead Code Elimination
 * - Limited Loop Optimization
 *
 * The optimizer traverses the AST recursively and rewrites
 * portions of the tree into simpler equivalent forms
 * without changing program behavior.
 */
export class ASTOptimizer {

    /**
     * Stores known constant values for identifiers.
     *
     * Used during constant propagation to replace
     * variables with compile-time constant values.
     */
    private constants: Map<string, ASTNode> = new Map();

    /**
     * Entry point for AST optimization.
     */
    public optimize(ast: AST): AST {

        Logger.log("\nAST OPTIMIZATION → Starting optimization phase...\n");

        // Cannot optimize an empty AST.
        if (!ast.root) {
            Logger.log(
                "AST OPTIMIZATION → No AST root found. Skipping optimization."
            );

            return ast;
        }

        // Reset constant tracking state.
        this.constants.clear();

        // Begin recursive optimization from the AST root.
        ast.root = this.optimizeNode(ast.root);

        Logger.log(
            "AST OPTIMIZATION → Completed optimization phase.\n"
        );

        return ast;
    }

    /**
     * Dispatches optimization logic based on node type.
     */
    private optimizeNode(node: ASTNode): ASTNode {

        switch (node.name) {

            case "Block":
                return this.optimizeBlock(node);

            case "Assignment":
                return this.optimizeAssignment(node);

            case "Print":

                // Optimize all printed expressions.
                node.children = node.children.map(
                    child => this.optimizeExpr(child)
                );

                return node;

            case "If":
                return this.optimizeIf(node);

            case "While":
                return this.optimizeWhile(node);

            default:

                // Recursively optimize all child nodes.
                node.children = node.children.map(
                    child => this.optimizeNode(child)
                );

                return node;
        }
    }

    /**
     * Optimizes all statements within a block.
     *
     * Dead code nodes are removed entirely.
     */
    private optimizeBlock(block: ASTNode): ASTNode {

        const optimizedChildren: ASTNode[] = [];

        for (const child of block.children) {

            const optimized = this.optimizeNode(child);

            // Skip nodes eliminated by dead code optimization.
            if (optimized.name !== "DeadCode") {
                optimizedChildren.push(optimized);
            }
        }

        block.children = optimizedChildren;

        return block;
    }

    /**
     * Optimizes assignment expressions and records
     */
    private optimizeAssignment(node: ASTNode): ASTNode {

        const idNode = node.children[0];

        // Optimize the assigned expression first.
        const exprNode = this.optimizeExpr(node.children[1]);

        node.children[1] = exprNode;

        // Attempt to extract a compile-time constant value.
        const constantValue = this.getConstantValue(exprNode);

        // Save constant values for future propagation.
        if (constantValue !== null) {

            this.constants.set(
                this.key(idNode),
                this.clone(exprNode)
            );

            Logger.log(
                `AST OPTIMIZATION → Constant propagation saved '${idNode.value}' = ${constantValue}`
            );

        } else {

            // Variable is no longer guaranteed constant.
            this.constants.delete(this.key(idNode));
        }

        return node;
    }

    /**
     * Optimizes expression nodes recursively.
     *
     * Handles:
     * - constant propagation
     * - arithmetic constant folding
     * - boolean constant folding
     */
    private optimizeExpr(node: ASTNode): ASTNode {

        /**
         * Constant Propagation
         *
         * Replace identifiers with known compile-time constants.
         */
        if (node.name === "Id") {

            const known = this.constants.get(this.key(node));

            if (known) {

                const replacementValue =
                    this.getConstantValue(known) ?? known.value;

                Logger.log(
                    `AST OPTIMIZATION → Constant propagation replaced '${node.value}' with '${replacementValue}'`
                );

                return this.clone(known);
            }

            return node;
        }

        /**
         * Integer Expression Optimization
         *
         * Performs arithmetic constant folding.
         */
        if (node.name === "IntExpr") {

            node.children = node.children.map(
                child => this.optimizeExpr(child)
            );

            // Match simple addition expressions.
            if (node.children.length === 3) {

                const leftValue =
                    this.getConstantValue(node.children[0]);

                const rightValue =
                    this.getConstantValue(node.children[2]);

                // Fold compile-time integer expressions.
                if (leftValue !== null && rightValue !== null) {

                    const value =
                        Number(leftValue) + Number(rightValue);

                    Logger.log(
                        `AST OPTIMIZATION → Constant folded ${leftValue} + ${rightValue} to ${value}`
                    );

                    const folded =
                        new ASTNode("IntExpr", "", node.token);

                    folded.addChild(
                        new ASTNode(
                            "Digit",
                            String(value),
                            node.token
                        )
                    );

                    return folded;
                }
            }

            return node;
        }

        /**
         * Boolean Expression Optimization
         *
         * Performs compile-time boolean evaluation.
         */
        if (node.name === "BooleanExpr") {

            node.children = node.children.map(
                child => this.optimizeExpr(child)
            );

            if (node.children.length === 3) {

                const left = node.children[0];
                const op = node.children[1];
                const right = node.children[2];

                const leftValue =
                    this.getConstantValue(left);

                const rightValue =
                    this.getConstantValue(right);

                // Fold boolean comparisons when both sides are constant.
                if (leftValue !== null && rightValue !== null) {

                    const result =
                        op.value === "=="
                            ? leftValue === rightValue
                            : leftValue !== rightValue;

                    Logger.log(
                        `AST OPTIMIZATION → Constant folded boolean expression to ${result}`
                    );

                    const boolExpr =
                        new ASTNode(
                            "BooleanExpr",
                            "",
                            node.token
                        );

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

        // Default recursive optimization behavior.
        node.children = node.children.map(
            child => this.optimizeExpr(child)
        );

        return node;
    }

    /**
     * Optimizes if-statements and removes
     * unreachable conditional branches.
     */
    private optimizeIf(node: ASTNode): ASTNode {

        const condition =
            this.optimizeExpr(node.children[0]);

        const block =
            this.optimizeNode(node.children[1]);

        node.children[0] = condition;
        node.children[1] = block;

        // Detect statically-known boolean conditions.
        if (
            condition.name === "BooleanExpr" &&
            condition.children.length === 1
        ) {

            const boolVal = condition.children[0];

            /**
             * Dead Code Elimination:
             * if(false) can never execute.
             */
            if (boolVal.value === "false") {

                Logger.log(
                    "AST OPTIMIZATION → Dead code elimination removed if(false) block."
                );

                return new ASTNode("DeadCode");
            }

            /**
             * if(true) always executes,
             * so replace the entire statement with its block.
             */
            if (boolVal.value === "true") {

                Logger.log(
                    "AST OPTIMIZATION → Dead code elimination replaced if(true) with its block."
                );

                return block;
            }
        }

        return node;
    }

    /**
     * Optimizes while-loops and removes loops
     * with statically false conditions.
     */
    private optimizeWhile(node: ASTNode): ASTNode {

        // Preserve outer constant state.
        const oldConstants = new Map(this.constants);

        const condition =
            this.optimizeExpr(node.children[0]);

        /**
         * Constants cannot safely propagate across loops
         * because loop execution may modify variable values.
         */
        this.constants.clear();

        const block =
            this.optimizeNode(node.children[1]);

        // Restore previous constant state.
        this.constants = oldConstants;

        node.children[0] = condition;
        node.children[1] = block;

        // Remove loops that can never execute.
        if (
            condition.name === "BooleanExpr" &&
            condition.children.length === 1
        ) {

            const boolVal = condition.children[0];

            if (boolVal.value === "false") {

                Logger.log(
                    "AST OPTIMIZATION → Dead code elimination removed while(false) loop."
                );

                return new ASTNode("DeadCode");
            }
        }

        /**
         * Loop unrolling is intentionally skipped unless
         * iteration counts are statically known and safe.
         */
        Logger.log(
            "AST OPTIMIZATION → Loop unrolling skipped unless loop count is statically known."
        );

        return node;
    }

    /**
     * Determines whether an AST node represents
     * a compile-time constant expression.
     */
    private isConstant(node: ASTNode): boolean {

        return (
            node.name === "StringExpr" ||
            node.name === "Digit" ||
            node.name === "BoolVal" ||
            this.getConstantValue(node) !== null
        );
    }

    /**
     * Extracts the compile-time value represented by an AST node.
     *
     * Returns null when the expression is not statically known.
     */
    private getConstantValue(node: ASTNode): string | null {

        if (node.name === "Digit") {
            return node.value;
        }

        if (node.name === "StringExpr") {
            return node.value;
        }

        if (node.name === "BoolVal") {
            return node.value;
        }

        // Single integer literal expression.
        if (
            node.name === "IntExpr" &&
            node.children.length === 1 &&
            node.children[0].name === "Digit"
        ) {
            return node.children[0].value;
        }

        // Single boolean literal expression.
        if (
            node.name === "BooleanExpr" &&
            node.children.length === 1 &&
            node.children[0].name === "BoolVal"
        ) {
            return node.children[0].value;
        }

        return null;
    }

    /**
     * Produces a unique lookup key for an identifier
     * using both variable name and scope.
     */
    private key(node: ASTNode): string {
        return `${node.value}@${node.scopeId ?? "unknown"}`;
    }

    /**
     * Performs a deep clone of an AST subtree.
     *
     * Prevents shared references during optimization rewrites.
     */
    private clone(node: ASTNode): ASTNode {

        const copy =
            new ASTNode(node.name, node.value, node.token);

        copy.scopeId = node.scopeId;
        copy.semanticType = node.semanticType;

        copy.children =
            node.children.map(child => this.clone(child));

        return copy;
    }
}