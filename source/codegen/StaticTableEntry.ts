export class StaticTableEntry {
    constructor(
        public temp: string,
        public variableName: string,
        public scope: number,
        public address: number | null = null
    ) {}
}