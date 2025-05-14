import { gql } from "@apollo/client";
import { hasDirectives } from "@apollo/client/utilities/internal";

test("should allow searching the ast for a directive", () => {
  const query = gql`
    query Simple {
      field @live
    }
  `;

  expect(hasDirectives(["live"], query)).toBe(true);
  expect(hasDirectives(["defer"], query)).toBe(false);
});

test("works for all operation types", () => {
  const query = gql`
    {
      field @live {
        subField {
          hello @live
        }
      }
    }
  `;

  const mutation = gql`
    mutation Directive {
      mutate {
        field {
          subField {
            hello @live
          }
        }
      }
    }
  `;

  const subscription = gql`
    subscription LiveDirective {
      sub {
        field {
          subField {
            hello @live
          }
        }
      }
    }
  `;

  [query, mutation, subscription].forEach((x) => {
    expect(hasDirectives(["live"], x)).toBe(true);
    expect(hasDirectives(["defer"], x)).toBe(false);
  });
});

test("works for simple fragments", () => {
  const query = gql`
    query Simple {
      ...fieldFragment
    }

    fragment fieldFragment on Field {
      foo @live
    }
  `;
  expect(hasDirectives(["live"], query)).toBe(true);
  expect(hasDirectives(["defer"], query)).toBe(false);
});

test("works for nested fragments", () => {
  const query = gql`
    query Simple {
      ...fieldFragment1
    }

    fragment fieldFragment1 on Field {
      bar {
        baz {
          ...nestedFragment
        }
      }
    }

    fragment nestedFragment on Field {
      foo @live
    }
  `;
  expect(hasDirectives(["live"], query)).toBe(true);
  expect(hasDirectives(["defer"], query)).toBe(false);
});
