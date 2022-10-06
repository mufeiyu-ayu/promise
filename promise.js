const PENDING = 'PENDING',
    FULFILLED = 'FULFILLED',
    REJECTED = 'REJECTED'

const resolvePromise = function (promise2, x, resolve, reject) {
    if (promise2 === x) {
        return reject(new TypeError('Chaining cycle detected for promise #<MyPromise>'))
    }

    let called = false
    if ((typeof x === 'object' && x !== null) || typeof x === 'function') {
        let then = x.then
        // 这里使用try的原因是访问x的then方法它有可能被劫持然后抛错
        // Object.defineProperty(x,'then',{throw new Error("this is a error")})
        try {
            if (typeof then === 'function') {
                then.call(
                    x,
                    (y) => {
                        if (called) return
                        called = true
                        resolvePromise(promise2, y, resolve, reject)
                    },
                    (r) => {
                        if (called) return
                        called = true
                        reject(r)
                    }
                )
            } else {
                resolve(x)
            }
        } catch (e) {
            if (called) return
            called = true
            reject(e)
        }
    } else {
        resolve(x)
    }
}

class MyPromise {
    constructor(excutor) {
        this.status = PENDING
        this.value = undefined
        this.reason = undefined
        this.onResolveCallbacks = []
        this.onRejectedCallbacks = []

        const resolve = (value) => {
            if (value instanceof MyPromise) {
                value.then(resolve, reject)
                return
            }

            if (this.status === PENDING) {
                this.status = FULFILLED
                this.value = value
                this.onResolveCallbacks.forEach((fn) => fn())
            }
        }

        const reject = (reason) => {
            if (this.status === PENDING) {
                this.status = REJECTED
                this.reason = reason
                this.onRejectedCallbacks.forEach((fn) => fn())
            }
        }

        try {
            excutor(resolve, reject)
        } catch (e) {
            reject(e)
        }
    }
    then(onFulfilled, onRejected) {
        onFulfilled = typeof onFulfilled === 'function' ? onFulfilled : (value) => value
        onRejected =
            typeof onRejected === 'function'
                ? onRejected
                : (reason) => {
                      throw reason
                  }

        let promise2 = new MyPromise((resolve, reject) => {
            if (this.status === FULFILLED) {
                setTimeout(() => {
                    try {
                        let x = onFulfilled(this.value)
                        resolvePromise(promise2, x, resolve, reject)
                    } catch (e) {
                        reject(e)
                    }
                })
            }

            if (this.status === REJECTED) {
                setTimeout(() => {
                    try {
                        let x = onRejected(this.reason)
                        resolvePromise(promise2, x, resolve, reject)
                    } catch (e) {
                        reject(e)
                    }
                })
            }

            if (this.status === PENDING) {
                this.onResolveCallbacks.push(() => {
                    setTimeout(() => {
                        try {
                            let x = onFulfilled(this.value)
                            resolvePromise(promise2, x, resolve, reject)
                        } catch (e) {
                            reject(e)
                        }
                    })
                })

                this.onRejectedCallbacks.push(() => {
                    setTimeout(() => {
                        try {
                            let x = onRejected(this.reason)
                            resolvePromise(promise2, x, resolve, reject)
                        } catch (e) {
                            reject(e)
                        }
                    })
                })
            }
        })
        return promise2
    }
    catch(callbackErros) {
        return this.then(null, callbackErros)
    }

    finally(finallyCallback) {
        return this.then(
            // value 和 reason 是上一个promise的值，我们需要缓存下来
            (value) => {
                return MyPromise.resolve(finallyCallback()).then(() => value)
            },
            (reason) => {
                return MyPromise.resolve(finallyCallback()).then(() => {
                    throw reason
                })
            }
        )
    }

    static resolve(value) {
        return new MyPromise((resolve, reject) => {
            resolve(value)
        })
    }

    static reject(reason) {
        return new MyPromise((resolve, reject) => {
            reject(reason)
        })
    }

    static all(promiseArr) {
        if (!isIterable(promiseArr)) {
            let type = typeof promiseArr
            throw TypeError(`${type} is not a iterable (cannot read property Symbol(Symbol.iterator))
    at Function.all (<anonymous>)`)
        }
        let resArr = [],
            idx = 0
        return new Promise((resolve, reject) => {
            promiseArr.map((promise, index) => {
                if (isPromise(promise)) {
                    promise.then((res) => {
                        formatArr(res, index, resolve)
                    }, reject)
                } else {
                    formatArr(promise, index, resolve)
                }
            })
        })

        function formatArr(value, index, resolve) {
            resArr[index] = value
            // if(resArr.length ===promiseArr.length) 在某些时刻不正确，比如数组最后一项先执行完 数组就为[empty,empty,value]
            if (++idx === promiseArr.length) {
                resolve(resArr)
            }
        }
    }

    static allSettled(promiseArr) {
        let resArr = [],
            idx = 0
        if (!isIterable(promiseArr)) {
            throw new TypeError(`${promiseArr} is not a iterable`)
        }
        return new Promise((resolve, reject) => {
            if (promiseArr.length === 0) {
                resolve([])
            }
            promiseArr.forEach((promise, index) => {
                if (isPromise(promise)) {
                    promise.then(
                        (value) => {
                            formatResArr('fulfilled', promise, index, resolve)
                        },
                        (reason) => {
                            formatResArr('rejected', reason, index, resolve)
                        }
                    )
                } else {
                    //普通值
                    formatResArr('fulfilled', promise, index, resolve)
                }
            })
        })

        function formatResArr(status, value, index, resolve) {
            switch (status) {
                case 'fulfilled':
                    resArr[index] = {
                        status,
                        value
                    }
                    break
                case 'rejected':
                    resArr[index] = {
                        status,
                        reason: value
                    }
                    break
                default:
                    break
            }
            if (++idx === promiseArr.length) {
                resolve(resArr)
            }
        }
    }

    static race(promiseArr) {
        if (!isIterable(promiseArr)) {
            let type = typeof promiseArr
            throw TypeError(`${type} is not a iterable (cannot read property Symbol(Symbol.iterator))
    at Function.all (<anonymous>)`)
        }
        return new Promise((resolve, reject) => {
            promiseArr.forEach((promise) => {
                if (isPromise(promise)) {
                    promise.then(resolve, reject)
                } else {
                    resolve(promise)
                }
            })
        })
    }
}

function isPromise(x) {
    if ((typeof x === 'object' && x !== null) || typeof x === 'function') {
        let then = x.then
        return typeof then === 'function'
    }
    return false
}

function isIterable(value) {
    return value !== null && value !== undefined && typeof value[Symbol.iterator] === 'function'
}
// MyPromise.defer = MyPromise.deferred = function () {
//     let dfd = {}
//     dfd.promise = new MyPromise((resolve, reject) => {
//         dfd.resolve = resolve
//         dfd.reject = reject
//     })
//     return dfd
// }
// module.exports = MyPromise
