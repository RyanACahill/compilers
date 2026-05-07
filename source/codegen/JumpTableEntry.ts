export class JumpTableEntry {
    constructor(
        public placeholder: string,
        public distance: number | null = null
    ) {}
}