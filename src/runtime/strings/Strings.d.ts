export declare class StringRuntime {
    static strlen(str: string): number;
    static substr(str: string, start: number, length?: number): string;
    static strpos(haystack: string, needle: string, offset?: number): number | false;
    static explode(delimiter: string, string: string, limit?: number): string[];
    static implode(glue: string, pieces: any[]): string;
}
