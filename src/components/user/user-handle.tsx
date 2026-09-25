/** Display login id without triggering browser mailto / email autofill heuristics. */
export function UserHandle({ loginId }: { loginId: string }) {
  return (
    <span className="whitespace-nowrap" translate="no">
      {loginId}
    </span>
  )
}
