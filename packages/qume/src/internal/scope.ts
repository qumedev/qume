
import * as _ from "lodash"
import { Context, Storage } from "./Context"
import { ask as askETF } from "./functions/ask"
import { merge } from "./functions/merge"
import { map as mapETF } from "./functions/map"
import { join as joinETF } from "./functions/join"
import { never as neverETF } from "./functions/never"
import { runMain } from "./MainStore"
import { QueryTail } from "./QueryTail"
import { QueryTailImpl } from "./QueryTailImpl"



const kSingle = ''
export type KSingle = typeof kSingle

export type HasType = { type: string; }
export type HasId = { id: string; }
export type QueryByType<S, V> = Extract<S, { type: V }>

export const ActionSymbol = '_$ACTION'
export type ActionInput<I> = { type: typeof ActionSymbol, value: I, isAction: true }
export type QueryInput<S> = S


interface QueryTailFunc<S extends HasType, I> {
  <
    K1 extends keyof S,
    V extends S[K1],
    R extends QueryByType<S, V>
  >(byType: V): QueryTail<S, QueryInput<S>, KSingle, R>;
  <
    K1 extends keyof S,
    V extends S[K1],
    V2 extends S[K1],
    R extends QueryByType<S, V> | QueryByType<S, V2>
  >(byType: V, byType2?: V2): QueryTail<S, QueryInput<S>, KSingle, R>;
  <
    K1 extends keyof S,
    V extends S[K1],
    V2 extends S[K1],
    V3 extends S[K1],
    R extends QueryByType<S, V> | QueryByType<S, V2> | QueryByType<S, V3>
  >(byType: V, byType2?: V2, byType3?: V3): QueryTail<S, QueryInput<S>, KSingle, R>;
  <
    K1 extends keyof S,
    V extends S[K1],
    V2 extends S[K1],
    V3 extends S[K1],
    V4 extends S[K1],
    R extends QueryByType<S, V> | QueryByType<S, V2> | QueryByType<S, V3> | QueryByType<S, V4>
  >(byType: V, byType2?: V2, byType3?: V3, byType4?: V4): QueryTail<S, QueryInput<S>, KSingle, R>;
  <K, V1,>(query1: QueryTail<S, QueryInput<S>, K, V1>): QueryTail<S, QueryInput<S>, K, V1>;
  <K, V1, V2>(query1: QueryTail<S, QueryInput<S>, K, V1>, query2: QueryTail<S, QueryInput<S>, K, V2>): QueryTail<S, QueryInput<S>, K, V1 | V2>;
  <K, V1, V2, V3>(
    query1: QueryTail<S, QueryInput<S>, K, V1>,
    query2: QueryTail<S, QueryInput<S>, K, V2>,
    query3: QueryTail<S, QueryInput<S>, K, V3>
  ): QueryTail<S, QueryInput<S>, K, V1 | V2 | V3>;
  <K, V1, V2, V3, V4>(
    query1: QueryTail<S, QueryInput<S>, K, V1>,
    query2: QueryTail<S, QueryInput<S>, K, V2>,
    query3: QueryTail<S, QueryInput<S>, K, V3>,
    query4: QueryTail<S, QueryInput<S>, K, V4>
  ): QueryTail<S, QueryInput<S>, K, V1 | V2 | V3 | V4>;


  emptyContext: Context<S>
}

interface JoinStoreFunc<S extends HasType> {
  <R extends QueryObj<S, R>>(obj: R): QueryTail<S, QueryInput<S>, QueryObjKeys<R>, QueryObjJoin<R>>
}

interface ActionFunc<S extends HasType> {
  // <I, A>(f: (v: I) => A): QueryTail<S, ActionInput<Parameters<(v: I) => A>[0]>, KSingle, ReturnType<(v: I) => A>>
  <I, A>(f: (v: I) => A): QueryTail<S, ActionInput<[I]>, KSingle, ReturnType<(v: I) => A>>
  <I1, I2, A>(f: (v1: I1, v2: I2) => A): QueryTail<S, ActionInput<[I1, I2]>, KSingle, ReturnType<(v1: I1, v2: I2) => A>>
  <I1, I2, I3, A>(f: (v1: I1, v2: I2, v3: I3) => A): QueryTail<S, ActionInput<[I1, I2, I3]>, KSingle, ReturnType<(v1: I1, v2: I2, v3: I3) => A>>
  <I1, I2, I3, I4, A>(f: (v1: I1, v2: I2, v3: I3, v4: I4) => A): QueryTail<S, ActionInput<[I1, I2, I3, I4]>, KSingle, ReturnType<(v1: I1, v2: I2, v3: I3, v4: I4) => A>>
  <I1, I2, I3, I4, I5, A>(f: (v1: I1, v2: I2, v3: I3, v4: I4, v5: I5) => A): QueryTail<S, ActionInput<[I1, I2, I3, I4, I5]>, KSingle, ReturnType<(v1: I1, v2: I2, v3: I3, v4: I4, v5: I5) => A>>
  (): QueryTail<S, ActionInput<undefined>, KSingle, void>
}

interface NeverFunc<S extends HasType> {
  (): QueryTail<S, any, KSingle, any>
}


interface StoreFunc<S extends HasType> {
  <Q>(qu: Q): QueryObj<S, Q>
  <Q1, Q2>(qu1: Q1, qu2: Q2): QueryObj<S, Q1 & Q2>
  <Q1, Q2, Q3>(qu1: Q1, qu2: Q2, qu3: Q3): QueryObj<S, Q1 & Q2 & Q3>
  <Q1, Q2, Q3, Q4>(qu1: Q1, qu2: Q2, qu3: Q3, qu4: Q4): QueryObj<S, Q1 & Q2 & Q3 & Q4>
  <Q1, Q2, Q3, Q4, Q5>(qu1: Q1, qu2: Q2, qu3: Q3, qu4: Q4, qu5: Q5): QueryObj<S, Q1 & Q2 & Q3 & Q4 & Q5>
  <Q1, Q2, Q3, Q4, Q5, Q6>(qu1: Q1, qu2: Q2, qu3: Q3, qu4: Q4, qu5: Q5, qu6: Q6): QueryObj<S, Q1 & Q2 & Q3 & Q4 & Q5 & Q6>
  <Q1, Q2, Q3, Q4, Q5, Q6, Q7>(qu1: Q1, qu2: Q2, qu3: Q3, qu4: Q4, qu5: Q5, qu6: Q6, qu7: Q7): QueryObj<S, Q1 & Q2 & Q3 & Q4 & Q5 & Q6 & Q7>
  <Q1, Q2, Q3, Q4, Q5, Q6, Q7, Q8>(qu1: Q1, qu2: Q2, qu3: Q3, qu4: Q4, qu5: Q5, qu6: Q6, qu7: Q7, qu8: Q8): QueryObj<S, Q1 & Q2 & Q3 & Q4 & Q5 & Q6 & Q7 & Q8>
}


// export type QueryValue<S extends HasType, R> = R extends QueryTail<S, any, any, infer V> ? V : never
// export type QueryKey<S extends HasType, R> = R extends QueryTail<S, any, infer K, any> ? K : never
// export type QueryInput<S extends HasType, R> = R extends QueryTail<S, infer V, any, any> ? V : never

type UnwrapKey<T> = T extends { __key: infer K } ? K : never;
type UnwrapValue<T> = T extends { __value: infer V } ? V : never;
type UnwrapInput<T> = T extends { __input: infer I } ? I : never;
type UnwrapIsAction<T> = T extends { isAction: true } ? true : false;
type UnwrapInputValue<T> = T extends { __input: ActionInput<infer I> } ? I : never;
type UnwrapValueOrRecord<T> = ValueOrRecord<UnwrapKey<T>, UnwrapValue<T>>

export type ValueOrRecord<K, R> = K extends '' ? R : Record<any, R>
export type ValueOptOrRecord<K, R> = K extends '' ? R | undefined : Record<any, R>

export type InputValue<T> = T extends ActionInput<infer I> ? I : never;
export type ActionInputValueFunc<T> =
  UnwrapInputValue<T> extends readonly [infer First, ...infer Rest]
  ? (first: First, ...rest: Rest) => Promise<UnwrapValueOrRecord<T>>
  : (value?: UnwrapInputValue<T>) => Promise<UnwrapValueOrRecord<T>>



export type QueryObj<S extends HasType, R> = {
  [K in keyof R]: QueryTail<S, UnwrapInput<R[K]>, UnwrapKey<R[K]>, UnwrapValue<R[K]>>
}

export type QueryObjInputs<R> = { [K in keyof R]:
  UnwrapIsAction<UnwrapInput<R[K]>> extends true
  ? ActionInputValueFunc<R[K]>
  : UnwrapValueOrRecord<R[K]>
}

export type QueryObjKeys<R> = UnwrapKey<R[keyof R]>
export type QueryObjValues<R> = { [K in keyof R]: UnwrapValueOrRecord<R[K]> }
export type QueryObjJoin<R> = { [K in keyof R]: UnwrapValue<R[K]> }

export type QueryObjActions<R> = {
  [K in keyof R as UnwrapIsAction<UnwrapInput<R[K]>> extends true ? K : never]: ActionInputValueFunc<R[K]>
}

export type QueryRecord<R> = { [K in keyof R]: Record<string, UnwrapValue<R[K]>> }



export function scope<S extends HasType>() {

  function query<I, K, R extends QueryObj<S, R>>(
    arg1: string | QueryTail<S, I, K, any>,
    arg2?: string | QueryTail<S, I, K, any>,
    arg3?: string | QueryTail<S, I, K, any>,
    arg4?: string | QueryTail<S, I, K, any>
  ): QueryTail<S, any, any, any> {

    if (typeof arg1 == 'string') {
      const byTypes =
        _.filter([arg1, arg2, arg3, arg4], v => !_.isNull(v))
          .map(v => v as string)

      return QueryTailImpl.make(askETF(byTypes))
    } else if (QueryTailImpl.guard(arg1)) {

      return QueryTailImpl.make(merge<S, K, any>([
        ...(QueryTailImpl.guard<S, S, K>(arg1) ? [arg1.etf] : []),
        ...(QueryTailImpl.guard<S, S, K>(arg2) ? [arg2.etf] : []),
        ...(QueryTailImpl.guard<S, S, K>(arg3) ? [arg3.etf] : []),
        ...(QueryTailImpl.guard<S, S, K>(arg4) ? [arg4.etf] : []),
      ]))
    } else {
      throw new Error('Unimplemented')
    }
  }

  const join: JoinStoreFunc<S> = obj => QueryTailImpl.make(
    joinETF(_.mapValues(obj, v => v.etf) as any) as any
  )

  const action = (f?: (...args: any[]) => any) =>
    QueryTailImpl.make(
      mapETF(askETF<S, any>([ActionSymbol]), v => f && f(...v.value)),
      [],
      undefined,
      undefined,
      true
    )


  const never = <K, A>() => QueryTailImpl.make(neverETF<S, K, A>())

  function store<I, R extends QueryObj<S, R>>(
    arg1: QueryObj<S, any> | R,
    arg2: QueryObj<S, any> | R,
    arg3: QueryObj<S, any> | R,
  ): QueryObj<S, any> {

    const arr = [arg1, arg2, arg3].filter(st => !_.isEmpty(st))
    const storeRef = {} as QueryObj<S, any>
    return _.reduce(arr, (acc, st) => {
      if (_.isObject(st) && _.every(st as R, v => QueryTailImpl.guard(v).valueOf()))
        return _.reduce(st as R,
          (acc, qt, key) => _.merge(acc, { [key]: qt.inStore(storeRef, key) }),
          acc
        )
      else
        return _.merge(acc, st)
    }, storeRef)
  }

  query.emptyContext = Context.empty<S>()

  return {
    query: query as QueryTailFunc<S, QueryInput<S>>,
    join: join as JoinStoreFunc<S>,
    action: action as ActionFunc<S>,
    never: never as NeverFunc<S>,
    store: store as StoreFunc<S>,
    runMain: runMain,
  }
}
