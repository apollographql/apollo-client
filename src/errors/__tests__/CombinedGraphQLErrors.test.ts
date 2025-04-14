import type { FetchResult } from "@apollo/client";
import { CombinedGraphQLErrors } from "@apollo/client/errors";

const defaultFormatMessage = CombinedGraphQLErrors.formatMessage;

afterEach(() => {
  CombinedGraphQLErrors.formatMessage = defaultFormatMessage;
});

test("uses default message format", () => {
  const error = new CombinedGraphQLErrors({
    errors: [{ message: "Email already taken" }],
  });

  expect(error.message).toMatchInlineSnapshot(`"Email already taken"`);

  const multipleErrors = new CombinedGraphQLErrors({
    errors: [
      { message: "Username already in use" },
      { message: "Password doesn't match" },
    ],
  });

  expect(multipleErrors.message).toMatchInlineSnapshot(`
"Username already in use
Password doesn't match"
`);
});

test("adds default message for empty error messages", () => {
  const error = new CombinedGraphQLErrors({
    errors: [{ message: "" }],
  });

  expect(error.message).toMatchInlineSnapshot(`"Error message not found."`);

  const multipleErrors = new CombinedGraphQLErrors({
    errors: [{ message: "Username already in use" }, { message: "" }],
  });

  expect(multipleErrors.message).toMatchInlineSnapshot(`
"Username already in use
Error message not found."
`);
});

test("allows message formatter to be overwritten", () => {
  const errors = [{ message: "Email already taken" }];
  const result: FetchResult = { data: { registerUser: null }, errors };

  {
    const formatMessage = jest.fn(() => "Errors happened");
    CombinedGraphQLErrors.formatMessage = formatMessage;

    const error = new CombinedGraphQLErrors(result);

    expect(error.message).toBe("Errors happened");
    expect(formatMessage).toHaveBeenCalledWith(errors, {
      defaultFormatMessage: expect.any(Function),
      result,
    });
  }

  {
    const formatMessage = jest.fn(() => "Oops. Something went wrong");
    CombinedGraphQLErrors.formatMessage = formatMessage;

    const error = new CombinedGraphQLErrors(result);

    expect(error.message).toBe("Oops. Something went wrong");
    expect(formatMessage).toHaveBeenCalledWith(errors, {
      defaultFormatMessage: expect.any(Function),
      result,
    });
  }
});

test("can use default formatter from options", () => {
  CombinedGraphQLErrors.formatMessage = (_, { defaultFormatMessage }) =>
    `Overwritten error message:\n ${defaultFormatMessage()}`;

  const error = new CombinedGraphQLErrors({
    errors: [{ message: "Email already taken" }],
  });

  expect(error.message).toMatchInlineSnapshot(`
"Overwritten error message:
 Email already taken"
`);

  const multipleErrors = new CombinedGraphQLErrors({
    errors: [
      { message: "Username already in use" },
      { message: "Password doesn't match" },
    ],
  });

  expect(multipleErrors.message).toMatchInlineSnapshot(`
"Overwritten error message:
 Username already in use
Password doesn't match"
`);
});
