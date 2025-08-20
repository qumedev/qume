import { WithState } from "../base"
import { ETF } from "../etf"
import { emptyPack, flatMapPack, singlePack, Pack, setEntryValue } from "../Pack"

const SELECT = 'SELECT'
export type Select<S, K, R> = { type: typeof SELECT } & WithState<S, K, R>


export function select<S, K, R extends {}>(prev: ETF<S, K, R>, fieldName: keyof R): Select<S, K, R[keyof R]> {
  const select0 = flatMapPack<K, K, R, R[keyof R]>(
    entry => !entry.deleted && fieldName in entry.value ?
      [setEntryValue(entry, entry.value[fieldName])] : emptyPack()
  )

  return {
    type: SELECT,
    locale: prev.locale,
    state: path => prev.state(path).map(select0),
    keys: path => prev.keys(path),
    value: path => keys => prev.value(path)(keys).map(select0)
  }
}
