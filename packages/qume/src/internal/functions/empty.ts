import { WithState } from "../base"
import { emptyPack } from "../Pack"
import { State } from "../State"
import { Context } from "../Context"
import * as _ from 'lodash'

const EMPTY = 'EMPTY'

export type Empty<S, K, R> = { type: typeof EMPTY } & WithState<S, K, R>

export function empty<S, K, R>(): Empty<S, K, R> {

  return {
    type: EMPTY,
    locale: '',
    keys: Context.emptyKeys(),
    state: () => State.pure(emptyPack()),
    value: Context.emptyValue(),
  }
}
