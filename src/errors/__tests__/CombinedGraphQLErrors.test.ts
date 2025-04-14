import type { FetchResult } from "@apollo/client";
import { CombinedGraphQLErrors } from "@apollo/client/errors";

const defaultFormatMessage = CombinedGraphQLErrors.formatMessage;

afterEach(() => {
  CombinedGraphQLErrors.formatMessage = defaultFormatMessage;
});

test("Uses default message format", () => {
  const error = new CombinedGraphQLErrors({
    errors: [{ message: "Email already taken" }],
  });

  expect(error.message).toMatchInlineSnapshot(`
"The GraphQL server returned with errors:
- Email already taken"
`);

  const multipleErrors = new CombinedGraphQLErrors({
    errors: [
      { message: "Username already in use" },
      { message: "Password doesn't match" },
    ],
  });

  expect(multipleErrors.message).toMatchInlineSnapshot(`
"The GraphQL server returned with errors:
- Username already in use
- Password doesn't match"
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
    expect(formatMessage).toHaveBeenCalledWith(errors, result);
  }

  {
    const formatMessage = jest.fn(() => "Oops. Something went wrong");
    CombinedGraphQLErrors.formatMessage = formatMessage;

    const error = new CombinedGraphQLErrors(result);

    expect(error.message).toBe("Oops. Something went wrong");
    expect(formatMessage).toHaveBeenCalledWith(errors, result);
  }
});
