/**
 * Apollo-client adds Symbols to the data in the store. In order to make
 * assertions in our tests easier we strip these Symbols from the data.
 */
export function stripSymbols<T>(data: T): T {
  return JSON.parse(JSON.stringify(data));
}
