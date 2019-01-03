/// <reference path="./declarations.ts" />

export { wrap } from 'optimism';

export class CacheKeyNode<KeyType = object> {
  private children: Map<any, CacheKeyNode<KeyType>> | null = null;
  private key: KeyType | null = null;

  public lookup(...args: any[]): KeyType {
    return this.lookupArray(args);
  }

  public lookupArray(array: any[]): KeyType {
    let node: CacheKeyNode<KeyType> = this;
    array.forEach(value => {
      node = node.getOrCreate(value);
    });
    return node.key || (node.key = Object.create(null));
  }

  public getOrCreate(value: any): CacheKeyNode<KeyType> {
    const map = this.children || (this.children = new Map());
    let node = map.get(value);
    if (!node) {
      map.set(value, (node = new CacheKeyNode<KeyType>()));
    }
    return node;
  }
}
