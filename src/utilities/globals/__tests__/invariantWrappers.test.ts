import { loadErrorMessageHandler } from "../../../dev";
import { spyOnConsole, withCleanup } from "../../../testing/internal";
import {
  ApolloErrorMessageHandler,
  InvariantError,
  invariant,
} from "../invariantWrappers";

function disableErrorMessageHandler() {
  const original = window[ApolloErrorMessageHandler];
  delete window[ApolloErrorMessageHandler];
  return withCleanup({ original }, ({ original }) => {
    window[ApolloErrorMessageHandler] = original;
  });
}

function mockErrorMessageHandler() {
  const original = window[ApolloErrorMessageHandler];
  delete window[ApolloErrorMessageHandler];

  loadErrorMessageHandler({
    5: { file: "foo", message: "Replacing %s, %d, %f, %o" },
  });

  return withCleanup({ original }, ({ original }) => {
    window[ApolloErrorMessageHandler] = original;
  });
}

test("base invariant(false, 5, ...), no handlers", () => {
  using _ = disableErrorMessageHandler();
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

test("base invariant(false, 5, ...), handlers in place", () => {
  using _ = mockErrorMessageHandler();
  expect(() => {
    invariant(false, 5, "string", 1, 1.1, { a: 1 });
  }).toThrow(new InvariantError('Replacing string, 1, 1.1, {\n  "a": 1\n}'));
});

test("base invariant(false, undefined), no handlers", () => {
  using _ = disableErrorMessageHandler();
  expect(() => {
    invariant(false);
  }).toThrow(new InvariantError("Invariant Violation"));
});

test("base invariant(false, undefined), handlers in place", () => {
  using _ = mockErrorMessageHandler();
  expect(() => {
    invariant(false);
  }).toThrow(new InvariantError("Invariant Violation"));
});

test("invariant.log(5, ...), no handlers", () => {
  using _ = disableErrorMessageHandler();
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

test("invariant.log(5, ...), with handlers", () => {
  using _ = mockErrorMessageHandler();
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

test("base invariant(false, 6, ...), raises fallback", () => {
  using _ = mockErrorMessageHandler();
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
