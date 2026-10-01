import type { PHPEngine } from "../PHPEngine";
import type { PHPContext } from "../PHPContext";
export declare class OutputBufferStack {
    private buffers;
    start(): boolean;
    write(data: string): void;
    getClean(): string;
    getContents(): string;
    flush(): boolean;
    endClean(): boolean;
    getLevel(): number;
    isActive(): boolean;
}
export declare class OutputBufferRuntime {
    static functions: {
        flush: (ctx: PHPContext) => boolean;
        ob_start: (ctx: PHPContext) => boolean;
        ob_get_clean: (ctx: PHPContext) => string;
        ob_get_contents: (ctx: PHPContext) => string;
        ob_flush: (ctx: PHPContext) => boolean;
        ob_end_clean: (ctx: PHPContext) => boolean;
        ob_get_level: (ctx: PHPContext) => number;
    };
    static register(engine: PHPEngine): void;
}
