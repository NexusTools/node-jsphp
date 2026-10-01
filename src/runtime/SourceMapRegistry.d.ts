export interface PHPLineLocation {
    file: string;
    line: number;
    function?: string;
    class?: string;
}
export declare class SourceMapRegistry {
    private static fileLineMaps;
    private static funcToFileMaps;
    private static recentLineMaps;
    static register(filepath: string, lineMap: Map<number, PHPLineLocation>): void;
    static lookup(funcNameHint: string | null, jsLine: number): PHPLineLocation | undefined;
}
