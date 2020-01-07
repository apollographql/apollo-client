let React: typeof import('react');

// Apollo Client can be used without React, which means we want to make sure
// `react` is only imported/required if actually needed. To help with this
// the `react` module is lazy loaded using `requireReactLazily` when used by
// Apollo Client's React integration layer.
export function requireReactLazily(): typeof import('react') {
  return React || (React = require('react'));
}
