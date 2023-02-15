import { useLayoutEffect, useEffect } from 'react';
import { canUseLayoutEffect } from '../../../utilities';

export const useIsomorphicLayoutEffect = canUseLayoutEffect
  ? useLayoutEffect
  : useEffect;
