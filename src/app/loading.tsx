import { Card, CardContent, CardHeader } from "@/components/ui/card"

function SkeletonBar({ className }: { className?: string }) {
  return <div className={`animate-pulse rounded-md bg-muted ${className ?? ""}`} aria-hidden />
}

export default function RootLoading() {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-4 py-6 sm:px-6">
      <div className="space-y-2 border-b border-border pb-4">
        <SkeletonBar className="h-7 w-24" />
        <SkeletonBar className="h-4 w-40" />
      </div>

      <Card className="gap-0 overflow-hidden py-0">
        <CardContent className="space-y-0 p-0">
          {Array.from({ length: 4 }).map((_, index) => (
            <div
              key={index}
              className="grid grid-cols-[2.5rem_minmax(0,1fr)_auto] items-center gap-x-4 border-b border-border px-4 py-3 last:border-b-0"
            >
              <SkeletonBar className="h-4 w-8" />
              <SkeletonBar className="h-4 w-32" />
              <SkeletonBar className="h-3 w-36" />
            </div>
          ))}
        </CardContent>
      </Card>

      <Card className="gap-0 py-0">
        <CardHeader className="border-b border-border py-4">
          <SkeletonBar className="h-5 w-16" />
          <SkeletonBar className="mt-2 h-4 w-56" />
        </CardHeader>
        <CardContent className="py-8">
          <SkeletonBar className="mx-auto h-4 w-48" />
        </CardContent>
      </Card>
    </div>
  )
}
