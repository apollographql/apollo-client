function wrapTestFunction(
  fn: (...args: any[]) => any,
  consoleMethodName: "log" | "warn" | "error",
) {
  return function () {
    const args = arguments;
    const spy = jest.spyOn(console, consoleMethodName);
    spy.mockImplementation(() => {});
    return new Promise(resolve => {
      resolve(fn?.apply(this, args));
    }).finally(() => {
      expect(spy).toMatchSnapshot();
      spy.mockReset();
    });
  };
}

export function withErrorSpy<
  TArgs extends any[],
  TResult,
>(
  it: (...args: TArgs) => TResult,
  ...args: TArgs
) {
  args[1] = wrapTestFunction(args[1], "error");
  return it(...args);
}

export function withWarningSpy<
  TArgs extends any[],
  TResult,
>(
  it: (...args: TArgs) => TResult,
  ...args: TArgs
) {
  args[1] = wrapTestFunction(args[1], "warn");
  return it(...args);
}

export function withLogSpy<
  TArgs extends any[],
  TResult,
>(
  it: (...args: TArgs) => TResult,
  ...args: TArgs
) {
  args[1] = wrapTestFunction(args[1], "log");
  return it(...args);
}
