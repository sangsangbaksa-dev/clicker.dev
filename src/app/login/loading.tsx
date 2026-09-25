export default function LoginLoading() {
  return (
    <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-4 px-4 py-10">
      <div className="mx-auto h-16 w-16 animate-pulse rounded-full bg-muted" />
      <div className="mx-auto h-5 w-20 animate-pulse rounded-md bg-muted" />
      <div className="h-56 animate-pulse rounded-md border border-border bg-muted/40" />
    </div>
  )
}
