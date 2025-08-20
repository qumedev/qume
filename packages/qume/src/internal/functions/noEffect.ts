
import { WithState } from "../base"
import { flatMapPack, singlePack, Pack, setEntryNoEffect } from "../Pack"
import { ETF } from "../etf"
import * as _ from 'lodash'

const NO_EFFECT = 'NO_EFFECT'

export type NoEffect<S, K, R> = { type: typeof NO_EFFECT } & WithState<S, K, R>

export function noEffect<S, K, R>(prev: ETF<S, K, R>): NoEffect<S, K, R> {

  const noEffect0 = flatMapPack<K, K, R, R>(
    entry => [setEntryNoEffect(entry, true)]
  )

  return {
    type: NO_EFFECT,
    locale: prev.locale,
    keys: prev.keys,
    state: path => prev.state(path).map(noEffect0),
    value: path => keys => prev.value(path)(keys).map(noEffect0)

  }
}
