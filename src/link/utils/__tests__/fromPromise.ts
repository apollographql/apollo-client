import { fromPromise } from "../fromPromise";
import { toPromise } from "../toPromise";

describe("fromPromise", () => {
  const data = {
    data: {
      hello: "world",
    },
  };
  const error = new Error("I always error");

  it("return next call as Promise resolution", () => {
    const observable = fromPromise(Promise.resolve(data));
    return toPromise(observable).then((result) => expect(data).toEqual(result));
  });

  it("return Promise rejection as error call", () => {
    const observable = fromPromise(Promise.reject(error));
    return toPromise(observable)
      .then(() => {
        throw "should not have thrown";
      })
      .catch((actualError) => expect(error).toEqual(actualError));
  });
});
