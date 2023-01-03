import { useLayoutEffect, useEffect } from 'react';
import { canUseLayoutEffect } from './canUse';

export const useIsomorphicLayoutEffect = canUseLayoutEffect
  ? useLayoutEffect
  : useEffect;
