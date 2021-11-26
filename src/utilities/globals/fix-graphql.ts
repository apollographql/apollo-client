// The ordering of these imports is important, because it ensures the temporary
// process.env.NODE_ENV polyfill is defined globally (if necessary) before we
// import { Source } from 'graphql'. The instanceOf function that we really care
// about (the one that uses process.env.NODE_ENV) is not exported from the
// top-level graphql package, but graphql/language/source uses instanceOf, and
// has relatively few dependencies, so importing it here should not increase
// bundle sizes as much as other options.
import { remove } from 'ts-invariant/process';
import { Source } from 'graphql';

export function removeTemporaryGlobals() {
  // Using Source here here just to make sure it won't be tree-shaken away.
  return typeof Source === "function" ? remove() : remove();
}
