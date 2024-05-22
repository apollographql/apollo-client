import gql from "graphql-tag";

import { itAsync } from "../../../testing";
import { InMemoryCache } from "../inMemoryCache";
import { visit, FragmentDefinitionNode } from "graphql";
import { hasOwn } from "../helpers";

describe("fragment matching", () => {
  it("can match exact types with or without possibleTypes", () => {
    const cacheWithoutPossibleTypes = new InMemoryCache({
      addTypename: true,
    });

    const cacheWithPossibleTypes = new InMemoryCache({
      addTypename: true,
      possibleTypes: {
        Animal: ["Cat", "Dog"],
      },
    });

    const query = gql`
      query AnimalNames {
        animals {
          id
          name
          ...CatDetails
        }
      }
      fragment CatDetails on Cat {
        livesLeft
        killsToday
      }
    `;

    const data = {
      animals: [
        {
          __typename: "Cat",
          id: 1,
          name: "Felix",
          livesLeft: 8,
          killsToday: 2,
        },
        {
          __typename: "Dog",
          id: 2,
          name: "Baxter",
        },
      ],
    };

    cacheWithoutPossibleTypes.writeQuery({ query, data });
    expect(cacheWithoutPossibleTypes.readQuery({ query })).toEqual(data);

    cacheWithPossibleTypes.writeQuery({ query, data });
    expect(cacheWithPossibleTypes.readQuery({ query })).toEqual(data);
  });

  it("can match interface subtypes", () => {
    const cache = new InMemoryCache({
      addTypename: true,
      possibleTypes: {
        Animal: ["Cat", "Dog"],
      },
    });

    const query = gql`
      query BestFriend {
        bestFriend {
          id
          ...AnimalName
        }
      }
      fragment AnimalName on Animal {
        name
      }
    `;

    const data = {
      bestFriend: {
        __typename: "Dog",
        id: 2,
        name: "Beckett",
      },
    };

    cache.writeQuery({ query, data });
    expect(cache.readQuery({ query })).toEqual(data);
  });

  it("can match union member types", () => {
    const cache = new InMemoryCache({
      addTypename: true,
      possibleTypes: {
        Status: ["PASSING", "FAILING", "SKIPPED"],
      },
    });

    const query = gql`
      query {
        testResults {
          id
          output {
            ... on Status {
              stdout
            }
            ... on FAILING {
              stderr
            }
          }
        }
      }
    `;

    const data = {
      testResults: [
        {
          __typename: "TestResult",
          id: 123,
          output: {
            __typename: "PASSING",
            stdout: "ok!",
          },
        },
        {
          __typename: "TestResult",
          id: 456,
          output: {
            __typename: "FAILING",
            stdout: "",
            stderr: "oh no",
          },
        },
      ],
    };

    cache.writeQuery({ query, data });
    expect(cache.readQuery({ query })).toEqual(data);
  });

  it("can match indirect subtypes while avoiding cycles", () => {
    const cache = new InMemoryCache({
      addTypename: true,
      possibleTypes: {
        Animal: ["Animal", "Bug", "Mammal"],
        Bug: ["Ant", "Spider", "RolyPoly"],
        Mammal: ["Dog", "Cat", "Human"],
        Cat: ["Calico", "Siamese", "Sphynx", "Tabby"],
      },
    });

    const query = gql`
      query {
        animals {
          ... on Mammal {
            hasFur
            bodyTemperature
          }
          ... on Bug {
            isVenomous
          }
        }
      }
    `;

    const data = {
      animals: [
        {
          __typename: "Sphynx",
          hasFur: false,
          bodyTemperature: 99,
        },
        {
          __typename: "Dog",
          hasFur: true,
          bodyTemperature: 102,
        },
        {
          __typename: "Spider",
          isVenomous: "maybe",
        },
      ],
    };

    cache.writeQuery({ query, data });
    expect(cache.readQuery({ query })).toEqual(data);
  });

  it("can match against the root Query", () => {
    const cache = new InMemoryCache({
      addTypename: true,
    });

    const query = gql`
      query AllPeople {
        people {
          id
          name
        }
        ...PeopleTypes
      }
      fragment PeopleTypes on Query {
        __type(name: "Person") {
          name
          kind
        }
      }
    `;

    const data = {
      people: [
        {
          __typename: "Person",
          id: 123,
          name: "Ben",
        },
      ],
      __type: {
        __typename: "__Type",
        name: "Person",
        kind: "OBJECT",
      },
    };

    cache.writeQuery({ query, data });
    expect(cache.readQuery({ query })).toEqual(data);
  });
});

describe("policies.fragmentMatches", () => {
  const warnings: any[] = [];
  const { warn } = console;

  beforeEach(() => {
    warnings.length = 0;
    console.warn = function (...args: any) {
      warnings.push(args);
    };
  });

  afterEach(() => {
    console.warn = warn;
  });

  itAsync("can infer fuzzy subtypes heuristically", (resolve, reject) => {
    const cache = new InMemoryCache({
      possibleTypes: {
        A: ["B", "C"],
        B: ["D"],
        C: ["[E-Z]"],
      },
    });

    const fragments = gql`
      fragment FragA on A {
        a
      }
      fragment FragB on B {
        b
      }
      fragment FragC on C {
        c
      }
      fragment FragD on D {
        d
      }
      fragment FragE on E {
        e
      }
      fragment FragF on F {
        f
      }
    `;

    function checkTypes(expected: Record<string, Record<string, boolean>>) {
      const checked = new Set<FragmentDefinitionNode>();

      visit(fragments, {
        FragmentDefinition(frag) {
          function check(typename: string, result: boolean) {
            if (result !== cache.policies.fragmentMatches(frag, typename)) {
              reject(
                `fragment ${frag.name.value} should${
                  result ? "" : " not"
                } have matched typename ${typename}`
              );
            }
          }

          const supertype = frag.typeCondition.name.value;
          expect("ABCDEF".split("")).toContain(supertype);

          if (hasOwn.call(expected, supertype)) {
            Object.keys(expected[supertype]).forEach((subtype) => {
              check(subtype, expected[supertype][subtype]);
            });

            checked.add(frag);
          }
        },
      });

      return checked;
    }

    expect(
      checkTypes({
        A: {
          A: true,
          B: true,
          C: true,
          D: true,
          E: false,
          F: false,
          G: false,
        },
        B: {
          A: false,
          B: true,
          C: false,
          D: true,
          E: false,
          F: false,
          G: false,
        },
        C: {
          A: false,
          B: false,
          C: true,
          D: false,
          E: false,
          F: false,
          G: false,
        },
        D: {
          A: false,
          B: false,
          C: false,
          D: true,
          E: false,
          F: false,
          G: false,
        },
        E: {
          A: false,
          B: false,
          C: false,
          D: false,
          E: true,
          F: false,
          G: false,
        },
        F: {
          A: false,
          B: false,
          C: false,
          D: false,
          E: false,
          F: true,
          G: false,
        },
        G: {
          A: false,
          B: false,
          C: false,
          D: false,
          E: false,
          F: false,
          G: true,
        },
      }).size
    ).toBe("ABCDEF".length);

    cache.writeQuery({
      query: gql`
        query {
          objects {
            ...FragC
          }
        }
        ${fragments}
      `,
      data: {
        objects: [
          { __typename: "E", c: "ce" },
          { __typename: "F", c: "cf" },
          { __typename: "G", c: "cg" },
          // The /[E-Z]/ subtype pattern specified for the C supertype
          // must match the entire subtype string.
          { __typename: "TooLong", c: "nope" },
          // The H typename matches the regular expression for C, but it
          // does not pass the heuristic test of having all the fields
          // expected if FragC matched.
          { __typename: "H", h: "not c" },
        ],
      },
    });

    expect(warnings).toEqual([
      ["Inferring subtype %s of supertype %s", "E", "C"],
      ["Inferring subtype %s of supertype %s", "F", "C"],
      ["Inferring subtype %s of supertype %s", "G", "C"],
      // Note that TooLong is not inferred here.
    ]);

    expect(
      checkTypes({
        A: {
          A: true,
          B: true,
          C: true,
          D: true,
          E: true,
          F: true,
          G: true,
          H: false,
        },
        B: {
          A: false,
          B: true,
          C: false,
          D: true,
          E: false,
          F: false,
          G: false,
          H: false,
        },
        C: {
          A: false,
          B: false,
          C: true,
          D: false,
          E: true,
          F: true,
          G: true,
          H: false,
        },
        D: {
          A: false,
          B: false,
          C: false,
          D: true,
          E: false,
          F: false,
          G: false,
          H: false,
        },
        E: {
          A: false,
          B: false,
          C: false,
          D: false,
          E: true,
          F: false,
          G: false,
          H: false,
        },
        F: {
          A: false,
          B: false,
          C: false,
          D: false,
          E: false,
          F: true,
          G: false,
          H: false,
        },
        G: {
          A: false,
          B: false,
          C: false,
          D: false,
          E: false,
          F: true,
          G: true,
          H: false,
        },
      }).size
    ).toBe("ABCDEF".length);

    expect(cache.extract()).toMatchSnapshot();

    // Now add the TooLong subtype of C explicitly.
    cache.policies.addPossibleTypes({
      C: ["TooLong"],
    });

    expect(
      checkTypes({
        A: {
          A: true,
          B: true,
          C: true,
          D: true,
          E: true,
          F: true,
          G: true,
          TooLong: true,
          H: false,
        },
        B: {
          A: false,
          B: true,
          C: false,
          D: true,
          E: false,
          F: false,
          G: false,
          TooLong: false,
          H: false,
        },
        C: {
          A: false,
          B: false,
          C: true,
          D: false,
          E: true,
          F: true,
          G: true,
          TooLong: true,
          H: false,
        },
        D: {
          A: false,
          B: false,
          C: false,
          D: true,
          E: false,
          F: false,
          G: false,
          TooLong: false,
          H: false,
        },
        E: {
          A: false,
          B: false,
          C: false,
          D: false,
          E: true,
          F: false,
          G: false,
          TooLong: false,
          H: false,
        },
        F: {
          A: false,
          B: false,
          C: false,
          D: false,
          E: false,
          F: true,
          G: false,
          TooLong: false,
          H: false,
        },
        G: {
          A: false,
          B: false,
          C: false,
          D: false,
          E: false,
          F: true,
          G: true,
          TooLong: false,
          H: false,
        },
        H: {
          A: false,
          B: false,
          C: false,
          D: false,
          E: false,
          F: false,
          G: false,
          TooLong: false,
          H: true,
        },
      }).size
    ).toBe("ABCDEF".length);

    resolve();
  });
});
