import InRequest from "../../domain/in-request";
import {SimpleUserProps} from "../../domain/simple-user";

export type NumberOfRequestsByUser = { user?: string, requests: number }[];

export default interface IInRequestService {

  addInRequest(userProps: SimpleUserProps): Promise<InRequest>;

  getRequestsSince(dateLong: number): Promise<NumberOfRequestsByUser>;

  getLastMonthRequests(): Promise<NumberOfRequestsByUser>;

  getLast15DaysRequests(): Promise<NumberOfRequestsByUser>;

  getLastWeekRequests(): Promise<NumberOfRequestsByUser>;

}
