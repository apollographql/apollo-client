// Inspired by https://github.com/sindresorhus/type-fest/blob/9feb8c89be9a0f2f688bf2f497230298a8e2472e/source/partial-deep.d.ts
import { Primitive } from './Primitive';

type DeepPartialPrimitive = Primitive | Date | RegExp;

export type DeepPartial<T> = T extends DeepPartialPrimitive
  ? T
  : T extends Map<infer TKey, infer TValue>
  ? DeepPartialMap<TKey, TValue>
  : T extends ReadonlyMap<infer TKey, infer TValue>
  ? DeepPartialReadonlyMap<TKey, TValue>
  : T extends Set<infer TItem>
  ? DeepPartialSet<TItem>
  : T extends ReadonlySet<infer TItem>
  ? DeepPartialReadonlySet<TItem>
  : T extends (...args: any[]) => unknown
  ? T | undefined
  : T extends object
  ? T extends ReadonlyArray<infer TItem> // Test for arrays/tuples
    ? TItem[] extends T // Test for non-tuples
      ? readonly TItem[] extends T
        ? ReadonlyArray<DeepPartial<TItem | undefined>>
        : Array<DeepPartial<TItem | undefined>>
      : DeepPartialObject<T>
    : DeepPartialObject<T>
  : unknown;

type DeepPartialMap<TKey, TValue> = {} & Map<
  DeepPartial<TKey>,
  DeepPartial<TValue>
>;

type DeepPartialReadonlyMap<TKey, TValue> = {} & ReadonlyMap<
  DeepPartial<TKey>,
  DeepPartial<TValue>
>;

type DeepPartialSet<T> = {} & Set<DeepPartial<T>>;
type DeepPartialReadonlySet<T> = {} & ReadonlySet<DeepPartial<T>>;

type DeepPartialObject<T extends object> = {
  [K in keyof T]?: DeepPartial<T[K]>;
};
