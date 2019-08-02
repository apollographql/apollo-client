import { IdValue } from 'apollo-utilities';

export class Reference implements Readonly<IdValue> {
  public readonly type = 'id';
  constructor(
    public readonly id: string,
    public readonly typename: string | undefined,
    public readonly generated = false,
  ) {}
}

export function makeReference(
  id: string,
  typename?: string,
  generated?: boolean,
): Reference {
  return new Reference(id, typename, generated);
}

export function isReference(obj: any): obj is Reference {
  return obj instanceof Reference;
}
