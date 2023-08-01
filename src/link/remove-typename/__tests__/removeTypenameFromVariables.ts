import {
  KEEP,
  removeTypenameFromVariables,
} from "../removeTypenameFromVariables";
import { ApolloLink, Operation } from "../../core";
import { Observable, gql } from "../../../core";
import { createOperation, toPromise } from "../../utils";

type PartialOperation = Partial<Pick<Operation, "variables">> &
  Pick<Operation, "query">;

// Since this link modifies the `operation` and we only care to test against
// the changed operation, we use a custom `execute` helper here instead of the
// version exported by the `core` module, which expects a well-formed response.
async function execute(link: ApolloLink, operation: PartialOperation) {
  function forward(operation: Operation) {
    // use the `data` key to satisfy the TypeScript types required by
    // `forward`'s' return value
    return Observable.of({ data: operation });
  }

  const { data } = await toPromise(
    link.request(createOperation({}, operation), forward)!
  );

  return data as Operation;
}

test("strips all __typename keys by default", async () => {
  const query = gql`
    query Test($foo: FooInput!, $bar: BarInput!) {
      someField(foo: $foo, bar: $bar)
    }
  `;

  const link = removeTypenameFromVariables();

  const { variables } = await execute(link, {
    query,
    variables: {
      foo: {
        __typename: "Foo",
        foo: true,
        bar: "Bar",
        baz: { __typename: "Baz", baz: true },
        qux: [{ __typename: "Qux", qux: 0 }],
      },
      bar: [{ __typename: "Bar", bar: true }],
    },
  });

  expect(variables).toStrictEqual({
    foo: {
      foo: true,
      bar: "Bar",
      baz: { baz: true },
      qux: [{ qux: 0 }],
    },
    bar: [{ bar: true }],
  });
});

test("does nothing when no variables are passed", async () => {
  const query = gql`
    query Test {
      foo {
        bar
      }
    }
  `;

  const link = removeTypenameFromVariables();

  const operation = { query };
  const resultOperation = await execute(link, operation);

  expect(resultOperation).toBe(operation);
});

test("does nothing when no variables are passed even if variables are declared in the document", async () => {
  const query = gql`
    query Test($unused: Boolean) {
      foo {
        bar
      }
    }
  `;

  const link = removeTypenameFromVariables();

  const operation = { query };
  const resultOperation = await execute(link, operation);

  expect(resultOperation).toBe(operation);
});

test("keeps __typename for variables with types defined by `except`", async () => {
  const query = gql`
    query Test($foo: JSON, $bar: BarInput) {
      someField(foo: $foo, bar: $bar)
    }
  `;

  const link = removeTypenameFromVariables({
    except: {
      JSON: KEEP,
    },
  });

  const { variables } = await execute(link, {
    query,
    variables: {
      foo: {
        __typename: "Foo",
        foo: true,
        baz: { __typename: "Baz", baz: true },
      },
      bar: { __typename: "Bar", bar: true },
    },
  });

  expect(variables).toStrictEqual({
    foo: {
      __typename: "Foo",
      foo: true,
      baz: { __typename: "Baz", baz: true },
    },
    bar: { bar: true },
  });
});

test("keeps __typename in all variables with types configured with `except`", async () => {
  const query = gql`
    query Test($foo: JSON, $bar: Config, $baz: BazInput) {
      someField(foo: $foo, bar: $bar, baz: $baz)
    }
  `;

  const link = removeTypenameFromVariables({
    except: {
      JSON: KEEP,
      Config: KEEP,
    },
  });

  const { variables } = await execute(link, {
    query,
    variables: {
      foo: { __typename: "Foo", foo: true },
      bar: { __typename: "Bar", bar: true },
      baz: { __typename: "Baz", baz: true },
    },
  });

  expect(variables).toStrictEqual({
    foo: { __typename: "Foo", foo: true },
    bar: { __typename: "Bar", bar: true },
    baz: { baz: true },
  });
});

test("handles variable declarations declared as non null and list types", async () => {
  const query = gql`
    query Test($foo: JSON!, $bar: [JSON], $baz: [JSON!]!, $qux: QuxInput!) {
      someField(foo: $foo, bar: $bar, baz: $baz)
    }
  `;

  const link = removeTypenameFromVariables({
    except: {
      JSON: KEEP,
    },
  });

  const { variables } = await execute(link, {
    query,
    variables: {
      foo: { __typename: "Foo", foo: true },
      bar: [
        { __typename: "Bar", bar: true, baz: { __typename: "Baz", baz: true } },
      ],
      baz: [
        { __typename: "Baz", baz: true },
        { __typename: "Baz", baz: true },
      ],
      qux: { __typename: "Qux", qux: true },
    },
  });

  expect(variables).toStrictEqual({
    foo: { __typename: "Foo", foo: true },
    bar: [
      { __typename: "Bar", bar: true, baz: { __typename: "Baz", baz: true } },
    ],
    baz: [
      { __typename: "Baz", baz: true },
      { __typename: "Baz", baz: true },
    ],
    qux: { qux: true },
  });
});

test("keeps __typename at configured fields under input object types", async () => {
  const query = gql`
    query Test($foo: FooInput) {
      someField(foo: $foo)
    }
  `;

  const link = removeTypenameFromVariables({
    except: {
      FooInput: {
        bar: KEEP,
        baz: KEEP,
      },
    },
  });

  const { variables } = await execute(link, {
    query,
    variables: {
      foo: {
        __typename: "Foo",
        aa: true,
        bar: {
          __typename: "Bar",
          bb: true,
        },
        baz: {
          __typename: "Baz",
          cc: true,
        },
        qux: {
          __typename: "Qux",
          dd: true,
        },
      },
    },
  });

  expect(variables).toStrictEqual({
    foo: {
      aa: true,
      bar: {
        __typename: "Bar",
        bb: true,
      },
      baz: {
        __typename: "Baz",
        cc: true,
      },
      qux: {
        dd: true,
      },
    },
  });
});

test("keeps __typename at a deeply nested field", async () => {
  const query = gql`
    query Test($foo: FooInput) {
      someField(foo: $foo)
    }
  `;

  const link = removeTypenameFromVariables({
    except: {
      FooInput: {
        bar: {
          baz: {
            qux: KEEP,
          },
        },
      },
    },
  });

  const { variables } = await execute(link, {
    query,
    variables: {
      foo: {
        __typename: "Foo",
        bar: {
          __typename: "Bar",
          baz: {
            __typename: "Baz",
            qux: {
              __typename: "Qux",
              quux: true,
            },
          },
        },
      },
    },
  });

  expect(variables).toStrictEqual({
    foo: {
      bar: {
        baz: {
          qux: {
            __typename: "Qux",
            quux: true,
          },
        },
      },
    },
  });
});

test("handles configured fields varying nesting levels", async () => {
  const query = gql`
    query Test($foo: FooInput) {
      someField(foo: $foo)
    }
  `;

  const link = removeTypenameFromVariables({
    except: {
      FooInput: {
        bar: KEEP,
        baz: {
          qux: KEEP,
        },
      },
    },
  });

  const { variables } = await execute(link, {
    query,
    variables: {
      foo: {
        __typename: "Foo",
        bar: {
          __typename: "Bar",
          aa: true,
        },
        baz: {
          __typename: "Baz",
          qux: {
            __typename: "Qux",
            quux: true,
          },
        },
      },
    },
  });

  expect(variables).toStrictEqual({
    foo: {
      bar: {
        __typename: "Bar",
        aa: true,
      },
      baz: {
        qux: {
          __typename: "Qux",
          quux: true,
        },
      },
    },
  });
});

test("handles multiple configured types with fields", async () => {
  const query = gql`
    query Test($foo: FooInput, $baz: BazInput) {
      someField(foo: $foo, baz: $baz)
    }
  `;

  const link = removeTypenameFromVariables({
    except: {
      FooInput: {
        bar: KEEP,
      },
      BazInput: {
        qux: KEEP,
      },
    },
  });

  const { variables } = await execute(link, {
    query,
    variables: {
      foo: {
        __typename: "Foo",
        bar: {
          __typename: "Bar",
          aa: true,
        },
      },
      baz: {
        __typename: "Bar",
        qux: {
          __typename: "Qux",
          bb: true,
        },
      },
    },
  });

  expect(variables).toStrictEqual({
    foo: {
      bar: {
        __typename: "Bar",
        aa: true,
      },
    },
    baz: {
      qux: {
        __typename: "Qux",
        bb: true,
      },
    },
  });
});

test("handles when __typename is not present in all paths", async () => {
  const query = gql`
    query Test($foo: JSON, $bar: BarInput) {
      someField(foo: $foo, bar: $bar)
    }
  `;

  const link = removeTypenameFromVariables({
    except: {
      JSON: KEEP,
    },
  });

  const { variables } = await execute(link, {
    query,
    variables: {
      foo: {
        foo: true,
        baz: { __typename: "Baz", baz: true },
      },
      bar: { bar: true },
      qux: { __typename: "Qux", bar: true },
    },
  });

  expect(variables).toStrictEqual({
    foo: {
      foo: true,
      baz: { __typename: "Baz", baz: true },
    },
    bar: { bar: true },
    qux: { bar: true },
  });
});

test("handles when __typename is not present in variables", async () => {
  const query = gql`
    query Test($foo: JSON, $bar: BarInput) {
      someField(foo: $foo, bar: $bar)
    }
  `;

  const link = removeTypenameFromVariables({
    except: {
      JSON: KEEP,
    },
  });

  const { variables } = await execute(link, {
    query,
    variables: {
      foo: {
        foo: true,
        baz: { baz: true },
      },
      bar: { bar: true },
      qux: [{ foo: true }],
    },
  });

  expect(variables).toStrictEqual({
    foo: {
      foo: true,
      baz: { baz: true },
    },
    bar: { bar: true },
    qux: [{ foo: true }],
  });
});

test("handles when declared variables are unused", async () => {
  const query = gql`
    query Test($foo: FooInput, $unused: JSON) {
      someField(foo: $foo, bar: $bar)
    }
  `;

  const link = removeTypenameFromVariables({
    except: {
      JSON: KEEP,
    },
  });

  const { variables } = await execute(link, {
    query,
    variables: {
      foo: {
        __typename: "Foo",
        foo: true,
        baz: { __typename: "Bar", baz: true },
      },
    },
  });

  expect(variables).toStrictEqual({
    foo: {
      foo: true,
      baz: { baz: true },
    },
  });
});

test("ensures operation.getContext and operation.setContext functions are properly forwarded", async () => {
  const query = gql`
    query Test($foo: FooInput) {
      someField(foo: $foo)
    }
  `;

  const link = removeTypenameFromVariables();

  const operationWithoutVariables = await execute(link, { query });
  const operationWithVariables = await execute(link, {
    query,
    variables: { foo: { __typename: "FooInput", bar: true } },
  });

  expect(typeof operationWithoutVariables.getContext).toBe("function");
  expect(typeof operationWithoutVariables.setContext).toBe("function");
  expect(typeof operationWithVariables.getContext).toBe("function");
  expect(typeof operationWithVariables.setContext).toBe("function");
});
