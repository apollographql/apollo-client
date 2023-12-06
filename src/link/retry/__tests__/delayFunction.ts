import { buildDelayFunction } from "../delayFunction";

describe("buildDelayFunction", () => {
  // For easy testing of just the delay component, which is all we care about in
  // the default implementation.
  interface SimpleDelayFunction {
    (count: number): number;
  }

  function delayRange(delayFunction: SimpleDelayFunction, count: number) {
    const results = [];
    for (let i = 1; i <= count; i++) {
      results.push(delayFunction(i));
    }
    return results;
  }

  describe("without jitter", () => {
    it("grows exponentially up to maxDelay", () => {
      const delayFunction = buildDelayFunction({
        jitter: false,
        initial: 100,
        max: 1000,
      }) as SimpleDelayFunction;

      expect(delayRange(delayFunction, 6)).toEqual([
        100, 200, 400, 800, 1000, 1000,
      ]);
    });
  });

  describe("with jitter", () => {
    let mockRandom: any, origRandom: any;
    beforeEach(() => {
      mockRandom = jest.fn();
      origRandom = Math.random;
      Math.random = mockRandom;
    });

    afterEach(() => {
      Math.random = origRandom;
    });

    it("jitters, on average, exponentially up to maxDelay", () => {
      const delayFunction = buildDelayFunction({
        jitter: true,
        initial: 100,
        max: 1000,
      }) as SimpleDelayFunction;

      mockRandom.mockReturnValue(0.5);
      expect(delayRange(delayFunction, 5)).toEqual([100, 200, 400, 500, 500]);
    });

    it("can have instant retries as the low end of the jitter range", () => {
      const delayFunction = buildDelayFunction({
        jitter: true,
        initial: 100,
        max: 1000,
      }) as SimpleDelayFunction;

      mockRandom.mockReturnValue(0);
      expect(delayRange(delayFunction, 5)).toEqual([0, 0, 0, 0, 0]);
    });

    it("uses double the calculated delay as the high end of the jitter range, up to maxDelay", () => {
      const delayFunction = buildDelayFunction({
        jitter: true,
        initial: 100,
        max: 1000,
      }) as SimpleDelayFunction;

      mockRandom.mockReturnValue(1);
      expect(delayRange(delayFunction, 5)).toEqual([200, 400, 800, 1000, 1000]);
    });
  });
});
