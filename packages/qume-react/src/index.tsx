import React, { useContext, useState, createContext, useEffect, useCallback, useMemo } from 'react'
import { HasType, InputValue, QueryObj, QueryTail, QueryObjActions, ValueOptOrRecord, ValueOrRecord, QueryObjValues } from 'qume';
import * as _ from "lodash"
import { MainStore } from 'qume';




// export class WebsocketEventSource {
//
//   public static make<S>(url: string): EventSource<S> {
//
//     // Initialize WebSocket with buffering and 1s reconnection delay
//     const ws = new WebsocketBuilder(url)
//       .withBuffer(new ArrayQueue())           // buffer messages when disconnected
//       .withBackoff(new ConstantBackoff(1000)) // retry every 1s
//       .build();
//
//     // Add event listeners
//     ws.addEventListener(WebsocketEvent.open, () => console.log("opened!"));
//     ws.addEventListener(WebsocketEvent.close, () => console.log("closed!"));
//
//     return {
//       publish: (event: S) => ws.send(JSON.stringify(event)),
//       subscribe: (cb) => ws.addEventListener(
//         WebsocketEvent.message,
//         (_i: Websocket, ev: MessageEvent) => { cb(JSON.parse(ev.data)) }
//       ),
//     }
//   }
// }



export type QumeContextType<S extends HasType> = {
  main: MainStore<S>,
};

const QumeContext = createContext<QumeContextType<any>>({
  main: new MainStore({}),
})


export const QumeProvider: React.FC<{
  main: MainStore<any>,
  children: React.ReactNode
}> = ({ main, children }) => {

  return (
    <QumeContext.Provider value={{ main }}>
      {children}
    </QumeContext.Provider>
  )
}


export function useStore<R>(
  st: R
): [QueryObjValues<R>, QueryObjActions<R>] {
  const values = useStoreValues(st);
  const actions = useStoreActions(st);

  return useMemo(() => [values, actions], [values, actions]);
}

export function useStoreActions<S extends HasType, R>(
  st: R
): QueryObjActions<R> {
  const ctx = useContext(QumeContext)

  return useMemo(() => ctx.main.actions(st as QueryObj<S, R>), [st]);
}

export function useStoreValues<S extends HasType, R>(
  st: R
): QueryObjValues<R> {
  const ctx = useContext(QumeContext)
  const [value, setValue] = useState<QueryObjValues<R>>({} as QueryObjValues<R>)

  useEffect(() => {
    ctx.main.listenStore(st as QueryObj<S, R>, setValue)

    return function () {
      ctx.main.unlistenStore(st as QueryObj<S, R>, setValue)
    }
  }, [])

  return value
}


export function useQuery<S extends HasType, I, K, A>(
  qt: QueryTail<S, I, K, A>
): ValueOptOrRecord<K, A> | undefined {
  const ctx = useContext(QumeContext)
  const [value, setValue] = useState<ValueOptOrRecord<K, A> | undefined>(undefined)

  useEffect(() => {
    ctx.main.listenQuery(qt, setValue)

    return function () {
      ctx.main.unlisten(qt, setValue)
    }
  }, [])

  return value
}

export function useAction<S extends HasType, I, K, R>(
  qt: QueryTail<S, I, K, R>
): (value?: InputValue<I>) => Promise<ValueOrRecord<K, R>> {
  const ctx = useContext(QumeContext)
  return useCallback((value?: InputValue<I>) => {
    return ctx.main.action(qt)(value as any)
  }, [ctx.main, qt])
}

export function usePublisher<S extends HasType>(): (event: S) => void {
  const ctx = useContext(QumeContext)
  return useCallback<(event: S) => void>(event => {
    ctx.main.publish(event)
  }, [ctx.main])
}

