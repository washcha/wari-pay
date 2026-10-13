// Pure split calculation. Lives outside React so we can unit-test every edge
// case without rendering.
//
// Mental model:
//   - `customSplits[uid]` is a *manual* amount typed by the user. Truthy string
//     wins over auto distribution.
//   - `autoFilledUids` is the set of uids that should split the remainder
//     equally. A uid becomes auto when the user clicks "平均剩餘"; it leaves
//     the set the moment the user types an amount for that uid.
//   - Excluded members (not in `splitAmong`) are ignored but their stored
//     amounts and auto-flag are preserved — toggling them back restores state.

export function computeSplits({ amount, splitAmong, customSplits, autoFilledUids }) {
  const total = Number(amount) || 0

  const activeAutoUids = autoFilledUids.filter(uid =>
    splitAmong.includes(uid) && !customSplits[uid],
  )

  const manualSum = splitAmong.reduce((sum, uid) => {
    if (activeAutoUids.includes(uid)) return sum
    return sum + (parseFloat(customSplits[uid]) || 0)
  }, 0)

  const autoRemaining = Math.max(0, total - manualSum)
  const autoPerHead = activeAutoUids.length > 0
    ? Number((autoRemaining / activeAutoUids.length).toFixed(2))
    : 0

  const effectiveSplits = Object.fromEntries(splitAmong.map(uid => [
    uid,
    activeAutoUids.includes(uid)
      ? autoPerHead
      : (parseFloat(customSplits[uid]) || 0),
  ]))

  const allocated = splitAmong.reduce((sum, uid) => sum + effectiveSplits[uid], 0)
  const diff = Number((total - allocated).toFixed(2))

  const hasEmptySlot = splitAmong.some(uid =>
    !customSplits[uid] && !autoFilledUids.includes(uid),
  )

  return { effectiveSplits, allocated, diff, activeAutoUids, hasEmptySlot }
}
