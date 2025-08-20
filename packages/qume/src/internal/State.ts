import * as _ from "lodash"

export class State<S, A> {

  constructor(
    readonly run: (s: S) => Promise<[S, A]>,
    readonly runA: (s: S) => Promise<A> = (s: S) => this.run(s).then(([_s, a]) => a),
    readonly runS: (s: S) => Promise<S> = (s: S) => this.run(s).then(([s]) => s)
  ) { }

  static apply<S, A>(run: (s: S) => Promise<[S, A]>): State<S, A> { return new State(run) }
  static func<S, A>(run: (s: S) => [S, A]): State<S, A> { return State.apply(s => new Promise(r => r(run(s)))) }
  static pure<S, A>(a: A): State<S, A> { return State.func((s) => [s, a]) }
  static ap<S, A>(aF: Promise<A>): State<S, A> { return State.apply(s => aF.then(a => [s, a])) }
  static ask<S>(): State<S, S> { return State.func((s) => [s, s]) }
  static inspect<S, A>(f: (s: S) => A): State<S, A> { return State.func((s) => [s, f(s)]) }
  static inspectF<S, A>(f: (s: S) => Promise<A>): State<S, A> { return State.apply((s) => f(s).then(a => [s, a])) }
  static modify<S>(...fs: ((s: S) => S)[]): State<S, void> { return State.func((s) => [_.flow(fs)(s), undefined]) }
  static void<S>(): State<S, void> { return State.func((s) => [s, undefined]) }

  static traverseArr<S, A, B>(arrA: A[], f: (a: A, k: number) => State<S, B>): State<S, B[]> {
    return _.reduce(arrA,
      (acc, a, k) => acc.flatMap(arrB =>
        f(a, k).map(b => arrB.concat([b]))
      ),
      State.pure<S, B[]>([])
    )
  }
  static traverseObj<S, A extends object, B>(objA: A, f: (a: A[keyof A], k: string) => State<S, B>): State<S, B[]> {
    return this.traverseArr(_.toPairs(objA), ([k, v]) => f(v, k))
  }

  flatMap<B>(f: (a: A) => State<S, B>): State<S, B> {
    return State.apply(async s => {
      const [st, a] = await this.run(s)
      return await f(a).run(st)
    })
  }
  flatTap(f: (a: A) => State<S, any>): State<S, A> {
    return this.flatMap(a => f(a).as(a))
  }

  map<B>(f: (a: A) => B): State<S, B> {
    return this.flatMap(v => State.pure(f(v)))
  }

  evalMap<B>(f: (a: A) => Promise<B>): State<S, B> {
    return this.flatMap(v => State.apply(s => f(v).then(b => [s, b])))
  }

  asF<B>(st: State<S, B>): State<S, B> {
    return this.flatMap(() => st)
  }
  as<B>(b: B): State<S, B> {
    return this.asF(State.pure(b))
  }
  void(): State<S, void> {
    return this.as(undefined)
  }

  inspect<B>(f: (s: S) => B): State<S, B> {
    return this.flatMap(() => State.inspect(f))
  }
}
