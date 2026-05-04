import { Token } from "../lexer/Token.js";

export class ASTNode {
    public children: ASTNode[] = [];

    constructor(
        public name: string,
        public value: string = "",
        public token: Token | null = null
    ) {}

    public addChild(child: ASTNode): void {
        this.children.push(child);
    }
}