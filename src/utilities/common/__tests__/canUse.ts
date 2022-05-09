import { canUseDOM } from "../canUse";

describe("canUse* boolean constants", () => {
  // https://github.com/apollographql/apollo-client/pull/9675
  it("sets canUseDOM to false when using jsdom", () => {
    expect(canUseDOM).toBe(false);
  });
});
