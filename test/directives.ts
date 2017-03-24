import * as chai from 'chai';
const { assert } = chai;

import {
  shouldInclude,
} from '../src/queries/directives';

import {
  getQueryDefinition,
} from '../src/queries/getFromAST';

import gql from 'graphql-tag';

import { cloneDeep } from 'lodash';

describe('query directives', () => {
  it('should should not include a skipped field', () => {
    const query = gql`
      query {
        fortuneCookie @skip(if: true)
      }`;
    const field = getQueryDefinition(query).selectionSet.selections[0];
    assert(!shouldInclude(field, {}));
  });

  it('should include an included field', () => {
    const query = gql`
      query {
        fortuneCookie @include(if: true)
      }`;
    const field = getQueryDefinition(query).selectionSet.selections[0];
    assert(shouldInclude(field, {}));
  });

  it('should not include a not include: false field', () => {
    const query = gql`
      query {
        fortuneCookie @include(if: false)
      }`;
    const field = getQueryDefinition(query).selectionSet.selections[0];
    assert(!shouldInclude(field, {}));
  });

  it('should include a skip: false field', () => {
    const query = gql`
      query {
        fortuneCookie @skip(if: false)
      }`;
    const field = getQueryDefinition(query).selectionSet.selections[0];
    assert(shouldInclude(field, {}));
  });

  it('should not include a field if skip: true and include: true', () => {
    const query = gql`
      query {
        fortuneCookie @skip(if: true) @include(if: true)
      }`;
    const field = getQueryDefinition(query).selectionSet.selections[0];
    assert(!shouldInclude(field, {}));
  });

  it('should not include a field if skip: true and include: false', () => {
    const query = gql`
      query {
        fortuneCookie @skip(if: true) @include(if: false)
      }`;
    const field = getQueryDefinition(query).selectionSet.selections[0];
    assert(!shouldInclude(field, {}));
  });

  it('should include a field if skip: false and include: true', () => {
    const query = gql`
      query {
        fortuneCookie @skip(if:false) @include(if: true)
      }`;
    const field = getQueryDefinition(query).selectionSet.selections[0];
    assert(shouldInclude(field, {}));
  });

  it('should not include a field if skip: false and include: false', () => {
    const query = gql`
      query {
        fortuneCookie @skip(if: false) @include(if: false)
      }`;
    const field = getQueryDefinition(query).selectionSet.selections[0];
    assert(!shouldInclude(field, {}));
  });

  it('should leave the original query unmodified', () => {
    const query = gql`
      query {
        fortuneCookie @skip(if: false) @include(if: false)
      }`;
    const queryClone = cloneDeep(query);
    const field = getQueryDefinition(query).selectionSet.selections[0];
    shouldInclude(field, {});
    assert.deepEqual(query, queryClone);
  });

  it('does not throw an error on an unsupported directive', () => {
    const query = gql`
      query {
        fortuneCookie @dosomething(if: true)
      }`;
    const field = getQueryDefinition(query).selectionSet.selections[0];

    assert.doesNotThrow(() => {
      shouldInclude(field, {});
    });
  });

  it('throws an error on an invalid argument for the skip directive', () => {
    const query = gql`
      query {
        fortuneCookie @skip(nothing: true)
      }`;
    const field = getQueryDefinition(query).selectionSet.selections[0];

    assert.throws(() => {
      shouldInclude(field, {});
    });
  });

  it('throws an error on an invalid argument for the include directive', () => {
    const query = gql`
      query {
        fortuneCookie @include(nothing: true)
      }`;
    const field = getQueryDefinition(query).selectionSet.selections[0];

    assert.throws(() => {
      shouldInclude(field, {});
    });
  });

  it('throws an error on an invalid variable name within a directive argument', () => {
    const query = gql`
      query {
        fortuneCookie @include(if: $neverDefined)
      }`;
    const field = getQueryDefinition(query).selectionSet.selections[0];
    assert.throws(() => {
      shouldInclude(field, {});
    });
  });

  it('evaluates variables on skip fields', () => {
    const query = gql`
      query($shouldSkip: Boolean) {
        fortuneCookie @skip(if: $shouldSkip)
      }`;
    const variables = {
      shouldSkip: true,
    };
    const field = getQueryDefinition(query).selectionSet.selections[0];
    assert(!shouldInclude(field, variables));
  });

  it('evaluates variables on include fields', () => {
    const query = gql`
      query($shouldSkip: Boolean) {
        fortuneCookie @include(if: $shouldInclude)
      }`;
    const variables = {
      shouldInclude: false,
    };
    const field = getQueryDefinition(query).selectionSet.selections[0];
    assert(!shouldInclude(field, variables));
  });

  it('throws an error if the value of the argument is not a variable or boolean', () => {
    const query = gql`
      query {
        fortuneCookie @include(if: "string")
      }`;
    const field = getQueryDefinition(query).selectionSet.selections[0];
    assert.throws(() => {
      shouldInclude(field, {});
    });
  });
});
