import { canUseLayoutEffect } from "@apollo/client/utilities/internal";

test("sets canUseLayoutEffect to false when using Jest in Node.js with jsdom", () => {
  expect(canUseLayoutEffect).toBe(false);
});
