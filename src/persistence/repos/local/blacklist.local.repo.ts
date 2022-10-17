import IBlacklistRepo from "../../../service/iRepos/iBlacklist.repo";
import ListLocalRepo from "./list.local.repo";
import {Service} from "typedi";

@Service()
export default class BlacklistLocalRepo extends ListLocalRepo implements IBlacklistRepo {

}