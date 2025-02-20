import { firstValueFrom } from "rxjs";
import { fromPromise } from "../fromPromise";

describe("fromPromise", () => {
  const data = {
    data: {
      hello: "world",
    },
  };
  const error = new Error("I always error");

  it("return next call as Promise resolution", () => {
    const observable = fromPromise(Promise.resolve(data));
    return firstValueFrom(observable).then((result) =>
      expect(data).toEqual(result)
    );
  });

  it("return Promise rejection as error call", () => {
    const observable = fromPromise(Promise.reject(error));
    return firstValueFrom(observable)
      .then(() => {
        throw "should not have thrown";
      })
      .catch((actualError) => expect(error).toEqual(actualError));
  });
});
