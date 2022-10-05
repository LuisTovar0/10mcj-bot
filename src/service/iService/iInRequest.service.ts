import InRequest from "../../domain/inRequest";
import {SimpleUserProps} from "../../domain/simpleUser";

export type NumberOfRequestsByUser = { user?: string, requests: number }[];

export default interface IInRequestService {

  addInRequest(userProps: SimpleUserProps): Promise<InRequest>;

  getRequestsSince(dateLong: number): Promise<NumberOfRequestsByUser>;

  getLastMonthRequests(): Promise<NumberOfRequestsByUser>;

  getLast15DaysRequests(): Promise<NumberOfRequestsByUser>;

  getLastWeekRequests(): Promise<NumberOfRequestsByUser>;

}
