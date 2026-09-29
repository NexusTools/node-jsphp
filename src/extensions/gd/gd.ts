import sharp from "sharp";
import { PHPExtension } from "../../PHPExtension";
import { PHPEngine } from "../../PHPEngine";
import { PHPContext } from "../../PHPContext";

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
      IMG_GIF: 1,
      IMG_JPG: 2,
      IMG_PNG: 4,
    };

    this.functions = {
      imagecreatetruecolor: (ctx: PHPContext, width: number, height: number) => {
        return new GDImage(width, height);
      },
      imagesx: (ctx: PHPContext, img: GDImage) => img?.width || 0,
      imagesy: (ctx: PHPContext, img: GDImage) => img?.height || 0,
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
