import { Observable } from "../Observable";
import { Concast } from "../Concast";
import { map, of } from "rxjs";

function toArrayPromise<T>(observable: Observable<T>): Promise<T[]> {
  return new Promise<T[]>((resolve, reject) => {
    const values: T[] = [];
    observable.subscribe({
      next(value) {
        values.push(value);
      },
      error: reject,
      complete() {
        resolve(values);
      },
    });
  });
}

describe("Observable subclassing", () => {
  it("Symbol.species is defined for Concast subclass", () => {
    const concast = new Concast([
      of(1, 2, 3),
      of(4, 5),
    ]);
    expect(concast).toBeInstanceOf(Concast);

    const mapped = concast.pipe(map(n => n * 2));
    expect(mapped).toBeInstanceOf(Observable);
    expect(mapped).not.toBeInstanceOf(Concast);

    return toArrayPromise(mapped).then(doubles => {
      expect(doubles).toEqual([2, 4, 6, 8, 10]);
    });
  });
});
