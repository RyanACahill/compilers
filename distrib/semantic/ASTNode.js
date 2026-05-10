export class ASTNode {
    constructor(name, value = "", token = null) {
        this.name = name;
        this.value = value;
        this.token = token;
        this.children = [];
        this.scopeId = null;
        this.semanticType = null;
    }
    addChild(child) {
        this.children.push(child);
    }
    withChildren(children) {
        this.children = children;
        return this;
    }
}
