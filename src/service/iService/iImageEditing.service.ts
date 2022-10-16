export default interface IImageEditingService {

    /**
     * @return the file name.
     */
    req(photoSrc: string, dateTxt: string, title: string, options?: ImageEditingOptions): Promise<string>;

}

export interface ImageEditingOptions {
    imgAlign?: number;
    titleSize?: number;
}