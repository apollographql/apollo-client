import { IdValue } from 'apollo-utilities';

export class Reference implements Readonly<IdValue> {
  public readonly type = 'id';
  public readonly generated = false;
  constructor(
    public readonly id: string,
    public readonly typename: string | undefined,
  ) {}
}

export function makeReference(id: string, typename?: string): Reference {
  return new Reference(id, typename);
}

export function isReference(obj: any): obj is Reference {
  return obj instanceof Reference;
}
