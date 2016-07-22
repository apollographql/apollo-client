import { assert } from 'chai';
import {
  Field,
} from 'graphql';
import {
  storeKeyNameFromField,
} from '../src/data/storeUtils';

describe('storeUtils', () => {
  describe('storeKeyNameFromField', () => {
    it('generates a simple key with the name without args', () => {
      const simpleField: Field = {
        kind: 'Field',
        name: {
          kind: 'Name',
          value: 'fortuneCookie',
        },
      };
      const key = storeKeyNameFromField(simpleField);
      assert.equal(key, 'fortuneCookie');
    });

    it('generates a key with some args', () => {
      const simpleField: Field = {
        kind: 'Field',
        name: { kind: 'Name', value: 'fortuneCookie' },
        arguments: [
          {
            kind: 'Argument',
            name: { kind: 'Name', value: 'type' },
            value: { kind: 'StringValue', value: 'fortune' },
          },
          {
            kind: 'Argument',
            name: { kind: 'Name', value: 'cursor' },
            value: { kind: 'IntValue', value: '1' },
          },
        ],
      };
      const key = storeKeyNameFromField(simpleField);
      assert.equal(key, 'fortuneCookie({"type":"fortune","cursor":1})');
    });

    it('generates a key with some args from variables', () => {
      const simpleField: Field = {
        kind: 'Field',
        name: { kind: 'Name', value: 'fortuneCookie' },
        arguments: [
          {
            kind: 'Argument',
            name: { kind: 'Name', value: 'type' },
            value: { kind: 'StringValue', value: 'fortune' },
          },
          {
            kind: 'Argument',
            name: { kind: 'Name', value: 'cursor' },
            value: { kind: 'Variable', name: {kind: 'Name', value: 'cursor'} },
          },
        ],
      };
      const variablesMap = {
        cursor: 1,
      };
      const key = storeKeyNameFromField(simpleField, variablesMap);
      assert.equal(key, 'fortuneCookie({"type":"fortune","cursor":1})');
    });

    it('generates a key with some args as paginationArguments', () => {
      const simpleField: Field = {
        kind: 'Field',
        name: { kind: 'Name', value: 'fortuneCookie' },
        arguments: [
          {
            kind: 'Argument',
            name: { kind: 'Name', value: 'type' },
            value: { kind: 'StringValue', value: 'fortune' },
          },
          {
            kind: 'Argument',
            name: { kind: 'Name', value: 'cursor' },
            value: { kind: 'IntValue', value: '1' },
          },
        ],
      };
      const paginationArgs = ['cursor'];
      const key = storeKeyNameFromField(simpleField, {}, paginationArgs);
      assert.equal(key, 'fortuneCookie({"type":"fortune"})');
    });
  });
});
