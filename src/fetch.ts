/**
 * This module just contains a single side effect. Whenever it detects that a global `fetch`
 * function does not exist, it will warn the user.
 */

if (typeof fetch === 'undefined') {
  console.warn([
    '[apollo-client]: An implementation for the fetch browser API could not be found. Apollo',
    'client requires fetch to execute GraphQL queries against your API server. Please include a',
    'global fetch implementation such as [whatwg-fetch](http://npmjs.com/whatwg-fetch) so that',
    'Apollo client can run in this environment.',
  ].join(' '));
}
