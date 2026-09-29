"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GDExtension = exports.GDImage = void 0;
const PHPExtension_1 = require("../../PHPExtension");
class GDImage {
    width;
    height;
    buffer;
    constructor(width, height) {
        this.width = width;
        this.height = height;
    }
}
exports.GDImage = GDImage;
class GDExtension extends PHPExtension_1.PHPExtension {
    name = "gd";
    onInit(engine) {
        this.constants = {
            IMG_GIF: 1,
            IMG_JPG: 2,
            IMG_PNG: 4,
        };
        this.functions = {
            imagecreatetruecolor: (ctx, width, height) => {
                return new GDImage(width, height);
            },
            imagesx: (ctx, img) => img?.width || 0,
            imagesy: (ctx, img) => img?.height || 0,
            gd_info: () => ({
                "GD Version": "2.3.3",
                "FreeType Support": true,
                "GIF Read Support": true,
                "GIF Create Support": true,
                "JPEG Support": true,
                "PNG Support": true,
            }),
        };
    }
}
exports.GDExtension = GDExtension;
//# sourceMappingURL=gd.js.map