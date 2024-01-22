import { Observable } from "../../../utilities/observables/Observable";
import { itAsync } from "../../../testing";
import { toPromise } from "../toPromise";
import { fromError } from "../fromError";

describe("toPromise", () => {
  const data = {
    data: {
      hello: "world",
    },
  };
  const error = new Error("I always error");

  it("return next call as Promise resolution", () => {
    return toPromise(Observable.of(data)).then((result) =>
      expect(data).toEqual(result)
    );
  });

  it("return error call as Promise rejection", () => {
    return toPromise(fromError(error))
      .then(() => {
        throw "should not have thrown";
      })
      .catch((actualError) => expect(error).toEqual(actualError));
  });

  describe("warnings", () => {
    const spy = jest.fn();
    let _warn: (message?: any, ...originalParams: any[]) => void;

    beforeEach(() => {
      _warn = console.warn;
      console.warn = spy;
    });

    afterEach(() => {
      console.warn = _warn;
    });

    itAsync("return error call as Promise rejection", (resolve, reject) => {
      toPromise(Observable.of(data, data)).then((result) => {
        expect(data).toEqual(result);
        expect(spy).toHaveBeenCalled();
        resolve();
      });
    });
  });
});
