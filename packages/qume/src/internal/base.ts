import { Pack } from "./Pack"
import { State } from "./State"
import { Reader } from "./Reader"
import { Context } from "./Context"

export type Val = number
export type Offset = number
export type Id = string
export type Path = string


export type StateFunc<S, K, R> = (path: Path) => State<Context<S>, Pack<K, R>>
export type KeysFunc<S, K> = (path: Path) => Reader<Context<S>, K[]>
export type ValueFunc<S, K, R> = (path: Path) => (keys: K[]) => Reader<Context<S>, Pack<K, R>>


export type WithState<S, K, V> = {
  locale: Path
  state: StateFunc<S, K, V>
  keys: KeysFunc<S, K>
  value: ValueFunc<S, K, V>
}

export const EXTRACT = 'EXTRACT'
export const TRANSFORM = 'TRANSFORM'
export const FOLD = 'FOLD'

export type ExtractorTerm<S, K, R> = { etf: typeof EXTRACT } & WithState<S, K, R>
export type TransformerTerm<S, K, R> = { etf: typeof TRANSFORM } & WithState<S, K, R>
export type FolderTerm<S, K, R> = { etf: typeof FOLD } & WithState<S, K, R>

export function pathKey<K0, K>(path: K0, key: K): K {
  if (key === '') return path as string as K
  else if (path === '') return key
  else return (path + '.' + key) as K
}

