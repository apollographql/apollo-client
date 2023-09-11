import { checkFetcher } from "../checkFetcher";

describe("checkFetcher", () => {
  const fetch = window.fetch;
  afterEach(() => {
    window.fetch = fetch;
  });
  it("throws if no fetch is present", () => {
    // @ts-expect-error
    delete window.fetch;

    expect(() => checkFetcher(undefined)).toThrow(
      /has not been found globally/
    );
  });

  it("does not throws if no fetch is present but a fetch is passed", () => {
    // @ts-expect-error
    delete window.fetch;

    expect(() => checkFetcher((() => {}) as any)).not.toThrow();
  });
});
