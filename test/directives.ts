import * as chai from 'chai';
const { assert } = chai;

import {
  shouldInclude,
} from '../src/queries/directives';

import {
  getQueryDefinition,
} from '../src/queries/getFromAST';

import gql from '../src/gql';

import cloneDeep = require('lodash.clonedeep');

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
});
