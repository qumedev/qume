import { WithState, pathKey } from "../base"
import { ETF } from "../etf"
import * as _ from 'lodash'

const PREFIXED = 'PREFIXED'

export type Prefixed<S, K, R> = { type: typeof PREFIXED } & WithState<S, K, R>

export function prefixed<S, K, R>(prev: ETF<S, K, R>, prefix: string): Prefixed<S, K, R> {

  return {
    type: PREFIXED,
    locale: prev.locale,
    keys: path => prev.keys(pathKey(prefix, path)),
    state: path => prev.state(pathKey(prefix, path)),
    value: path => prev.value(pathKey(prefix, path)),
  }
}
