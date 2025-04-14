import { CombinedProtocolErrors } from "@apollo/client/errors";

const defaultFormatMessage = CombinedProtocolErrors.formatMessage;

afterEach(() => {
  CombinedProtocolErrors.formatMessage = defaultFormatMessage;
});

test("uses default message format", () => {
  const error = new CombinedProtocolErrors([{ message: "Could not connect" }]);

  expect(error.message).toMatchInlineSnapshot(`"Could not connect"`);

  const multipleErrors = new CombinedProtocolErrors([
    { message: "Username already in use" },
    { message: "Password doesn't match" },
  ]);

  expect(multipleErrors.message).toMatchInlineSnapshot(`
"Username already in use
Password doesn't match"
`);
});

test("adds default message for empty error messages", () => {
  const error = new CombinedProtocolErrors([{ message: "" }]);

  expect(error.message).toMatchInlineSnapshot(`"Error message not found."`);

  const multipleErrors = new CombinedProtocolErrors([
    { message: "Username already in use" },
    { message: "" },
  ]);

  expect(multipleErrors.message).toMatchInlineSnapshot(`
"Username already in use
Error message not found."
`);
});

test("allows message formatter to be overwritten", () => {
  const errors = [{ message: "Email already taken" }];

  {
    const formatMessage = jest.fn(() => "Errors happened");
    CombinedProtocolErrors.formatMessage = formatMessage;

    const error = new CombinedProtocolErrors(errors);

    expect(error.message).toBe("Errors happened");
    expect(formatMessage).toHaveBeenCalledWith(errors, {
      defaultFormatMessage: expect.any(Function),
    });
  }

  {
    const formatMessage = jest.fn(() => "Oops. Something went wrong");
    CombinedProtocolErrors.formatMessage = formatMessage;

    const error = new CombinedProtocolErrors(errors);

    expect(error.message).toBe("Oops. Something went wrong");
    expect(formatMessage).toHaveBeenCalledWith(errors, {
      defaultFormatMessage: expect.any(Function),
    });
  }
});

test("can use default formatter from options", () => {
  CombinedProtocolErrors.formatMessage = (_, { defaultFormatMessage }) =>
    `Overwritten error message:\n ${defaultFormatMessage()}`;

  const error = new CombinedProtocolErrors([
    { message: "Email already taken" },
  ]);

  expect(error.message).toMatchInlineSnapshot(`
"Overwritten error message:
 Email already taken"
`);

  const multipleErrors = new CombinedProtocolErrors([
    { message: "Username already in use" },
    { message: "Password doesn't match" },
  ]);

  expect(multipleErrors.message).toMatchInlineSnapshot(`
"Overwritten error message:
 Username already in use
Password doesn't match"
`);
});
