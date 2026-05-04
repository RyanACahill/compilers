export class SymbolTableEntry {
    constructor(
        public name: string,
        public type: string,
        public scope: number,
        public line: number,
        public column: number,
        public initialized: boolean = false,
        public used: boolean = false
    ) {}
}