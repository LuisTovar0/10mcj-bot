import {Service} from "typedi";
import IWhitelistRepo from "../../../service/iRepos/iWhitelist.repo";
import ListLocalRepo from "./list.local.repo";

@Service()
export default class WhitelistLocalRepo extends ListLocalRepo implements IWhitelistRepo {

}