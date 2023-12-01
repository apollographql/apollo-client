import { TypedDocumentNode, gql } from "../../../core/index.js";
import { MockedResponse } from "../../core/index.js";

export interface SimpleCaseData {
  greeting: string;
}

export function useSimpleCase() {
  const query: TypedDocumentNode<SimpleCaseData, never> = gql`
    query GreetingQuery {
      greeting
    }
  `;

  const mocks: MockedResponse<SimpleCaseData>[] = [
    {
      request: { query },
      result: { data: { greeting: "Hello" } },
      delay: 10,
    },
  ];

  return { query, mocks };
}

export interface VariablesCaseData {
  character: {
    id: string;
    name: string;
  };
}

export interface VariablesCaseVariables {
  id: string;
}

export function useVariablesCase() {
  const query: TypedDocumentNode<
    VariablesCaseData,
    VariablesCaseVariables
  > = gql`
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
      result: { data: { character: { id: String(index + 1), name } } },
      delay: 20,
    })
  );

  return { mocks, query };
}
