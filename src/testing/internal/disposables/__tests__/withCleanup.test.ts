import { withCleanup } from "../index.js";
describe("withCleanup", () => {
  it("calls cleanup", () => {
    let cleanedUp = false;
    {
      using _x = withCleanup({}, () => {
        cleanedUp = true;
      });
      expect(cleanedUp).toBe(false);
    }
    expect(cleanedUp).toBe(true);
  });
});
