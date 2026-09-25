export default function MembersLoading() {
  return (
    <div className="mx-auto flex w-full max-w-lg flex-1 flex-col gap-6 px-4 py-10 sm:px-6">
      <div className="space-y-2">
        <div className="h-6 w-24 animate-pulse rounded-md bg-muted" />
        <div className="h-4 w-56 animate-pulse rounded-md bg-muted" />
      </div>
      <div className="h-28 animate-pulse rounded-md border border-border bg-muted/40" />
      <div className="h-28 animate-pulse rounded-md border border-border bg-muted/40" />
    </div>
  )
}
