import { DocumentNode } from 'graphql';

import { NetworkInterface } from '../transport/networkInterface';
import { QueryManager } from '../core/QueryManager';
import { IdValue, isIdValue } from './storeUtils';
import { ReadStoreContext } from './readFromStore';
import introspectionQuery from './fragmentMatcherIntrospectionQuery';

import {
  isTest,
} from '../util/environment';

export interface FragmentMatcherInterface {
  match(idValue: IdValue, typeCondition: string, context: ReadStoreContext): boolean;
}

type PossibleTypesMap = {[key: string]: string[]};

export type IntrospectionResultData = {
  __schema: {
    types: [{
      kind: string,
      name: string,
      possibleTypes: [{
        name: string,
      }],
    }],
  },
};

export class IntrospectionFragmentMatcher implements FragmentMatcherInterface {

  private isReady: boolean;
  private readyPromise: Promise<void> | null;
  private possibleTypesMap: PossibleTypesMap;

  constructor(options?: {
    introspectionQueryResultData?: IntrospectionResultData,
  }) {
    if (options && options.introspectionQueryResultData) {
      this.possibleTypesMap = this.parseIntrospectionResult(options.introspectionQueryResultData);
      this.isReady = true;
    } else {
      this.isReady = false;
    }

    this.match = this.match.bind(this);
  }

  public match(idValue: IdValue, typeCondition: string, context: ReadStoreContext) {
    if (!this.isReady) {
      // this should basically never happen in proper use.
      throw new Error('FragmentMatcher.match() was called before FragmentMatcher.init()');
    }

    const obj = context.store[idValue.id];

    if (! obj) {
      return false;
    }

    if (!obj.__typename) {
      throw new Error(`Cannot match fragment because __typename property is missing: ${JSON.stringify(obj)}`);
    }

    if (obj.__typename === typeCondition) {
      return true;
    }

    const implementingTypes = this.possibleTypesMap[typeCondition];
    if (implementingTypes && implementingTypes.indexOf(obj.__typename) > -1) {
      return true;
    }

    return false;
  }

  private parseIntrospectionResult(introspectionResultData: IntrospectionResultData): PossibleTypesMap {
    const typeMap: PossibleTypesMap = {};
    introspectionResultData.__schema.types.forEach( type => {
      if (type.kind === 'UNION' || type.kind === 'INTERFACE') {
        typeMap[type.name] = type.possibleTypes.map( implementingType => implementingType.name );
      }
    });
    return typeMap;
  }
}


let haveWarned = false;

/**
 * This fragment matcher is very basic and unable to match union or interface type conditions
 */
export class HeuristicFragmentMatcher implements FragmentMatcherInterface {
  constructor() {
    // do nothing
  }

  public ensureReady() {
    return Promise.resolve();
  }

  public canBypassInit() {
    return true; // we don't need to initialize this fragment matcher.
  }

  public match(
    idValue: IdValue,
    typeCondition: string,
    context: ReadStoreContext,
  ): boolean {

    const obj = context.store[idValue.id];

    if (! obj) {
      return false;
    }

    if (! obj.__typename) {
      if (! haveWarned) {
        console.warn(`You're using fragments in your queries, but don't have the addTypename:
  true option set in Apollo Client. Please turn on that option so that we can accurately
  match fragments.`);

        /* istanbul ignore if */
        if (!isTest()) {
          // When running tests, we want to print the warning every time
          haveWarned = true;
        }
      }

      context.returnPartialData = true;
      return true;
    }

    if (obj.__typename === typeCondition) {
      return true;
    }

    // XXX here we reach an issue - we don't know if this fragment should match or not. It's either:
    // 1. A fragment on a non-matching concrete type or interface or union
    // 2. A fragment on a matching interface or union
    // If it's 1, we don't want to return anything, if it's 2 we want to match. We can't tell the
    // difference, so for now, we just do our best to resolve the fragment but turn on partial data
    context.returnPartialData = true;
    return true;
  }
}
