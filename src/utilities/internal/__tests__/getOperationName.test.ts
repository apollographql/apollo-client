import { gql } from "@apollo/client";
import { getOperationName } from "@apollo/client/utilities/internal";

test("should get the operation name out of a query", () => {
  const query = gql`
    query nameOfQuery {
      fortuneCookie
    }
  `;

  const operationName = getOperationName(query);

  expect(operationName).toEqual("nameOfQuery");
});

test("should get the operation name out of a mutation", () => {
  const query = gql`
    mutation nameOfMutation {
      fortuneCookie
    }
  `;

  const operationName = getOperationName(query);

  expect(operationName).toEqual("nameOfMutation");
});

test("should return null if the query does not have an operation name", () => {
  const query = gql`
    {
      fortuneCookie
    }
  `;

  const operationName = getOperationName(query);

  expect(operationName).toEqual(null);
});
