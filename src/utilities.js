import { escapeIdentifier } from "./postgres.js"

// expand(3, 2) returns "($1, $2), ($3, $4), ($5, $6)"
export function expand(rowCount, columnCount, startAt = 1) {
  let index = startAt
  return Array(rowCount)
    .fill(0)
    .map(
      (v) =>
        `(${Array(columnCount)
          .fill(0)
          .map((v) => `$${index++}`)
          .join(', ')})`
    )
    .join(', ')
}

// flatten([[1, 2], [3, 4]]) returns [1, 2, 3, 4]
export function flatten(arr) {
  const newArr = []
  arr.forEach((v) => {
    v.forEach((p) => newArr.push(p))
  })
  return newArr
}

// ['foo', 'bar'] to ("foo", "bar")
export function columns(data) {
  const cols = []
  data.forEach((key) => {
    cols.push(escapeIdentifier(key))
  })
  return `(${cols.join(', ')})`
}

export function _log(...args) {
  console.log(`[${new Date().toLocaleString()}]`, ...args)
}
