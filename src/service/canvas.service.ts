import {createCanvas, loadImage, registerFont} from 'canvas';
import {Service} from "typedi";

import IImageEditingService, {ImageEditingOptions} from "./iService/iImageEditing.service";

@Service()
export default class CanvasService implements IImageEditingService {

  private readonly filesFolder = './files';

  constructor() {
    registerFont('./files/Rockwell-Bold.ttf', { family: 'Rockwell', style: 'bold' });
  }

  async generate(photoSrc: Buffer, dateTxt: string, title: string, options?: ImageEditingOptions) {
    const w = 2560, h = 1440;
    const canvas = createCanvas(w, h);
    const ctx = canvas.getContext('2d');

    // photo
    const photoImg = await loadImage(photoSrc);
    const photoDrawnWidth = photoImg.width * h / photoImg.height; // height = h, but keep the proportions
    const offset = Number(options?.imgAlign);
    ctx.drawImage(photoImg, 820 + (isNaN(offset) ? 0 : offset), 0, photoDrawnWidth, h);

    // the colored fill
    const formaImg = await loadImage(`${this.filesFolder}/forma.png`);
    const border = 85; // this image has a shadow around it, so we have to trim it a little
    const formaDrawnWith = formaImg.width * (h + border * 2) / formaImg.height; // keep the proportions
    ctx.drawImage(formaImg, -border, -border, formaDrawnWith, h + border * 2);

    // 10mwJ icon
    const iconImg = await loadImage(`${this.filesFolder}/symbol.png`);
    const iconDfblc = 100; // distance from bottom left corner
    ctx.drawImage(iconImg, iconDfblc, h - iconDfblc - iconImg.height);

    // the border arounthe date
    const dateFormImg = await loadImage(`${this.filesFolder}/forma-data.png`);
    const dateFormDftlc = 100; // distance from top left corner
    const dateFormDrawHeight = 85;
    const dateFormDrawWidth = dateFormImg.width * dateFormDrawHeight / dateFormImg.height;
    ctx.drawImage(dateFormImg, dateFormDftlc, dateFormDftlc, dateFormDrawWidth, dateFormDrawHeight);

    // date text
    ctx.font = "bold 32pt Rockwell";
    ctx.textAlign = "center";
    ctx.fillStyle = "#fff";
    ctx.fillText(dateTxt, dateFormDftlc + dateFormDrawWidth / 2, dateFormDftlc + dateFormDrawHeight / 1.5);

    // title
    ctx.font = `bold ${options?.titleSize || 75}pt Rockwell`;
    ctx.fillStyle = "#fff";
    ctx.textAlign = "left";
    this.wrapText(ctx, title, dateFormDftlc, dateFormDftlc * 3.3, 1200, 100);

    // url text
    ctx.font = "bold 32pt Rockwell";
    ctx.fillStyle = "rgba(255,255,255,0.35)";
    ctx.rotate(Math.PI / -2);
    ctx.fillText("www.10minutoscomjesus.org", h / -2, w - 20);

    return canvas.toBuffer('image/png');
  }

  //https://thewebdev.info/2021/08/28/how-to-wrap-text-in-a-canvas-element-with-javascript/
  wrapText(ctx: any, text: string, x: number, y: number, maxWidth: number, lineHeight: number) {
    const words = text.split(' ');
    let line = '';
    words.forEach((w, index) => {
      const testLine = line + w + ' ';
      const metrics = ctx.measureText(testLine);
      const testWidth = metrics.width;
      if (testWidth > maxWidth && index > 0) {
        ctx.fillText(line, x, y);
        line = w + ' ';
        y += lineHeight;
      } else {
        line = testLine;
      }
    });
    ctx.fillText(line, x, y);
  }

}
