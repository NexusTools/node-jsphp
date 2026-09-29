export interface PHPLineLocation {
    file: string;
    line: number;
    function?: string;
    class?: string;
}
export declare class SourceMapRegistry {
    private static fileLineMaps;
    private static globalLineMaps;
    static register(filepath: string, lineMap: Map<number, PHPLineLocation>): void;
    static lookup(filepath: string | null, jsLine: number): PHPLineLocation | undefined;
}
