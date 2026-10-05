import * as http from "http";
export interface HTTPServerOptions {
    cacheDir?: string;
    enableNodeJS?: boolean;
    disabledExtensions?: string[];
}
export declare function runHTTPServerCLI(rawArgs: string[]): Promise<http.Server | void>;
export declare function runHTTPServer(port?: number, docRoot?: string, optionsArg?: string | HTTPServerOptions): Promise<http.Server>;
