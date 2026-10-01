import * as http from "http";
export declare function runHTTPServer(port?: number, docRoot?: string, cacheDir?: string): Promise<http.Server>;
