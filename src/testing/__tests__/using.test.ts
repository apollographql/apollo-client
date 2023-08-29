type NoInfer<T> = [T][T extends any ? 0 : never];

function defineDisposable<Args extends any[], T extends object>(
  create: (...args: Args) => T,
  cleanup: (object: NoInfer<T>, ...args: NoInfer<Args>) => void
) {
  return function (...args: Args): T & Disposable {
    const obj = create(...args);
    return Object.assign(obj, {
      [Symbol.dispose]() {
        cleanup.call(undefined, obj, args);
      },
    });
  };
}

const mockedConsoleMethods = ["log", "info", "warn", "error", "debug"] as const;
const spyOnConsole = defineDisposable(
  () => {
    let originalMethods = { ...console };
    let calls: Record<(typeof mockedConsoleMethods)[number], any[][]> =
      {} as any;
    for (const key of mockedConsoleMethods) {
      calls[key] = [];
      console[key] = (...args: any[]) => {
        calls[key].push(args);
      };
    }
    return { originalMethods, ...calls };
  },
  (object) => {
    for (const key of mockedConsoleMethods) {
      console[key] = object.originalMethods[key];
    }
  }
);

describe("defineDisposable", () => {
  it("calls cleanup", () => {
    let cleanedUp = false;
    const createDisposable = defineDisposable(
      () => {
        return {};
      },
      () => {
        cleanedUp = true;
      }
    );
    {
      using x = createDisposable();
    }
    expect(cleanedUp).toBe(true);
  });
});

describe("spyOnConsole", () => {
  test("intercepts calls to `console.log` and `console.info`", () => {
    using mockedConsole = spyOnConsole();
    console.log("hello");
    console.info("world");
    expect(mockedConsole.log).toEqual([["hello"]]);
    expect(mockedConsole.info).toEqual([["world"]]);
  });

  test("restores the original `console` methods", () => {
    const originalLog = console.log;
    const originalWarn = console.warn;
    const originalError = console.error;
    const originalDebug = console.debug;
    const originalInfo = console.info;
    {
      using _x = spyOnConsole();
      expect(console.log).not.toBe(originalLog);
      expect(console.warn).not.toBe(originalWarn);
      expect(console.error).not.toBe(originalError);
      expect(console.debug).not.toBe(originalDebug);
      expect(console.info).not.toBe(originalInfo);
    }
    expect(console.log).toBe(originalLog);
    expect(console.warn).toBe(originalWarn);
    expect(console.error).toBe(originalError);
    expect(console.debug).toBe(originalDebug);
    expect(console.info).toBe(originalInfo);
  });
});
