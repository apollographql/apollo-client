import { withCleanup } from "@apollo/client/testing/internal";
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
