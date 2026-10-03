import * as fs from "fs/promises";
import type { PHPEngine } from "../PHPEngine";
import type { PHPContext } from "../PHPContext";
import { PHPReference } from "./PHPVariable";
export declare class PHPStreamContext {
    options: Record<string, any>;
    constructor(options?: Record<string, any>);
}
export interface PHPFileStream {
    handle: fs.FileHandle;
    isResource: boolean;
}
export declare class StreamRuntime {
    static stream_context_create(ctx: PHPContext | null, optionsArg?: PHPReference): PHPStreamContext;
    static fopen(ctx: PHPContext, filenameArg?: PHPReference, modeArg?: PHPReference): Promise<PHPFileStream | false>;
    static fclose(ctx: PHPContext | null, streamArg?: PHPReference): Promise<boolean>;
    static fread(ctx: PHPContext | null, streamArg?: PHPReference, lengthArg?: PHPReference): Promise<string | false>;
    static fwrite(ctx: PHPContext | null, streamArg?: PHPReference, dataArg?: PHPReference, lengthArg?: PHPReference): Promise<number | false>;
    static stream_get_contents(ctx: PHPContext | null, streamArg?: PHPReference, maxLengthArg?: PHPReference, offsetArg?: PHPReference): Promise<string | false>;
    static stream_get_wrappers(ctx?: PHPContext): string[];
    static stream_is_local(ctx: PHPContext | null, streamArg?: PHPReference): boolean;
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
