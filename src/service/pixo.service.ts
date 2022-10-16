import { Inject, Service } from "typedi";

import IImageEditingService, { ImageEditingOptions } from "./iService/iImageEditing.service";
import { loadEnvVars } from "../config";
import axios from "axios";

@Service()
export default class PixoService implements IImageEditingService {

  static readonly url = "https://pixoeditor.com/api";
  static readonly apiKey = loadEnvVars({ pixioKey: '' }).pixioKey;

  constructor() {

  }

  async req(src: string, dateTxt: string, title: string, options?: ImageEditingOptions) {
    const text = [{
      fontFamily: "Times New Roman", position: "center",
      fontSize: 15, lineHeight: 15, charSpacing: 5, fontWeight: "bold",
      fontStyle: "italic", underline: true, linethrough: false, superscript: false,
      subscript: false, fill: "red", textShadow: true, textShadowColor: "black",
      textShadowOffsetX: 5, textShadowOffsetY: 5, textShadowBlur: 5,
      textStroke: false, strokeWidth: 0, textBackground: false,
      textBackgroundColor: "white", background: false, backgroundColor: "white"
    }];
    console.log(PixoService.apiKey, PixoService.url);
    axios.post(`${PixoService.url}/image`, {
      apikey: PixoService.apiKey, src,
      filter: "Sepia", // text
    },/*{ maxContentLength:99999999999999 }*/);
  }

}
