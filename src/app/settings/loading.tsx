export default function SettingsLoading() {
  return (
    <div className="mx-auto flex w-full max-w-md flex-1 flex-col gap-4 px-4 py-6 sm:px-6">
      <div className="h-4 w-16 animate-pulse bg-muted" />
      <div className="h-5 w-12 animate-pulse bg-muted" />
      <div className="h-48 animate-pulse rounded-md border border-border bg-muted/30" />
    </div>
  )
}
