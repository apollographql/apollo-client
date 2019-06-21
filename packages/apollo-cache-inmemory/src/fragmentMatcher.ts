import { isTest, IdValue } from 'apollo-utilities';
import { invariant } from 'ts-invariant';

import {
  ReadStoreContext,
  FragmentMatcherInterface,
  PossibleTypesMap,
  IntrospectionResultData,
} from './types';

let haveWarned = false;

function shouldWarn() {
  const answer = !haveWarned;
  /* istanbul ignore if */
  if (!isTest()) {
    haveWarned = true;
  }
  return answer;
}

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
  ): boolean | 'heuristic' {
    const obj = context.store.get(idValue.id);
    const isRootQuery = idValue.id === 'ROOT_QUERY';

    if (!obj) {
      // https://github.com/apollographql/apollo-client/pull/3507
      return isRootQuery;
    }

    const { __typename = isRootQuery && 'Query' } = obj;

    if (!__typename) {
      if (shouldWarn()) {
        invariant.warn(`You're using fragments in your queries, but either don't have the addTypename:
  true option set in Apollo Client, or you are trying to write a fragment to the store without the __typename.
   Please turn on the addTypename option and include __typename when writing fragments so that Apollo Client
   can accurately match fragments.`);
        invariant.warn(
          'Could not find __typename on Fragment ',
          typeCondition,
          obj,
        );
        invariant.warn(
          `DEPRECATION WARNING: using fragments without __typename is unsupported behavior ` +
            `and will be removed in future versions of Apollo client. You should fix this and set addTypename to true now.`,
        );
      }

      return 'heuristic';
    }

    if (__typename === typeCondition) {
      return true;
    }

    // At this point we don't know if this fragment should match or not. It's
    // either:
    //
    // 1. (GOOD) A fragment on a matching interface or union.
    // 2. (BAD) A fragment on a non-matching concrete type or interface or union.
    //
    // If it's 2, we don't want it to match. If it's 1, we want it to match. We
    // can't tell the difference, so we warn the user, but still try to match
    // it (for backwards compatibility reasons). This unfortunately means that
    // using the `HeuristicFragmentMatcher` with unions and interfaces is
    // very unreliable. This will be addressed in a future major version of
    // Apollo Client, but for now the recommendation is to use the
    // `IntrospectionFragmentMatcher` when working with unions/interfaces.

    if (shouldWarn()) {
      invariant.error(
        'You are using the simple (heuristic) fragment matcher, but your ' +
          'queries contain union or interface types. Apollo Client will not be ' +
          'able to accurately map fragments. To make this error go away, use ' +
          'the `IntrospectionFragmentMatcher` as described in the docs: ' +
          'https://www.apollographql.com/docs/react/advanced/fragments.html#fragment-matcher',
      );
    }

    return 'heuristic';
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
    invariant(
      this.isReady,
      'FragmentMatcher.match() was called before FragmentMatcher.init()',
    );

    const obj = context.store.get(idValue.id);
    const isRootQuery = idValue.id === 'ROOT_QUERY';

    if (!obj) {
      // https://github.com/apollographql/apollo-client/pull/4620
      return isRootQuery;
    }

    const { __typename = isRootQuery && 'Query' } = obj;

    invariant(
      __typename,
      `Cannot match fragment because __typename property is missing: ${JSON.stringify(
        obj,
      )}`,
    );

    if (__typename === typeCondition) {
      return true;
    }

    const implementingTypes = this.possibleTypesMap[typeCondition];
    if (implementingTypes && implementingTypes.indexOf(__typename) > -1) {
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
