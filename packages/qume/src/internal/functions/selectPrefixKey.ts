import { WithState } from "../base"
import { ETF } from "../etf"
import { mapPack, setEntryDeleted } from "../Pack";

const SELECT_PREFIX_KEY = 'SELECT_PREFIX_KEY'

export type SelectPrefixKey<S, K, R> = { type: typeof SELECT_PREFIX_KEY } & WithState<S, K, R>

export function selectPrefixKey<S, K, R>(prev: ETF<S, K, R>, prefixes: string | K | K[]): SelectPrefixKey<S, K, R> {
  const prefixArray = (Array.isArray(prefixes) ? prefixes : [prefixes]) as string[];

  // Function to check if a key matches any of the prefixes
  const matchesPrefix = (key: K): boolean => {
    if (typeof key !== 'string') return false;

    return prefixArray.some(prefix => {
      if (typeof prefix !== 'string') return false;
      return key === prefix || key.startsWith(prefix + '.');
    });
  };

  return {
    type: SELECT_PREFIX_KEY,
    locale: prev.locale,
    state: path => prev.state(path).map(mapPack(entry =>
      matchesPrefix(entry.key) ? entry : setEntryDeleted(entry)
    )),
    keys: path => prev.keys(path).map(keys => keys.filter(matchesPrefix)),
    value: path => keys => prev.value(path)(keys.filter(matchesPrefix))
  }
}
