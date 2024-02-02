function wrapTestFunction(
  fn: (...args: any[]) => any,
  consoleMethodName: "log" | "warn" | "error"
) {
  return function (this: any, ...args: any[]) {
    const spy = jest.spyOn(console, consoleMethodName);
    spy.mockImplementation(() => {});
    return new Promise((resolve) => {
      resolve(fn?.apply(this, args));
    }).finally(() => {
      expect(spy).toMatchSnapshot();
      spy.mockReset();
    });
  };
}

/** @deprecated This method will be removed in the next major version of Apollo Client */
export function withErrorSpy<TArgs extends any[], TResult>(
  it: (...args: TArgs) => TResult,
  ...args: TArgs
) {
  args[1] = wrapTestFunction(args[1], "error");
  return it(...args);
}

/** @deprecated This method will be removed in the next major version of Apollo Client */
export function withWarningSpy<TArgs extends any[], TResult>(
  it: (...args: TArgs) => TResult,
  ...args: TArgs
) {
  args[1] = wrapTestFunction(args[1], "warn");
  return it(...args);
}

/** @deprecated This method will be removed in the next major version of Apollo Client */
export function withLogSpy<TArgs extends any[], TResult>(
  it: (...args: TArgs) => TResult,
  ...args: TArgs
) {
  args[1] = wrapTestFunction(args[1], "log");
  return it(...args);
}
