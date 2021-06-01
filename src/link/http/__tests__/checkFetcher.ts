import { checkFetcher } from '../checkFetcher';

describe('checkFetcher', () => {
  let oldFetch: WindowOrWorkerGlobalScope['fetch'];
  beforeEach(() => {
    oldFetch = window.fetch;
    delete window.fetch;
  });

  afterEach(() => {
    window.fetch = oldFetch;
  });

  it('throws if no fetch is present', () => {
    expect(() => checkFetcher(undefined)).toThrow(
      /has not been found globally/,
    );
  });

  it('does not throws if no fetch is present but a fetch is passed', () => {
    expect(() => checkFetcher((() => {}) as any)).not.toThrow();
  });
});
