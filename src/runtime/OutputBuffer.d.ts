import type { PHPEngine } from "../PHPEngine";
export declare class OutputBufferRuntime {
    static register(engine: PHPEngine): void;
}
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
