import { AIAdapter } from "../AIAdapter.js";

class DerivedAdapter extends AIAdapter {
  constructor() {
    super({});
  }

  public generateObject(prompt: string): Promise<any> {
    return Promise.resolve({
      data: null,
    });
  }
}

describe("AIAdapter derived class", () => {
  it("should be able to generate an object", async () => {
    const adapter = new DerivedAdapter();
    const result = await adapter.generateObject("Hello, world!");
    expect(result).toEqual({
      data: null,
    });
  });
});
