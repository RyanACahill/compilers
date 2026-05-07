import { Token } from "../lexer/Token.js";

export class ASTNode {
    public children: ASTNode[] = [];

    public scopeId: number | null = null;
    public semanticType: string | null = null;

    constructor(
        public name: string,
        public value: string = "",
        public token: Token | null = null
    ) {}

    public addChild(child: ASTNode): void {
        this.children.push(child);
    }
}