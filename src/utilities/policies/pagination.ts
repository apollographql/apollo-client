import { FieldPolicy, Reference } from '../../cache';

type KeyArgs = FieldPolicy<any>["keyArgs"];

// A basic field policy that uses options.args.{offset,limit} to splice
// the incoming data into the existing array. If your arguments are called
// something different (like args.{start,count}), feel free to copy/paste
// this implementation and make the appropriate changes.
export function offsetLimitPagination<T = Reference>(
  keyArgs: KeyArgs = false,
): FieldPolicy<T[]> {
  return {
    keyArgs,
    merge(existing, incoming, { args }) {
      const merged = existing ? existing.slice(0) : [];
      const start = args ? args.offset : merged.length;
      const end = start + incoming.length;
      for (let i = start; i < end; ++i) {
        merged[i] = incoming[i - start];
      }
      return merged;
    },
  };
}
