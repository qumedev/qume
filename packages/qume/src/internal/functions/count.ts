import { WithState } from "../base"
import { ETF } from "../etf"
import { emptyPack } from "../Pack"
import { State } from "../State"
import { Context } from "../Context"

const COUNT = 'COUNT'
export type Count<S, K, R> = { type: typeof COUNT } & WithState<S, K, R>


export function count<S, K, R>(prev: ETF<S, K, R>): Count<S, K, number> {
  return {
    type: COUNT,
    locale: '',
    state: () => State.pure(emptyPack()),
    keys: Context.emptyKeys(),
    value: Context.emptyValue()
  }
}

