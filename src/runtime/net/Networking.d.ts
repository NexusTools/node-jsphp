import type { PHPContext } from "../../PHPContext";
export declare class NetworkingRuntime {
    static gethostname(): string;
    static gethostbyname(hostname: string): Promise<string>;
    static gethostbyaddr(ip: string): Promise<string>;
    static gethostbynamel(hostname: string): Promise<string[] | false>;
    static ip2long(ip: string): number | false;
    static long2ip(num: number): string | false;
    static parse_url(urlStr: string, component?: number): any;
    static http_build_query(data: any, numericPrefix?: string, argSeparator?: string): string;
    static header(ctx: PHPContext, headerStr: string, replace?: boolean, httpResponseCode?: number): void;
    static http_response_code(ctx: PHPContext, responseCode?: number): number;
}
