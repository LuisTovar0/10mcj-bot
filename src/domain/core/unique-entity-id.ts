import { randomUUID } from 'node:crypto';

export default class UniqueEntityID {

  private readonly value: string;

  constructor(id?: string) {
    this.value = id ? id : randomUUID();
  }

  public getValue(): string {
    return this.value;
  }

  public equals(other: any): boolean {
    if (other === null || other === undefined)
      return false;
    if (other as string)
      return this.value === (other as string);
    if (!(other as UniqueEntityID))
      return false;
    return this.value === other.value;
  }

  public toString(): string {
    return this.getValue();
  }

}
