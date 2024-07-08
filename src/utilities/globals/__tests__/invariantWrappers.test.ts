import { spyOnConsole } from "../../../testing/internal";
import {
  ApolloErrorMessageHandler,
  InvariantError,
  invariant,
} from "../invariantWrappers";

function withDev() {
  const originalErrorMessageHandler = window[ApolloErrorMessageHandler];
  window[ApolloErrorMessageHandler] = undefined;
  let dev: typeof import("../../../dev");
  let restore = () => {};
  // we're running the test inside of `jest.isolateModulesAsync` to avoid
  // the test overriding the module-level state of the `dev` module
  const cleanupFinished = jest.isolateModulesAsync(
    () =>
      new Promise<void>((resolve) => {
        dev = require("../../../dev");
        restore = resolve;
      })
  );
  // replicate the code of `src/config/jest/setup.ts`
  dev!.loadErrorMessageHandler();
  return {
    ...dev!,
    async [Symbol.asyncDispose]() {
      restore();
      await cleanupFinished;
      window[ApolloErrorMessageHandler] = originalErrorMessageHandler;
    },
  };
}

function disableErrorMessageHandler() {
  // eslint-disable-next-line local-rules/require-using-disposable
  const dev = withDev();
  delete window[ApolloErrorMessageHandler];
  return dev;
}

function mockErrorMessageHandler() {
  // eslint-disable-next-line local-rules/require-using-disposable
  const dev = withDev();
  delete window[ApolloErrorMessageHandler];

  dev.loadErrorMessageHandler({
    5: { file: "foo", message: "Replacing %s, %d, %f, %o" },
  });
  return dev;
}

test("base invariant(false, 5, ...), no handlers", async () => {
  await using _ = disableErrorMessageHandler();
  expect(() => {
    invariant(false, 5, "string", 1, 1.1, { a: 1 });
  }).toThrow(
    new InvariantError(
      "An error occurred! For more details, see the full error text at https://go.apollo.dev/c/err#" +
        encodeURIComponent(
          JSON.stringify({
            version: "local",
            message: 5,
            args: [
              "string",
              "1",
              "1.1",
              JSON.stringify({ a: 1 }, undefined, 2),
            ],
          })
        )
    )
  );
});

test("base invariant(false, 5, ...), handlers in place", async () => {
  await using _ = mockErrorMessageHandler();
  expect(() => {
    invariant(false, 5, "string", 1, 1.1, { a: 1 });
  }).toThrow(new InvariantError('Replacing string, 1, 1.1, {\n  "a": 1\n}'));
});

test("base invariant(false, 5, ...), custom handler gets passed arguments", async () => {
  await using dev = disableErrorMessageHandler();

  const handler = jest.fn(() => "");
  dev.setErrorMessageHandler(handler);

  try {
    invariant(false, 5, "string", 1, 1.1, { a: 1 });
  } catch {}

  expect(handler).toHaveBeenCalledWith(5, [
    "string",
    "1",
    "1.1",
    '{\n  "a": 1\n}',
  ]);
});

test("base invariant(false, undefined), no handlers", async () => {
  await using _ = disableErrorMessageHandler();
  expect(() => {
    invariant(false);
  }).toThrow(new InvariantError("Invariant Violation"));
});

test("base invariant(false, undefined), handlers in place", async () => {
  await using _ = mockErrorMessageHandler();
  expect(() => {
    invariant(false);
  }).toThrow(new InvariantError("Invariant Violation"));
});

test("invariant.log(5, ...), no handlers", async () => {
  await using _ = disableErrorMessageHandler();
  using consoleSpy = spyOnConsole("log");
  invariant.log(5, "string", 1, 1.1, { a: 1 });
  expect(consoleSpy.log).toHaveBeenCalledWith(
    "An error occurred! For more details, see the full error text at https://go.apollo.dev/c/err#" +
      encodeURIComponent(
        JSON.stringify({
          version: "local",
          message: 5,
          args: ["string", "1", "1.1", JSON.stringify({ a: 1 }, undefined, 2)],
        })
      )
  );
});

test("invariant.log(5, ...), with handlers", async () => {
  await using _ = mockErrorMessageHandler();
  using consoleSpy = spyOnConsole("log");
  invariant.log(5, "string", 1, 1.1, { a: 1 });
  expect(consoleSpy.log).toHaveBeenCalledWith(
    "Replacing %s, %d, %f, %o",
    "string",
    1,
    1.1,
    { a: 1 }
  );
});

test("invariant.log(5, ...), custom handler does not get passed arguments", async () => {
  await using dev = disableErrorMessageHandler();
  using _consoleSpy = spyOnConsole("log");

  const handler = jest.fn(() => "");
  dev.setErrorMessageHandler(handler);

  try {
    invariant.log(5, "string", 1, 1.1, { a: 1 });
  } catch {}

  expect(handler).toHaveBeenCalledWith(5, []);
});

test("base invariant(false, 6, ...), raises fallback", async () => {
  await using _ = mockErrorMessageHandler();
  expect(() => {
    invariant(false, 6, "hello");
  }).toThrow(
    new InvariantError(
      "An error occurred! For more details, see the full error text at https://go.apollo.dev/c/err#" +
        encodeURIComponent(
          JSON.stringify({
            version: "local",
            message: 6,
            args: ["hello"],
          })
        )
    )
  );
});

test("base invariant(false, 6, ...) with non-serializable param", async () => {
  await using _ = mockErrorMessageHandler();

  const obj: any = {};
  obj.self = obj;

  expect(() => {
    invariant(false, 6, obj);
  }).toThrow(
    new InvariantError(
      "An error occurred! For more details, see the full error text at https://go.apollo.dev/c/err#" +
        encodeURIComponent(
          JSON.stringify({
            version: "local",
            message: 6,
            args: ["<non-serializable>"],
          })
        )
    )
  );
});
