import { isTest, warnOnceInDevelopment, IdValue } from 'apollo-utilities';

import {
  ReadStoreContext,
  FragmentMatcherInterface,
  PossibleTypesMap,
  IntrospectionResultData,
} from './types';

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

    if (!obj) {
      return false;
    }

    if (!obj.__typename) {
      if (!haveWarned) {
        console.warn(`You're using fragments in your queries, but either don't have the addTypename:
  true option set in Apollo Client, or you are trying to write a fragment to the store without the __typename.
   Please turn on the addTypename option and include __typename when writing fragments so that Apollo Client
   can accurately match fragments.`);
        console.warn(
          'Could not find __typename on Fragment ',
          typeCondition,
          obj,
        );
        console.warn(
          `DEPRECATION WARNING: using fragments without __typename is unsupported behavior ` +
            `and will be removed in future versions of Apollo client. You should fix this and set addTypename to true now.`,
        );

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
    // difference, so we warn the user, but still try to match it (backcompat).
    warnOnceInDevelopment(
      `You are using the simple (heuristic) fragment matcher, but your queries contain union or interface types.
     Apollo Client will not be able to able to accurately map fragments.` +
        `To make this error go away, use the IntrospectionFragmentMatcher as described in the docs: ` +
        `http://dev.apollodata.com/react/initialization.html#fragment-matcher`,
      'error',
    );

    context.returnPartialData = true;
    return true;
  }
}

export class IntrospectionFragmentMatcher implements FragmentMatcherInterface {
  private isReady: boolean;
  private possibleTypesMap: PossibleTypesMap;

  constructor(options?: {
    introspectionQueryResultData?: IntrospectionResultData;
  }) {
    if (options && options.introspectionQueryResultData) {
      this.possibleTypesMap = this.parseIntrospectionResult(
        options.introspectionQueryResultData,
      );
      this.isReady = true;
    } else {
      this.isReady = false;
    }

    this.match = this.match.bind(this);
  }

  public match(
    idValue: IdValue,
    typeCondition: string,
    context: ReadStoreContext,
  ) {
    if (!this.isReady) {
      // this should basically never happen in proper use.
      throw new Error(
        'FragmentMatcher.match() was called before FragmentMatcher.init()',
      );
    }

    const obj = context.store[idValue.id];

    if (!obj) {
      return false;
    }

    if (!obj.__typename) {
      throw new Error(
        `Cannot match fragment because __typename property is missing: ${JSON.stringify(
          obj,
        )}`,
      );
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

  private parseIntrospectionResult(
    introspectionResultData: IntrospectionResultData,
  ): PossibleTypesMap {
    const typeMap: PossibleTypesMap = {};
    introspectionResultData.__schema.types.forEach(type => {
      if (type.kind === 'UNION' || type.kind === 'INTERFACE') {
        typeMap[type.name] = type.possibleTypes.map(
          implementingType => implementingType.name,
        );
      }
    });
    return typeMap;
  }
}
