import { gql } from "@apollo/client";
import { InMemoryCache, Scalar } from "@apollo/client/cache";

const dateTimeScalar = new Scalar<string, Date>({
  serialize: (value) => value.toISOString(),
  parse: (value) => new Date(value),
});

test("serializes a custom scalar variable", () => {
  const cache = new InMemoryCache({
    scalars: {
      DateTime: dateTimeScalar,
    },
  });

  const mutation = gql`
    mutation CreateEvent($startsAt: DateTime!) {
      createEvent(startsAt: $startsAt) {
        id
      }
    }
  `;

  expect(
    cache.serializeVariables(mutation, {
      startsAt: new Date("2026-01-01T00:00:00.000Z"),
    })
  ).toStrictEqualTyped({ startsAt: "2026-01-01T00:00:00.000Z" });
});

test("leaves an already serialized custom scalar variable unchanged", () => {
  const cache = new InMemoryCache({
    scalars: {
      DateTime: dateTimeScalar,
    },
  });

  const mutation = gql`
    mutation CreateEvent($startsAt: DateTime!) {
      createEvent(startsAt: $startsAt) {
        id
      }
    }
  `;

  expect(
    cache.serializeVariables(mutation, { startsAt: "2026-01-01T00:00:00.000Z" })
  ).toStrictEqualTyped({
    startsAt: "2026-01-01T00:00:00.000Z",
  });
});
