import { InMemoryCache } from '../inMemoryCache';
import gql from 'graphql-tag';

describe('fragment matching', () => {
  it('can match exact types with or without possibleTypes', () => {
    const cacheWithoutPossibleTypes = new InMemoryCache({
      addTypename: true,
    });

    const cacheWithPossibleTypes = new InMemoryCache({
      addTypename: true,
      possibleTypes: {
        Animal: ['Cat', 'Dog'],
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
      __typename: 'Query',
      animals: [
        {
          __typename: 'Cat',
          id: 1,
          name: 'Felix',
          livesLeft: 8,
          killsToday: 2,
        },
        {
          __typename: 'Dog',
          id: 2,
          name: 'Baxter',
        },
      ],
    };

    cacheWithoutPossibleTypes.writeQuery({ query, data });
    expect(cacheWithoutPossibleTypes.readQuery({ query })).toEqual(data);

    cacheWithPossibleTypes.writeQuery({ query, data });
    expect(cacheWithPossibleTypes.readQuery({ query })).toEqual(data);
  });

  it('can match interface subtypes', () => {
    const cache = new InMemoryCache({
      addTypename: true,
      possibleTypes: {
        Animal: ['Cat', 'Dog'],
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
      __typename: 'Query',
      bestFriend: {
        __typename: 'Dog',
        id: 2,
        name: 'Beckett',
      },
    };

    cache.writeQuery({ query, data });
    expect(cache.readQuery({ query })).toEqual(data);
  });

  it('can match union member types', () => {
    const cache = new InMemoryCache({
      addTypename: true,
      possibleTypes: {
        Status: ['PASSING', 'FAILING', 'SKIPPED'],
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
      __typename: 'Query',
      testResults: [
        {
          __typename: 'TestResult',
          id: 123,
          output: {
            __typename: 'PASSING',
            stdout: 'ok!',
          },
        },
        {
          __typename: 'TestResult',
          id: 456,
          output: {
            __typename: 'FAILING',
            stdout: '',
            stderr: 'oh no',
          },
        },
      ],
    };

    cache.writeQuery({ query, data });
    expect(cache.readQuery({ query })).toEqual(data);
  });

  it('can match indirect subtypes while avoiding cycles', () => {
    const cache = new InMemoryCache({
      addTypename: true,
      possibleTypes: {
        Animal: ['Animal', 'Bug', 'Mammal'],
        Bug: ['Ant', 'Spider', 'RolyPoly'],
        Mammal: ['Dog', 'Cat', 'Human'],
        Cat: ['Calico', 'Siamese', 'Sphynx', 'Tabby'],
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
      __typename: 'Query',
      animals: [
        {
          __typename: 'Sphynx',
          hasFur: false,
          bodyTemperature: 99,
        },
        {
          __typename: 'Dog',
          hasFur: true,
          bodyTemperature: 102,
        },
        {
          __typename: 'Spider',
          isVenomous: 'maybe',
        },
      ],
    };

    cache.writeQuery({ query, data });
    expect(cache.readQuery({ query })).toEqual(data);
  });

  it('can match against the root Query', () => {
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
      __typename: 'Query',
      people: [
        {
          __typename: 'Person',
          id: 123,
          name: 'Ben',
        },
      ],
      __type: {
        __typename: '__Type',
        name: 'Person',
        kind: 'OBJECT',
      },
    };

    cache.writeQuery({ query, data });
    expect(cache.readQuery({ query })).toEqual(data);
  });
});
