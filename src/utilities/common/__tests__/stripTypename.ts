import { stripTypename } from "../stripTypename";

test("omits __typename from a shallow object", () => {
  expect(
    stripTypename({ __typename: "Person", firstName: "Foo", lastName: "Bar" })
  ).toEqual({ firstName: "Foo", lastName: "Bar" });
});

test("omits __typename from arbitrarily nested object", () => {
  expect(
    stripTypename({
      __typename: "Profile",
      user: {
        __typename: "User",
        firstName: "Foo",
        lastName: "Bar",
        location: {
          __typename: "Location",
          city: "Denver",
          country: "USA",
        },
      },
    })
  ).toEqual({
    user: {
      firstName: "Foo",
      lastName: "Bar",
      location: {
        city: "Denver",
        country: "USA",
      },
    },
  });
});

test("omits the __typename from arrays", () => {
  expect(
    stripTypename([
      { __typename: "Todo", name: "Take out trash" },
      { __typename: "Todo", name: "Clean room" },
    ])
  ).toEqual([{ name: "Take out trash" }, { name: "Clean room" }]);
});

test("omits __typename from arbitrarily nested arrays", () => {
  expect(
    stripTypename([
      [{ __typename: "Foo", foo: "foo" }],
      [{ __typename: "Bar", bar: "bar" }, [{ __typename: "Baz", baz: "baz" }]],
    ])
  ).toEqual([[{ foo: "foo" }], [{ bar: "bar" }, [{ baz: "baz" }]]]);
});

test("returns primitives unchanged", () => {
  expect(stripTypename("a")).toBe("a");
  expect(stripTypename(1)).toBe(1);
  expect(stripTypename(true)).toBe(true);
  expect(stripTypename(null)).toBe(null);
  expect(stripTypename(undefined)).toBe(undefined);
});
