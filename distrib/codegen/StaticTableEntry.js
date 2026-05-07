export class StaticTableEntry {
    constructor(temp, variableName, scope, address = null) {
        this.temp = temp;
        this.variableName = variableName;
        this.scope = scope;
        this.address = address;
    }
}
