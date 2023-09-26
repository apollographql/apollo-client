import { Observable } from "../../../utilities";
import { ObservableTaker } from "../ObservableTaker";

it("allows to step through an observable until completion", async () => {
  const taker = new ObservableTaker(
    new Observable<number>((observer) => {
      observer.next(1);
      observer.next(2);
      observer.next(3);
      observer.complete();
    })
  );
  await expect(taker.takeNext()).resolves.toBe(1);
  await expect(taker.takeNext()).resolves.toBe(2);
  await expect(taker.takeNext()).resolves.toBe(3);
  await expect(taker.takeComplete()).resolves.toBeUndefined();
});

it("allows to step through an observable until error", async () => {
  const taker = new ObservableTaker(
    new Observable<number>((observer) => {
      observer.next(1);
      observer.next(2);
      observer.next(3);
      observer.error(new Error("expected"));
    })
  );
  await expect(taker.takeNext()).resolves.toBe(1);
  await expect(taker.takeNext()).resolves.toBe(2);
  await expect(taker.takeNext()).resolves.toBe(3);
  await expect(taker.takeError()).resolves.toEqual(expect.any(Error));
});

it("will time out if no more value is omitted", async () => {
  const taker = new ObservableTaker(
    new Observable<number>((observer) => {
      observer.next(1);
      observer.next(2);
    })
  );
  await expect(taker.takeNext()).resolves.toBe(1);
  await expect(taker.takeNext()).resolves.toBe(2);
  await expect(taker.takeNext()).rejects.toEqual(expect.any(Error));
});

it.each([
  ["takeNext", "complete"],
  ["takeNext", "error"],
  ["takeError", "complete"],
  ["takeError", "next"],
  ["takeComplete", "next"],
  ["takeComplete", "error"],
])("errors when %s receives %s instead", async (expected, gotten) => {
  const taker = new ObservableTaker(
    new Observable<number>((observer) => {
      observer.next(1);
      observer.next(2);
      // @ts-ignore
      observer[gotten](3);
    })
  );
  await expect(taker.takeNext()).resolves.toBe(1);
  await expect(taker.takeNext()).resolves.toBe(2);
  // @ts-ignore
  await expect(taker[expected]()).rejects.toEqual(expect.any(Error));
});

it.each([
  ["takeNext", "next"],
  ["takeError", "error"],
  ["takeComplete", "complete"],
])("succeeds when %s, receives %s", async (expected, gotten) => {
  const taker = new ObservableTaker(
    new Observable<number>((observer) => {
      observer.next(1);
      observer.next(2);
      // @ts-ignore
      observer[gotten](3);
    })
  );
  await expect(taker.takeNext()).resolves.toBe(1);
  await expect(taker.takeNext()).resolves.toBe(2);
  // @ts-ignore this should just not throw
  await taker[expected]();
});
