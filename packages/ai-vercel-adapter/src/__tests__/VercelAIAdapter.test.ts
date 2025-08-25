import { VercelAIAdapter } from "../VercelAIAdapter.js";

describe("VercelAIAdapter", () => {
  it("should be able to be instantiated", () => {
    const adapter = new VercelAIAdapter({
      model: "gpt-4o-mini",
    });
    expect(adapter).toBeInstanceOf(VercelAIAdapter);
  });
});
