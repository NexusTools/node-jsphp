export interface PHPParserOptions {
    filename?: string;
    debug?: boolean;
}
export declare class PHPParser {
    private engine;
    constructor();
    parse(code: string, filename?: string): any;
}
