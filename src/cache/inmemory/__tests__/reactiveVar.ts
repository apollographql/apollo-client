import { makeVar } from "../reactiveVars";

describe("reactiveVar", () => {
  it("should trigger onNextChange only once after a change", function () {
    const rv = makeVar(1);
    const spy = jest.fn();

    rv.onNextChange(spy);

    rv(2);
    rv(3);

    expect(rv()).toBe(3);
    expect(spy).toBeCalledTimes(1);
  });

  it("should not trigger onNextChange if the listener is removed first", function () {
    const rv = makeVar(1);
    const spy = jest.fn();

    const mute = rv.onNextChange(spy);
    mute();

    rv(2);

    expect(rv()).toBe(2);
    expect(spy).not.toBeCalled();
  });

  it("should trigger onChange for every change", function () {
    const rv = makeVar(1);
    const spy = jest.fn();

    rv.onChange(spy);

    rv(2);
    rv(3);

    expect(rv()).toBe(3);
    expect(spy).toBeCalledTimes(2);
  });

  it("should trigger onChange for every change", function () {
    const rv = makeVar(1);
    const spy = jest.fn();
    const onceSpy = jest.fn();

    const mute = rv.onChange(spy);
    rv.onNextChange(onceSpy);
    mute();

    rv(2);

    expect(rv()).toBe(2);
    expect(spy).not.toBeCalled();
    expect(onceSpy).toBeCalledTimes(1);
  });
});
