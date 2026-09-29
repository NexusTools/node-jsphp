import type { PHPContext } from "../../PHPContext";
export declare class NetworkingRuntime {
    static checkServerOutputHandler(ctx: PHPContext, funcName: string): void;
    static gethostname(): string;
    static gethostbyname(hostname: string): Promise<string>;
    static gethostbyaddr(ip: string): Promise<string>;
    static gethostbynamel(hostname: string): Promise<string[] | false>;
    static ip2long(ip: string): number | false;
    static long2ip(num: number): string | false;
    static parse_url(urlStr: string, component?: number): any;
    static http_build_query(data: any, numericPrefix?: string, argSeparator?: string): string;
    static header(ctx: PHPContext, headerStr: string, replace?: boolean, httpResponseCode?: number): void;
    static setcookie(ctx: PHPContext, name: string, value?: string, expires?: number, path?: string, domain?: string, secure?: boolean, httponly?: boolean): boolean;
    static setrawcookie(ctx: PHPContext, name: string, value?: string, expires?: number, path?: string, domain?: string, secure?: boolean, httponly?: boolean): boolean;
    static header_remove(ctx: PHPContext, name?: string): void;
    static headers_list(ctx: PHPContext): string[];
    static headers_sent(ctx: PHPContext): boolean;
    static http_response_code(ctx: PHPContext, responseCode?: number): number;
}
