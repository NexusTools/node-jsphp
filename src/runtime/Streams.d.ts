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
    static stream_context_create(ctx: PHPContext | null, options?: Record<string, any>): PHPStreamContext;
    static fopen(ctx: PHPContext, filename: string, mode: string): Promise<PHPFileStream | false>;
    static fclose(ctx: PHPContext | null, stream: PHPFileStream): Promise<boolean>;
    static fread(ctx: PHPContext | null, stream: PHPFileStream, length: number): Promise<string | false>;
    static fwrite(ctx: PHPContext | null, stream: PHPFileStream, data: any, length?: number): Promise<number | false>;
    static stream_get_contents(ctx: PHPContext | null, stream: any, maxLength?: number, offset?: number): Promise<string | false>;
    static stream_get_wrappers(ctx?: PHPContext): string[];
    static stream_is_local(ctx: PHPContext | null, stream: any): boolean;
    static functions: {
        fopen: typeof StreamRuntime.fopen;
        fclose: typeof StreamRuntime.fclose;
        fread: typeof StreamRuntime.fread;
        fwrite: typeof StreamRuntime.fwrite;
        fputs: typeof StreamRuntime.fwrite;
        stream_context_create: typeof StreamRuntime.stream_context_create;
        stream_get_contents: typeof StreamRuntime.stream_get_contents;
        stream_get_wrappers: typeof StreamRuntime.stream_get_wrappers;
        stream_is_local: typeof StreamRuntime.stream_is_local;
    };
    static register(engine: PHPEngine): void;
}
