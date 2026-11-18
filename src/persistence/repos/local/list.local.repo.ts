import IListRepo from "../../../service/i-repos/i-list.repo";

export default abstract class ListLocalRepo implements IListRepo {

  private readonly userIds = new Set<number>();

  async add(userId: number): Promise<void> {
    this.userIds.add(userId);
  }

  async contains(userId: number): Promise<boolean> {
    return this.userIds.has(userId);
  }

  async remove(userId: number): Promise<boolean> {
    return this.userIds.delete(userId);
  }

  async fullList(): Promise<number[]> {
    return [ ...this.userIds ].sort((a, b) => a - b);
  }
}
