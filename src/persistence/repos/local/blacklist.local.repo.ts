import {Service} from "typedi";
import IBlacklistRepo from "../../../service/i-repos/i-blacklist.repo";
import ListLocalRepo from "./list.local.repo";

@Service()
export default class BlacklistLocalRepo extends ListLocalRepo implements IBlacklistRepo {

}
