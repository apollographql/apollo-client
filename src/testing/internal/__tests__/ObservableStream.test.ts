import { Observable } from "../../../utilities";
import { ObservableStream } from "../ObservableStream";

it("allows to step through an observable until completion", async () => {
  const stream = new ObservableStream(
    new Observable<number>((observer) => {
      observer.next(1);
      observer.next(2);
      observer.next(3);
      observer.complete();
    })
  );
  await expect(stream.takeNext()).resolves.toBe(1);
  await expect(stream.takeNext()).resolves.toBe(2);
  await expect(stream.takeNext()).resolves.toBe(3);
  await expect(stream.takeComplete()).resolves.toBeUndefined();
});

it("allows to step through an observable until error", async () => {
  const stream = new ObservableStream(
    new Observable<number>((observer) => {
      observer.next(1);
      observer.next(2);
      observer.next(3);
      observer.error(new Error("expected"));
    })
  );
  await expect(stream.takeNext()).resolves.toBe(1);
  await expect(stream.takeNext()).resolves.toBe(2);
  await expect(stream.takeNext()).resolves.toBe(3);
  await expect(stream.takeError()).resolves.toEqual(expect.any(Error));
});

it("will time out if no more value is omitted", async () => {
  const stream = new ObservableStream(
    new Observable<number>((observer) => {
      observer.next(1);
      observer.next(2);
    })
  );
  await expect(stream.takeNext()).resolves.toBe(1);
  await expect(stream.takeNext()).resolves.toBe(2);
  await expect(stream.takeNext()).rejects.toEqual(expect.any(Error));
});

it.each([
  ["takeNext", "complete"],
  ["takeNext", "error"],
  ["takeError", "complete"],
  ["takeError", "next"],
  ["takeComplete", "next"],
  ["takeComplete", "error"],
])("errors when %s receives %s instead", async (expected, gotten) => {
  const stream = new ObservableStream(
    new Observable<number>((observer) => {
      observer.next(1);
      observer.next(2);
      // @ts-ignore
      observer[gotten](3);
    })
  );
  await expect(stream.takeNext()).resolves.toBe(1);
  await expect(stream.takeNext()).resolves.toBe(2);
  // @ts-ignore
  await expect(stream[expected]()).rejects.toEqual(expect.any(Error));
});

it.each([
  ["takeNext", "next"],
  ["takeError", "error"],
  ["takeComplete", "complete"],
])("succeeds when %s, receives %s", async (expected, gotten) => {
  const stream = new ObservableStream(
    new Observable<number>((observer) => {
      observer.next(1);
      observer.next(2);
      // @ts-ignore
      observer[gotten](3);
    })
  );
  await expect(stream.takeNext()).resolves.toBe(1);
  await expect(stream.takeNext()).resolves.toBe(2);
  // @ts-ignore this should just not throw
  await stream[expected]();
});
