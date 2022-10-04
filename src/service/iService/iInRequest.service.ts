import InRequest from "../../domain/inRequest";
import {SimpleUserProps} from "../../domain/simpleUser";

export default interface IInRequestService {

  addInRequest(userProps: SimpleUserProps): Promise<InRequest>;

}
