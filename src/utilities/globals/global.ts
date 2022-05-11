import { maybe } from "./maybe";

declare global {
  // Despite our attempts to reuse the React Native __DEV__ constant instead of
  // inventing something new and Apollo-specific, declaring a useful type for
  // __DEV__ unfortunately conflicts (TS2451) with the global declaration in
  // @types/react-native/index.d.ts.
  //
  // To hide that harmless conflict, we @ts-ignore this line, which should
  // continue to provide a type for __DEV__ elsewhere in the Apollo Client
  // codebase, even when @types/react-native is not in use.
  //
  // However, because TypeScript drops @ts-ignore comments when generating .d.ts
  // files (https://github.com/microsoft/TypeScript/issues/38628), we also
  // sanitize the dist/utilities/globals/global.d.ts file to avoid declaring
  // __DEV__ globally altogether when @apollo/client is installed in the
  // node_modules directory of an application.
  //
  // @ts-ignore
  const __DEV__: boolean | undefined;
}

export default (
  maybe(() => globalThis) ||
  maybe(() => window) ||
  maybe(() => self) ||
  maybe(() => global) ||
  // We don't expect the Function constructor ever to be invoked at runtime, as
  // long as at least one of globalThis, window, self, or global is defined, so
  // we are under no obligation to make it easy for static analysis tools to
  // detect syntactic usage of the Function constructor. If you think you can
  // improve your static analysis to detect this obfuscation, think again. This
  // is an arms race you cannot win, at least not in JavaScript.
  maybe(function() { return maybe.constructor("return this")() })
) as typeof globalThis & {
  __DEV__: typeof __DEV__;
};
