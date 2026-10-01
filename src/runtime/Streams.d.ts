import * as fs from "fs/promises";
import type { PHPEngine } from "../PHPEngine";
import type { PHPContext } from "../PHPContext";
export declare class PHPStreamContext {
    options: Record<string, any>;
    constructor(options?: Record<string, any>);
}
export interface PHPFileStream {
    handle: fs.FileHandle;
    isResource: boolean;
}
export declare class StreamRuntime {
    static register(engine: PHPEngine): void;
    static stream_context_create(options?: Record<string, any>): PHPStreamContext;
    static fopen(ctx: PHPContext, filename: string, mode: string): Promise<PHPFileStream | false>;
    static fclose(stream: PHPFileStream): Promise<boolean>;
    static fread(stream: PHPFileStream, length: number): Promise<string | false>;
    static fwrite(stream: PHPFileStream, data: any, length?: number): Promise<number | false>;
    static stream_get_contents(stream: any, maxLength?: number, offset?: number): Promise<string | false>;
    static stream_get_wrappers(): string[];
    static stream_is_local(stream: any): boolean;
}
