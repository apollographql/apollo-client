// Inspired by type-fest PartialDeep: https://github.com/sindresorhus/type-fest/blob/9feb8c89be9a0f2f688bf2f497230298a8e2472e/source/partial-deep.d.ts
//
// We're including the license to give credit to the original implementation.
// https://github.com/sindresorhus/type-fest/blob/main/license-mit

/*
 * MIT License
 *
 * Copyright (c) Sindre Sorhus <sindresorhus@gmail.com> (https://sindresorhus.com)
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
 */
import type { Primitive } from "./Primitive.js";

type DeepPartialPrimitive = Primitive | Date | RegExp;

export type DeepPartial<T> =
  T extends DeepPartialPrimitive ? T
  : T extends Map<infer TKey, infer TValue> ? DeepPartialMap<TKey, TValue>
  : T extends ReadonlyMap<infer TKey, infer TValue> ?
    DeepPartialReadonlyMap<TKey, TValue>
  : T extends Set<infer TItem> ? DeepPartialSet<TItem>
  : T extends ReadonlySet<infer TItem> ? DeepPartialReadonlySet<TItem>
  : T extends (...args: any[]) => unknown ? T | undefined
  : T extends object ?
    T extends (
      ReadonlyArray<infer TItem> // Test for arrays/tuples
    ) ?
      TItem[] extends (
        T // Test for non-tuples
      ) ?
        readonly TItem[] extends T ?
          ReadonlyArray<DeepPartial<TItem | undefined>>
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
