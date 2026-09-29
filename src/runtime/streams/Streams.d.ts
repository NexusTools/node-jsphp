export declare class PHPStreamContext {
    options: Record<string, any>;
    constructor(options?: Record<string, any>);
}
export declare class StreamRuntime {
    static stream_context_create(options?: Record<string, any>): PHPStreamContext;
    static stream_get_contents(stream: any, maxLength?: number, offset?: number): Promise<string | false>;
    static stream_get_wrappers(): string[];
    static stream_is_local(stream: any): boolean;
}
