import {Observable} from "rxjs";

export interface VideoCreation$ {
  type: 'message' | 'video';
  content: string;
}

export default interface IVideoService {

  createVideo(image: string): Observable<VideoCreation$>;

}
