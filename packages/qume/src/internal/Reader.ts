import * as _ from "lodash"

export class Reader<S, A> {

  constructor(readonly run: (s: S) => Promise<A>) { }

  static apply<S, A>(run: (s: S) => Promise<A>): Reader<S, A> { return new Reader(run) }
  static func<S, A>(run: (s: S) => A): Reader<S, A> { return Reader.apply(s => new Promise(r => r(run(s)))) }
  static pure<S, A>(a: A): Reader<S, A> { return Reader.func(() => a) }
  static ask<S>(): Reader<S, S> { return Reader.func((s) => s) }
  static inspect<S, A>(f: (s: S) => A): Reader<S, A> { return Reader.func((s) => f(s)) }
  static void<S>(): Reader<S, void> { return Reader.func(() => undefined) }

  // extract(): (s: S) => A {
  //   return s => this.run(s)[1
  // }

  static traverseArr<S, A, B>(arrA: A[], f: (a: A, k: number) => Reader<S, B>): Reader<S, B[]> {
    return _.reduce(arrA,
      (acc, a, k) => acc.flatMap(arrB =>
        f(a, k).map(b => arrB.concat([b]))
      ),
      Reader.pure<S, B[]>([])
    )
  }
  static traverseObj<S, A extends object, B>(objA: A, f: (a: A[keyof A], k: string) => Reader<S, B>): Reader<S, B[]> {
    return this.traverseArr(_.toPairs(objA), ([k, v]) => f(v, k))
  }

  flatMap<B>(f: (a: A) => Reader<S, B>): Reader<S, B> {
    return Reader.apply(async s => {
      const a = await this.run(s)
      return await f(a).run(s)
    })
  }
  flatTap(f: (a: A) => Reader<S, any>): Reader<S, A> {
    return this.flatMap(a => f(a).as(a))
  }

  map<B>(f: (a: A) => B): Reader<S, B> {
    return this.flatMap(v => Reader.pure(f(v)))
  }

  as<B>(b: B): Reader<S, B> {
    return this.flatMap(() => Reader.pure(b))
  }
  asF<B>(st: Reader<S, B>): Reader<S, B> {
    return this.flatMap(() => st)
  }

  inspect<B>(f: (s: S) => B): Reader<S, B> {
    return this.flatMap(() => Reader.inspect(f))
  }

}
