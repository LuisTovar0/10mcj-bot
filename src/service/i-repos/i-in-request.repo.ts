import InRequestDataModel from "../../persistence/data-model/in-request.data-model";

export default interface IInRequestRepo {

  /**
   * A domain ID and user are provided, but the Repo handles the date.
   */
  newRequest(domainId: string, user: string): Promise<InRequestDataModel>;

  requestsSince(dateLong: number): Promise<InRequestDataModel[]>;

}
