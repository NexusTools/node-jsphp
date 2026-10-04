import { PHPExtension } from "../PHPExtension.js";
import { PHPEngine } from "../PHPEngine.js";
export declare class SPLExtension extends PHPExtension {
    readonly name = "spl";
    private autoloaders;
    private objectIds;
    private nextObjectId;
    private getObjectId;
    onInit(engine: PHPEngine): void;
}
