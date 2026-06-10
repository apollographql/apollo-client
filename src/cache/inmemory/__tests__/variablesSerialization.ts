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

test("serializes custom scalar variables whose parsed type is a primitive", () => {
  const cache = new InMemoryCache({
    scalars: {
      Price: priceScalar,
    },
  });

  const mutation = gql`
    mutation PurchaseTicket($price: Price!) {
      purchaseTicket(price: $price) {
        id
      }
    }
  `;

  expect(
    cache.serializeVariables(mutation, { price: "19.99" })
  ).toStrictEqualTyped({
    price: 1999,
  });
});

test("serializes lists and nested lists of custom scalars", () => {
  const cache = new InMemoryCache({
    scalars: {
      DateTime: dateTimeScalar,
    },
  });

  const mutation = gql`
    mutation ScheduleEvents($startsAt: [DateTime], $schedule: [[DateTime!]!]!) {
      scheduleEvents(startsAt: $startsAt, schedule: $schedule) {
        id
      }
    }
  `;

  expect(
    cache.serializeVariables(mutation, {
      startsAt: [new Date("2026-01-01T00:00:00.000Z"), null],
      schedule: [
        [
          new Date("2026-01-02T00:00:00.000Z"),
          new Date("2026-01-03T00:00:00.000Z"),
        ],
      ],
    })
  ).toStrictEqualTyped({
    startsAt: ["2026-01-01T00:00:00.000Z", null],
    schedule: [["2026-01-02T00:00:00.000Z", "2026-01-03T00:00:00.000Z"]],
  });
});
