import { LazyPromise } from "@apollo/client/utilities/internal";

type ExecutorParams = Parameters<LazyPromise.Executor<string>>;

test("LazyPromise behaves like a Promise", async () => {
  const p = new LazyPromise<string>((resolve) => {
    setTimeout(() => {
      resolve("Hello, world!");
    }, 100);
  });
  await expect(p).resolves.toBe("Hello, world!");
});

test("Executor function is called lazily (await)", async () => {
  const executor = jest.fn<void, ExecutorParams>((resolve) =>
    resolve("Hello, world!")
  );
  const p = new LazyPromise<string>(executor);
  expect(executor).not.toHaveBeenCalled();
  const result = await p;
  expect(result).toBe("Hello, world!");
  expect(executor).toHaveBeenCalledTimes(1);
});

test("Executor function is called lazily (then)", (done) => {
  const executor = jest.fn<void, ExecutorParams>((resolve) =>
    resolve("Hello, world!")
  );
  const p = new LazyPromise<string>(executor);
  expect(executor).not.toHaveBeenCalled();
  p.then((result) => {
    expect(result).toBe("Hello, world!");
    expect(executor).toHaveBeenCalledTimes(1);
    done();
  });
});

test("Executor function is called lazily (catch)", (done) => {
  const executor = jest.fn<void, ExecutorParams>((_, reject) =>
    reject("Bad world!")
  );
  const p = new LazyPromise<string>(executor);
  expect(executor).not.toHaveBeenCalled();
  p.catch((reason) => {
    expect(reason).toBe("Bad world!");
    expect(executor).toHaveBeenCalledTimes(1);
    done();
  });
});

test("Executor function is called lazily (finally, resolved)", (done) => {
  const executor = jest.fn<void, ExecutorParams>((resolve) =>
    resolve("Hello, world!")
  );
  const p = new LazyPromise<string>(executor);
  expect(executor).not.toHaveBeenCalled();
  p.finally(() => {
    expect(executor).toHaveBeenCalledTimes(1);
    done();
  });
});

test("Executor function is called lazily (finally, rejected)", (done) => {
  const executor = jest.fn<void, ExecutorParams>((_, reject) =>
    reject("Bad world!")
  );
  const p = new LazyPromise<string>(executor);
  expect(executor).not.toHaveBeenCalled();
  p.finally(() => {
    expect(executor).toHaveBeenCalledTimes(1);
    done();
  }).catch(() => {
    // prevent unhandled rejection
  });
});
