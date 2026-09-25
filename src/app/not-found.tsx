import Link from "next/link"

export default function NotFound() {
  return (
    <div className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-3 px-6 py-24 text-center">
      <h1 className="text-base font-semibold">페이지를 찾을 수 없습니다</h1>
      <p className="text-sm leading-6 text-muted-foreground">
        주소가 올바르지 않습니다.
      </p>
      <Link href="/" className="text-sm font-medium text-primary hover:underline">
        화산중 첫 화면
      </Link>
    </div>
  )
}
