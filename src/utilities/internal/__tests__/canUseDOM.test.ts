import { canUseDOM } from "@apollo/client/utilities/internal";

// https://github.com/apollographql/apollo-client/pull/9675
test("sets canUseDOM to true when using Jest in Node.js with jsdom", () => {
  expect(canUseDOM).toBe(true);
});
