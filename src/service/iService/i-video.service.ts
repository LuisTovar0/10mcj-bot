export default interface IVideoService {

  createVideo(image: string): Promise<void>;

}
