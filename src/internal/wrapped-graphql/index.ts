// The ordering of these imports is important, because it ensures the temporary
// process.env.NODE_ENV polyfill is defined globally (if necessary) before we
// import { Source } from 'graphql'. The instanceOf function that we really care
// about (the one that uses process.env.NODE_ENV) is not exported from the
// top-level graphql package, but graphql/language/source uses instanceOf, and
// has relatively few dependencies, so importing it here should not increase
// bundle sizes as much as other options.
import { remove } from 'ts-invariant/process';
// eslint-disable-next-line no-restricted-imports
import {
  Source,
  visit,
  print,
  Kind,
  OperationTypeNode,
  BREAK,
  isSelectionNode,
  validate,
  execute,
} from 'graphql';

// Using Source here here just to make sure it won't be tree-shaken away.
typeof Source === 'function' ? remove() : remove();

// re-exporting only the minimum functionality we currently use
// as `export * from` gets transpiled away in a way that would defeat most tree-shaking
export {
  visit,
  print,
  Kind,
  OperationTypeNode,
  BREAK,
  isSelectionNode,
  validate,
  execute,
};

// eslint-disable-next-line no-restricted-imports
export type * from 'graphql';
