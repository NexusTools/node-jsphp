import { PHPExtension } from "../PHPExtension";
import { PHPEngine } from "../PHPEngine";
export declare class SPLExtension extends PHPExtension {
    readonly name = "spl";
    private autoloaders;
    private objectIds;
    private nextObjectId;
    private getObjectId;
    onInit(engine: PHPEngine): void;
}
