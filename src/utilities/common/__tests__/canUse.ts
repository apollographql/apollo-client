import { canUseLayoutEffect } from "@apollo/client/utilities";

describe("canUse* boolean constants", () => {
  it("sets canUseLayoutEffect to false when using Jest in Node.js with jsdom", () => {
    expect(canUseLayoutEffect).toBe(false);
  });
});
