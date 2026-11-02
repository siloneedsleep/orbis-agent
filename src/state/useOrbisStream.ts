import { useSyncExternalStore } from 'react';
import { subscribeOrbis, getOrbisSnapshot } from './orbisBridge';
export function useOrbisStream() { return useSyncExternalStore(subscribeOrbis, getOrbisSnapshot); }
