import { pathKey, WithState } from "../base"
import { Context } from "../Context";
import { ETF } from "../etf"
import { emptyPack, flatMapPack, mapPack, setEntryDeleted, setEntryKey } from "../Pack";
import { Reader } from "../Reader";
import { KSingle } from "../scope";

const SELECT_KEY = 'SELECT_KEY'

export type SelectKey<S, K, R> = { type: typeof SELECT_KEY } & WithState<S, K, R>

export function selectKey<S, K, R>(prev: ETF<S, K, R>, keyParts: string | K | K[]): SelectKey<S, KSingle, R> {

  // Compose the key from parts if array is provided
  const key = Array.isArray(keyParts)
    ? keyParts.join('.') as unknown as K
    : keyParts as K;

  const setEmptyKey = mapPack<K, KSingle, R, R>(entry => setEntryKey<KSingle, K, R>(entry, ''))

  return {
    type: SELECT_KEY,
    locale: prev.locale,

    state: path => prev.state(path)
      .map(flatMapPack(entry => entry.key !== key ? emptyPack<K, R>() : [entry]))
      .map(setEmptyKey),

    keys: () => Reader.pure(['']),
    value: path => () => prev.value(path)([key]).map(setEmptyKey)

  }
}
