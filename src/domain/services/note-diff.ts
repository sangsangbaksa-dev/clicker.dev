export function diffNotes(
  oldText: string,
  newText: string
): { added: string; removed: string } {
  if (oldText === newText) {
    return { added: "", removed: "" }
  }

  const oldLines = oldText.split("\n")
  const newLines = newText.split("\n")
  const { removed, added } = diffLines(oldLines, newLines)

  return {
    added: added.join("\n"),
    removed: removed.join("\n"),
  }
}

function diffLines(
  oldLines: string[],
  newLines: string[]
): { removed: string[]; added: string[] } {
  const m = oldLines.length
  const n = newLines.length
  const dp: number[][] = Array.from({ length: m + 1 }, () =>
    Array<number>(n + 1).fill(0)
  )

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (oldLines[i - 1] === newLines[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1])
      }
    }
  }

  let i = m
  let j = n
  const removed: string[] = []
  const added: string[] = []

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && oldLines[i - 1] === newLines[j - 1]) {
      i--
      j--
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      added.unshift(newLines[j - 1])
      j--
    } else {
      removed.unshift(oldLines[i - 1])
      i--
    }
  }

  return { removed, added }
}
