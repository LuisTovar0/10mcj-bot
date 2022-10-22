export default interface IImageEditingService {

  /**
   * @return the file name.
   */
  generate(photoSrc: Buffer, dateTxt: string, title: string, options?: ImageEditingOptions): Promise<Buffer>;

}

export interface ImageEditingOptions {
    imgAlign?: number;
    titleSize?: number;
}