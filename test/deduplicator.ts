import mockNetworkInterface from './mocks/mockNetworkInterface';
import gql from 'graphql-tag';
import { assert } from 'chai';
import ApolloClient, { toIdValue } from '../src';
import { Request, NetworkInterface } from '../src/transport/networkInterface';
import { Deduplicator } from '../src/transport/Deduplicator';
import { getOperationName } from '../src/queries/getFromAST';
import { DocumentNode } from 'graphql';

import { NetworkStatus } from '../src/queries/store';

describe('query deduplication', () => {
  it(`does not affect different queries`, () => {

    const document: DocumentNode = gql`query test1($x: String){
      test(x: $x)
    }`;
    const variables1 = { x: 'Hello World' };
    const variables2 = { x: 'Goodbye World' };

    const request1: Request = {
      query: document,
      variables: variables1,
      operationName: getOperationName(document),
    };

    const request2: Request = {
      query: document,
      variables: variables2,
      operationName: getOperationName(document),
    };

    let called = 0;
    const deduper = new Deduplicator({
      query: () => {
        called += 1;
        return new Promise((resolve, reject) => {
          setTimeout(resolve, 5);
        });
      },
    } as any );

    deduper.query(request1);
    deduper.query(request2);
    assert.equal(called, 2);

  });

  it(`deduplicates identical queries`, () => {

    const document: DocumentNode = gql`query test1($x: String){
      test(x: $x)
    }`;
    const variables1 = { x: 'Hello World' };
    const variables2 = { x: 'Hello World' };

    const request1: Request = {
      query: document,
      variables: variables1,
      operationName: getOperationName(document),
    };

    const request2: Request = {
      query: document,
      variables: variables2,
      operationName: getOperationName(document),
    };

    let called = 0;
    const deduper = new Deduplicator({
      query: () => {
        called += 1;
        return new Promise((resolve, reject) => {
          setTimeout(resolve, 5);
        });
      },
    } as any );

    deduper.query(request1);
    deduper.query(request2);
    assert.equal(called, 1);

  });

  it(`can bypass deduplication if desired`, () => {

    const document: DocumentNode = gql`query test1($x: String){
      test(x: $x)
    }`;
    const variables1 = { x: 'Hello World' };
    const variables2 = { x: 'Hello World' };

    const request1: Request = {
      query: document,
      variables: variables1,
      operationName: getOperationName(document),
    };

    const request2: Request = {
      query: document,
      variables: variables2,
      operationName: getOperationName(document),
    };

    let called = 0;
    const deduper = new Deduplicator({
      query: () => {
        called += 1;
        return new Promise((resolve, reject) => {
          setTimeout(resolve, 5);
        });
      },
    } as any );

    deduper.query(request1, false);
    deduper.query(request2, false);
    assert.equal(called, 2);

  });
});
