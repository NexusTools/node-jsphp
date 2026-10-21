import { PHPExtension } from "../PHPExtension.js";
export class GDImage {
    width;
    height;
    buffer;
    constructor(width, height) {
        this.width = width;
        this.height = height;
    }
}
export class GDExtension extends PHPExtension {
    name = "gd";
    onInit(engine) {
        this.constants = {
            img_gif: 1,
            img_jpg: 2,
            img_png: 4,
        };
        this.functions = {
            imagecreatetruecolor: async (ctx, widthArg, heightArg) => {
                const width = Number(await widthArg?.get()) || 0;
                const height = Number(await heightArg?.get()) || 0;
                return new GDImage(width, height);
            },
            imagesx: async (ctx, imgArg) => {
                const img = await imgArg?.get();
                return img?.width || 0;
            },
            imagesy: async (ctx, imgArg) => {
                const img = await imgArg?.get();
                return img?.height || 0;
            },
            gd_info: async () => ({
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
//# sourceMappingURL=gd.js.map