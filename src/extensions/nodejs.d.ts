import { PHPExtension } from "../PHPExtension.js";
import { PHPEngine } from "../PHPEngine.js";
import { PHPContext } from "../PHPContext.js";
import { PHPObject } from "../runtime/PHPObject.js";
export declare function wrapJSValue(val: any): any;
export declare function unwrapPHPValue(val: any): any;
export declare class NodeJSObject extends PHPObject {
    jsValue: any;
    constructor(jsValue: any);
    getProperty(ctx: PHPContext, name: string): Promise<any>;
    setProperty(ctx: PHPContext, name: string, value: any): Promise<void>;
    callMethod(ctx: PHPContext, name: string, args?: any[]): Promise<any>;
}
export declare class NodeJSService {
    static require(moduleName: string): any;
    static global(name: string): any;
    static eval(code: string): any;
    static new(classNameOrModule: string, ...args: any[]): any;
}
export declare class NodeJSExtension extends PHPExtension {
    readonly name = "nodejs";
    onInit(engine: PHPEngine): void;
}
