import { canUseDOM, canUseLayoutEffect } from "../canUse";

describe("canUse* boolean constants", () => {
  // https://github.com/apollographql/apollo-client/pull/9675
  it("sets canUseDOM to true when using Jest in Node.js with jsdom", () => {
    expect(canUseDOM).toBe(true);
  });
  it("sets canUseLayoutEffect to false when using Jest in Node.js with jsdom", () => {
    expect(canUseLayoutEffect).toBe(false);
  });
});
