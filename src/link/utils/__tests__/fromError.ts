import { toPromise } from "../toPromise";
import { fromError } from "../fromError";

describe("fromError", () => {
  it("acts as error call", () => {
    const error = new Error("I always error");
    const observable = fromError(error);
    return toPromise(observable)
      .then(() => {
        throw "should not have thrown";
      })
      .catch((actualError) => expect(error).toEqual(actualError));
  });
});
