import * as React from 'react';
import equal from '@wry/equality';
import type {
  DocumentNode,
  WatchQueryFetchPolicy,
} from '../../../core/index.js';
import { skipToken, type SkipToken } from '../constants.js';
import { DocumentType, verifyDocumentType } from '../../parser/index.js';
import { invariant } from '../../../utilities/globals/index.js';

interface ValidatedOptions {
  fetchPolicy?: WatchQueryFetchPolicy | undefined;
  returnPartialData?: boolean;
}

// This hook is very specific to useSuspenseQuery and useBackgroundQuery since
// both hooks support the same validation. If either hook begins to deviate
// with the other in terms of the validation on options, it would be best to
// extract this function back into the respective hooks. For now, this rigid
// implementation is shared between both hooks to reduce duplication and
// unnecessary bundle size.
export function useValidateSuspenseHookOptions(
  query: DocumentNode,
  options: SkipToken | ValidatedOptions
) {
  if (__DEV__) {
    const ref = React.useRef<[DocumentNode, SkipToken | ValidatedOptions]>();

    if (equal(ref.current, [query, options])) {
      return;
    }

    ref.current = [query, options];

    verifyDocumentType(query, DocumentType.Query);

    if (options !== skipToken) {
      const { fetchPolicy } = options;

      validateFetchPolicy(fetchPolicy);
      validatePartialDataReturn(fetchPolicy, options.returnPartialData);
    }
  }
}

function validateFetchPolicy(
  fetchPolicy: WatchQueryFetchPolicy = 'cache-first'
) {
  const supportedFetchPolicies: WatchQueryFetchPolicy[] = [
    'cache-first',
    'network-only',
    'no-cache',
    'cache-and-network',
  ];

  invariant(
    supportedFetchPolicies.includes(fetchPolicy),
    `The fetch policy \`%s\` is not supported with suspense.`,
    fetchPolicy
  );
}

function validatePartialDataReturn(
  fetchPolicy: WatchQueryFetchPolicy | undefined,
  returnPartialData: boolean | undefined
) {
  if (fetchPolicy === 'no-cache' && returnPartialData) {
    invariant.warn(
      'Using `returnPartialData` with a `no-cache` fetch policy has no effect. To read partial data from the cache, consider using an alternate fetch policy.'
    );
  }
}
