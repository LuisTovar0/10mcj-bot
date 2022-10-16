export default interface IImageEditingService {
    req(photoSrc: string, dateTxt: string, title: string, options?: ImageEditingOptions): Promise<void>;
}

export interface ImageEditingOptions {
    imgAlign?: number;
    titleSize?: number;
}