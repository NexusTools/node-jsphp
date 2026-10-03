import * as http from "http";
export interface HTTPServerOptions {
    cacheDir?: string;
    enableNodeJS?: boolean;
}
export declare function runHTTPServerCLI(rawArgs: string[]): Promise<void>;
export declare function runHTTPServer(port?: number, docRoot?: string, optionsArg?: string | HTTPServerOptions): Promise<http.Server>;
