import fetch from 'unfetch';

const context: any = (
  typeof window !== 'undefined' ? window :
  typeof global !== 'undefined' ? global :
  typeof self !== 'undefined' ? self :
  {}
);

if (typeof context.fetch === 'undefined') {
  context.fetch = fetch;
}
