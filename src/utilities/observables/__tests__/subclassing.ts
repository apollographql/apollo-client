import { Observable } from "../Observable";
import { Concast } from "../Concast";

describe("Observable subclassing", () => {
  it("Symbol.species is defined for Concast subclass", () => {
    const concast = new Concast([
      Observable.of(1, 2, 3),
      Observable.of(4, 5),
    ]);
    expect(concast).toBeInstanceOf(Concast);

    const mapped = concast.map(n => n * 2);
    expect(mapped).toBeInstanceOf(Observable);
    expect(mapped).not.toBeInstanceOf(Concast);

    return new Promise<number[]>((resolve, reject) => {
      const doubles: number[] = [];
      mapped.subscribe({
        next(n) {
          doubles.push(n);
        },
        error: reject,
        complete() {
          resolve(doubles);
        }
      });
    }).then(doubles => {
      expect(doubles).toEqual([2, 4, 6, 8, 10]);
    });
  });
});
