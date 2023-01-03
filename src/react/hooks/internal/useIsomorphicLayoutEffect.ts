import { useLayoutEffect, useEffect } from 'react';
import { canUseLayoutEffect } from '../../../utilities/common/canUse';

export const useIsomorphicLayoutEffect = canUseLayoutEffect
  ? useLayoutEffect
  : useEffect;
