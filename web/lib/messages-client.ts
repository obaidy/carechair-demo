'use client';

import {useCallback} from 'react';
import {useMessages} from 'next-intl';
import {tx, type Messages} from '@/lib/messages';

export function useTx() {
  const messages = useMessages() as Messages;
  return useCallback(
    (key: string, fallback = '', vars?: Record<string, string | number | boolean | null | undefined>) =>
      tx(messages, key, fallback, vars),
    [messages]
  );
}
