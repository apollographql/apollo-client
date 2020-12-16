import { ObjectCanon } from "../object-canon";

describe("ObjectCanon", () => {
  it("can canonicalize objects and arrays", () => {
    const canon = new ObjectCanon;

    const obj1 = {
      a: [1, 2],
      b: {
        c: [{
          d: "dee",
          e: "ee",
        }, "f"],
        g: "gee",
      },
    };

    const obj2 = {
      b: {
        g: "gee",
        c: [{
          e: "ee",
          d: "dee",
        }, "f"],
      },
      a: [1, 2],
    };

    expect(obj1).toEqual(obj2);
    expect(obj1).not.toBe(obj2);

    const c1 = canon.admit(obj1);
    const c2 = canon.admit(obj2);

    expect(c1).toBe(c2);
    expect(c1).toEqual(obj1);
    expect(c1).toEqual(obj2);
    expect(c2).toEqual(obj1);
    expect(c2).toEqual(obj2);
    expect(c1).not.toBe(obj1);
    expect(c1).not.toBe(obj2);
    expect(c2).not.toBe(obj1);
    expect(c2).not.toBe(obj2);

    expect(canon.admit(c1)).toBe(c1);
    expect(canon.admit(c2)).toBe(c2);
  });

  it("preserves custom prototypes", () => {
    const canon = new ObjectCanon;

    class Custom {
      constructor(public value: any) {}
      getValue() { return this.value }
    }

    const customs = [
      new Custom("oyez"),
      new Custom(1234),
      new Custom(true),
    ];

    const admitted = canon.admit(customs);
    expect(admitted).not.toBe(customs);
    expect(admitted).toEqual(customs);

    function check(i: number) {
      expect(admitted[i]).toEqual(customs[i]);
      expect(admitted[i]).not.toBe(customs[i]);
      expect(admitted[i].getValue()).toBe(customs[i].getValue());
      expect(Object.getPrototypeOf(admitted[i])).toBe(Custom.prototype);
      expect(admitted[i]).toBeInstanceOf(Custom);
    }
    check(0);
    check(1);
    check(2);

    expect(canon.admit(customs)).toBe(admitted);
  });

  it("unwraps Pass wrappers as-is", () => {
    const canon = new ObjectCanon;

    const cd = {
      c: "see",
      d: "dee",
    };

    const obj = {
      a: cd,
      b: canon.pass(cd),
      e: cd,
    };

    function check() {
      const admitted = canon.admit(obj);
      expect(admitted).not.toBe(obj);
      expect(admitted.b).toBe(cd);
      expect(admitted.e).toEqual(cd);
      expect(admitted.e).not.toBe(cd);
      expect(admitted.e).toEqual(admitted.b);
      expect(admitted.e).not.toBe(admitted.b);
      expect(admitted.e).toBe(admitted.a);
    }
    check();
    check();
  });
});
