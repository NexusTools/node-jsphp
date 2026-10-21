import type { PHPEngine } from "../PHPEngine.js";
import type { PHPContext } from "../PHPContext.js";
export declare class OutputBufferStack {
    private buffers;
    start(): boolean;
    write(data: string): void;
    getClean(): string | false;
    getContents(): string | false;
    getLength(): number | false;
    getFlush(ctx?: PHPContext): string | false;
    flush(ctx?: PHPContext): boolean;
    endClean(): boolean;
    flushAll(ctx: PHPContext): void;
    getLevel(): number;
    isActive(): boolean;
}
export declare class OutputBufferRuntime {
    static functions: {
        flush: (ctx: PHPContext) => Promise<boolean>;
        ob_start: (ctx: PHPContext) => Promise<boolean>;
        ob_get_clean: (ctx: PHPContext) => Promise<string | false>;
        ob_get_contents: (ctx: PHPContext) => Promise<string | false>;
        ob_get_length: (ctx: PHPContext) => Promise<number | false>;
        ob_get_flush: (ctx: PHPContext) => Promise<string | false>;
        ob_flush: (ctx: PHPContext) => Promise<boolean>;
        ob_end_flush: (ctx: PHPContext) => Promise<boolean>;
        ob_end_clean: (ctx: PHPContext) => Promise<boolean>;
        ob_clean: (ctx: PHPContext) => Promise<boolean>;
        ob_get_level: (ctx: PHPContext) => Promise<number>;
    };
    static register(engine: PHPEngine): void;
}
