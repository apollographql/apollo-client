import { Scalar } from "@apollo/client/cache";

export const dateTimeScalar = new Scalar<string, Date>({
  serialize: (value) => value.toISOString(),
  parse: (value) => new Date(value),
});

// Like DateTime, but useful when needing to ensure the result isn't the same as
// calling toISOString, like JSON.stringify would do.
export const dateScalar = new Scalar<string, Date>({
  serialize: (date) =>
    `${date.getFullYear()}-${(date.getMonth() + 1)
      .toString()
      .padStart(2, "0")}-${date.getDate().toString().padStart(2, "0")}`,
  parse: (value) => {
    const [year, month, day] = value.split("-").map(Number);
    return new Date(year, month - 1, day);
  },
});

// Used for testing primitive -> primitive tests
export const priceScalar = new Scalar<number, string>({
  serialize: (dollars) => Math.round(parseFloat(dollars) * 100),
  parse: (cents) => `${(cents / 100).toFixed(2)}`,
  is: (value) => typeof value === "string",
});

// Used for testing object-based scalar
export const jsonObjectScalar = new Scalar<
  Record<string, unknown>,
  Map<string, unknown>
>({
  serialize: (value) => Object.fromEntries(value),
  parse: (value) => new Map(Object.entries(value)),
  is: (value) => value instanceof Map,
});

// Used to test scalar that is an array itself
export const dateTimeRangeScalar = new Scalar<
  [string, string],
  { start: Date; end: Date }
>({
  serialize: (value) => [value.start.toISOString(), value.end.toISOString()],
  parse: (value) => ({
    start: new Date(value[0]),
    end: new Date(value[1]),
  }),
  is: (value) => !Array.isArray(value),
});
