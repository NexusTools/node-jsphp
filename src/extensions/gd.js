"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GDExtension = exports.GDImage = void 0;
const PHPExtension_1 = require("../PHPExtension");
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
            img_gif: 1,
            img_jpg: 2,
            img_png: 4,
        };
        this.functions = {
            imagecreatetruecolor: (ctx, widthArg, heightArg) => {
                const width = Number(widthArg?.get()) || 0;
                const height = Number(heightArg?.get()) || 0;
                return new GDImage(width, height);
            },
            imagesx: (ctx, imgArg) => {
                const img = imgArg?.get();
                return img?.width || 0;
            },
            imagesy: (ctx, imgArg) => {
                const img = imgArg?.get();
                return img?.height || 0;
            },
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