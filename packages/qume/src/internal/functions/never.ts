import { WithState } from "../base"
import { emptyPack } from "../Pack"
import { Context } from "../Context"
import { State } from "../State"

const NEVER = 'NEVER'

export type Never<S, K, R> = { type: typeof NEVER } & WithState<S, K, R>

export function never<S, K, R>(): Never<S, K, R> {
  return {
    type: NEVER,
    locale: '',
    state: () => State.pure(emptyPack()),
    keys: Context.emptyKeys(),
    value: Context.emptyValue()
  }
}