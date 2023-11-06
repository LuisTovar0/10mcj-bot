import IListRepo from "../../../service/i-repos/i-list.repo";

export default abstract class ListLocalRepo implements IListRepo {

  private whitelist: string[] = []

  async add(username: string): Promise<void> {
    this.whitelist.push(username)
  }

  async contains(username: string): Promise<boolean> {
    return this.whitelist.indexOf(username) !== -1;
  }

  async remove(username: string): Promise<void> {
    this.whitelist = this.whitelist.filter(v => v !== username);
  }

  async fullList(): Promise<string[]> {
    return [...this.whitelist]; // copy
  }
}
