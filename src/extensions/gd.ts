import sharp from "sharp";
import { PHPExtension } from "../PHPExtension.js";
import { PHPEngine } from "../PHPEngine.js";
import { PHPContext } from "../PHPContext.js";
import { PHPReference } from "../runtime/PHPVariable.js";

export class GDImage {
  public width: number;
  public height: number;
  public buffer?: Buffer;

  constructor(width: number, height: number) {
    this.width = width;
    this.height = height;
  }
}

export class GDExtension extends PHPExtension {
  public readonly name = "gd";

  public onInit(engine: PHPEngine): void {
    this.constants = {
      img_gif: 1,
      img_jpg: 2,
      img_png: 4,
    };

    this.functions = {
      imagecreatetruecolor: (ctx: PHPContext, widthArg?: PHPReference, heightArg?: PHPReference) => {
        const width = Number(widthArg?.get()) || 0;
        const height = Number(heightArg?.get()) || 0;
        return new GDImage(width, height);
      },
      imagesx: (ctx: PHPContext, imgArg?: PHPReference) => {
        const img = imgArg?.get();
        return img?.width || 0;
      },
      imagesy: (ctx: PHPContext, imgArg?: PHPReference) => {
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
