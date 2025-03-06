import { ApolloLink, Observable, gql } from "@apollo/client/core";
import type { TypedDocumentNode } from "@apollo/client/core";
import type { MaskedDocumentNode } from "@apollo/client/masking";
import type { MockedResponse } from "@apollo/client/testing/core";

export interface SimpleCaseData {
  greeting: string;
}

export function setupSimpleCase() {
  const query: TypedDocumentNode<SimpleCaseData, Record<string, never>> = gql`
    query GreetingQuery {
      greeting
    }
  `;

  const mocks: MockedResponse<SimpleCaseData>[] = [
    {
      request: { query },
      result: { data: { greeting: "Hello" } },
      delay: 20,
    },
  ];

  return { query, mocks };
}

export interface VariablesCaseData {
  character: {
    __typename: "Character";
    id: string;
    name: string;
  };
}

export interface VariablesCaseVariables {
  id: string;
}

export function setupVariablesCase() {
  const query: TypedDocumentNode<VariablesCaseData, VariablesCaseVariables> =
    gql`
      query CharacterQuery($id: ID!) {
        character(id: $id) {
          id
          name
        }
      }
    `;
  const CHARACTERS = ["Spider-Man", "Black Widow", "Iron Man", "Hulk"];

  const mocks: MockedResponse<VariablesCaseData>[] = [...CHARACTERS].map(
    (name, index) => ({
      request: { query, variables: { id: String(index + 1) } },
      result: {
        data: {
          character: { __typename: "Character", id: String(index + 1), name },
        },
      },
      delay: 20,
    })
  );

  return { mocks, query };
}

type MaskedVariablesCaseFragment = {
  __typename: "Character";
  name: string;
} & { " $fragmentName"?: "MaskedVariablesCaseFragment" };

export interface MaskedVariablesCaseData {
  character: {
    __typename: "Character";
    id: string;
  } & {
    " $fragmentRefs"?: {
      MaskedVariablesCaseFragment: MaskedVariablesCaseFragment;
    };
  };
}

export interface UnmaskedVariablesCaseData {
  character: {
    __typename: "Character";
    id: string;
    name: string;
  };
}

export function setupMaskedVariablesCase() {
  const document = gql`
    query CharacterQuery($id: ID!) {
      character(id: $id) {
        id
        ...CharacterFragment
      }
    }

    fragment CharacterFragment on Character {
      name
    }
  `;
  const query: MaskedDocumentNode<
    MaskedVariablesCaseData,
    VariablesCaseVariables
  > = document;

  const unmaskedQuery: TypedDocumentNode<
    MaskedVariablesCaseData,
    VariablesCaseVariables
  > = document;

  const CHARACTERS = ["Spider-Man", "Black Widow", "Iron Man", "Hulk"];

  const mocks: MockedResponse<MaskedVariablesCaseData>[] = [...CHARACTERS].map(
    (name, index) => ({
      request: { query, variables: { id: String(index + 1) } },
      result: {
        data: {
          character: { __typename: "Character", id: String(index + 1), name },
        },
      },
      delay: 20,
    })
  );

  return { mocks, query, unmaskedQuery };
}

export function addDelayToMocks<T extends MockedResponse<unknown>[]>(
  mocks: T,
  delay = 150,
  override = false
) {
  return mocks.map((mock) =>
    override ? { ...mock, delay } : { delay, ...mock }
  );
}

interface Letter {
  __typename: "Letter";
  letter: string;
  position: number;
}

export interface PaginatedCaseData {
  letters: Letter[];
}

export interface PaginatedCaseVariables {
  limit?: number;
  offset?: number;
}

export function setupPaginatedCase() {
  const query: TypedDocumentNode<PaginatedCaseData, PaginatedCaseVariables> =
    gql`
      query LettersQuery($limit: Int, $offset: Int) {
        letters(limit: $limit, offset: $offset) {
          letter
          position
        }
      }
    `;

  const data = "ABCDEFGHIJKLMNOPQRSTUV".split("").map((letter, index) => ({
    __typename: "Letter",
    letter,
    position: index + 1,
  }));

  const link = new ApolloLink((operation) => {
    const { offset = 0, limit = 2 } = operation.variables;
    const letters = data.slice(offset, offset + limit);

    return new Observable((observer) => {
      setTimeout(() => {
        observer.next({ data: { letters } });
        observer.complete();
      }, 10);
    });
  });

  return { query, link, data };
}
