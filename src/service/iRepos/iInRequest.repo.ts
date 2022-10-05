import InRequestDataModel from "../../persistence/dataModel/inRequest.dataModel";

export default interface IInRequestRepo {

  /**
   * A domain ID and user are provided, but the Repo handles the date.
   */
  newRequest(domainId: string, user: string): Promise<InRequestDataModel>;

  requestsSince(dateLong: number): Promise<InRequestDataModel[]>;

}
