import { removeTypenameFromVariables } from '../removeTypenameFromVariables';
import { ApolloLink, Operation } from '../../core';
import { Observable, gql } from '../../../core';
import { createOperation, toPromise } from '../../utils';

type PartialOperation = Partial<Pick<Operation, 'variables'>> &
  Pick<Operation, 'query'>;

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

test('strips all __typename keys by default', async () => {
  const query = gql`
    query Test($foo: FooInput!, $bar: BarInput!) {
      someField(foo: $foo, bar: $bar)
    }
  `;

  const link = removeTypenameFromVariables();

  const operation = await execute(link, {
    query,
    variables: {
      foo: {
        __typename: 'Foo',
        foo: true,
        bar: 'Bar',
        baz: { __typename: 'Baz', baz: true },
        qux: [{ __typename: 'Qux', qux: 0 }],
      },
      bar: [{ __typename: 'Bar', bar: true }],
    },
  });

  expect(operation.variables).toStrictEqual({
    foo: {
      foo: true,
      bar: 'Bar',
      baz: { baz: true },
      qux: [{ qux: 0 }],
    },
    bar: [{ bar: true }],
  });
});

test('does nothing when no variables are passed', async () => {
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

test('does nothing when no variables are passed even if variables are declared in the document', async () => {
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

test('keeps __typename in variables with types defined by `excludeScalars`', async () => {
  const query = gql`
    query Test($foo: JSON, $bar: BarInput) {
      someField(foo: $foo, bar: $bar)
    }
  `;

  const link = removeTypenameFromVariables({
    excludeScalars: ['JSON'],
  });

  const { variables } = await execute(link, {
    query,
    variables: {
      foo: {
        __typename: 'Foo',
        foo: true,
        baz: { __typename: 'Baz', baz: true },
      },
      bar: { __typename: 'Bar', bar: true },
    },
  });

  expect(variables).toStrictEqual({
    foo: {
      __typename: 'Foo',
      foo: true,
      baz: { __typename: 'Baz', baz: true },
    },
    bar: { bar: true },
  });
});

test('keeps __typename in variables when defining multiple scalars excluded by `excludeScalars`', async () => {
  const query = gql`
    query Test($foo: JSON, $bar: Config, $baz: BazInput) {
      someField(foo: $foo, bar: $bar, baz: $baz)
    }
  `;

  const link = removeTypenameFromVariables({
    excludeScalars: ['JSON', 'Config'],
  });

  const { variables } = await execute(link, {
    query,
    variables: {
      foo: { __typename: 'Foo', foo: true },
      bar: { __typename: 'Bar', bar: true },
      baz: { __typename: 'Baz', baz: true },
    },
  });

  expect(variables).toStrictEqual({
    foo: { __typename: 'Foo', foo: true },
    bar: { __typename: 'Bar', bar: true },
    baz: { baz: true },
  });
});

test('keeps __typename in variables defined by `excludeScalars` declared as non null and list types', async () => {
  const query = gql`
    query Test($foo: JSON!, $bar: [JSON], $baz: [JSON!]!, $qux: QuxInput!) {
      someField(foo: $foo, bar: $bar, baz: $baz)
    }
  `;

  const link = removeTypenameFromVariables({
    excludeScalars: ['JSON'],
  });

  const { variables } = await execute(link, {
    query,
    variables: {
      foo: { __typename: 'Foo', foo: true },
      bar: [
        { __typename: 'Bar', bar: true, baz: { __typename: 'Baz', baz: true } },
      ],
      baz: [
        { __typename: 'Baz', baz: true },
        { __typename: 'Baz', baz: true },
      ],
      qux: { __typename: 'Qux', qux: true },
    },
  });

  expect(variables).toStrictEqual({
    foo: { __typename: 'Foo', foo: true },
    bar: [
      { __typename: 'Bar', bar: true, baz: { __typename: 'Baz', baz: true } },
    ],
    baz: [
      { __typename: 'Baz', baz: true },
      { __typename: 'Baz', baz: true },
    ],
    qux: { qux: true },
  });
});
