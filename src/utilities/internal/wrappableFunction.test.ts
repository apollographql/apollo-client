import { createWrappableFunction, wrapFunction } from "./wrappableFunction";

console.log(createWrappableFunction.toString());

function original(this: any, ...args: any[]) {
  return (
    (this ? this.toString() + "." : "") +
    "original(" +
    args.map((x) => JSON.stringify(x)).join(", ") +
    ")"
  );
}

describe("createWrappableFunction", () => {
  test("a wrappable function keeps the original functionality", () => {
    const myFn = createWrappableFunction(original);
    expect(myFn()).toBe("original()");
  });

  // this works in browsers and node, but for some reason not in jest
  test.skip("a wrappable function keeps the original name", () => {
    const myFn = createWrappableFunction(original);
    expect(original.name).toBe("original");
    expect(myFn.name).toBe("original");
  });

  // this is impossible,so let's document that
  test("a wrappable function does not keep the original `length`", () => {
    function withOneArg(x: number) {}

    const myFn = createWrappableFunction(withOneArg);
    expect(withOneArg.length).toBe(1);
    expect(myFn.length).toBe(0);
  });

  test("a wrappable function forwards arguments to the implementation", () => {
    const myFn = createWrappableFunction(original);
    expect(myFn(1, "test")).toBe('original(1, "test")');
  });

  test("a wrappable function forwards `this` to the implementation", () => {
    const myFn = createWrappableFunction(original);
    expect(myFn.apply("ThisIsMe")).toBe("ThisIsMe.original()");
  });
});

describe("wrapFunction", () => {
  test("can replace the original implementation", () => {
    const myFn = createWrappableFunction(original);
    wrapFunction(myFn, () => () => "replaced");
    expect(myFn()).toBe("replaced");
  });

  test("can wrap the original implementation", () => {
    const myFn = createWrappableFunction(original);
    wrapFunction(myFn, (orig) => () => orig() + " wrapped");
    expect(myFn()).toBe("original() wrapped");
  });

  test("replaces the last wrapper", () => {
    const myFn = createWrappableFunction(original);
    wrapFunction(myFn, () => () => "wrapped");
    expect(myFn()).toBe("wrapped");
    wrapFunction(myFn, () => () => "replaced the last wrapper");
    expect(myFn()).toBe("replaced the last wrapper");
  });

  test("can wrap the last wrapper", () => {
    const myFn = createWrappableFunction(original);
    wrapFunction(myFn, (orig) => () => orig() + " wrapped");
    wrapFunction(
      myFn,
      (_, lastWrapper) => () => lastWrapper() + " wrapped again"
    );
    expect(myFn()).toBe("original() wrapped wrapped again");
  });

  test("arguments are passed from the method call to the wrapper", () => {
    const myFn = createWrappableFunction(original);
    wrapFunction(
      myFn,
      () =>
        (...args) =>
          args.map((x) => JSON.stringify(x)).join(", ")
    );
    expect(myFn(1, "test")).toBe('1, "test"');
  });

  test("the wrapper can pass arguments to the original implementation", () => {
    const myFn = createWrappableFunction(original);
    wrapFunction(myFn, (orig) => () => orig("arg from wrapper"));
    expect(myFn()).toBe('original("arg from wrapper")');
  });

  test("this is passed from the method call to the wrapper", () => {
    const myFn = createWrappableFunction(original);
    wrapFunction(
      myFn,
      () =>
        function (this: any) {
          return this.toString() + ".wrapper";
        }
    );
    expect(myFn.apply("ThisIsMe")).toBe("ThisIsMe.wrapper");
  });

  test("the wrapper can pass a value for `this` to the original implementation", () => {
    const myFn = createWrappableFunction(original);
    wrapFunction(myFn, (orig) => () => {
      return orig.apply("ThisFromWrapper");
    });
    expect(myFn()).toBe("ThisFromWrapper.original()");
  });
});
