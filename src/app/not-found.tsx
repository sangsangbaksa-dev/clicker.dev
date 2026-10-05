import Link from "next/link"

/** Match game void — avoid light FOUC and leftover school-project copy. */
export default function NotFound() {
  return (
    <div
      style={{
        display: "flex",
        minHeight: "100dvh",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 12,
        padding: "24px 20px",
        background: "#070B12",
        color: "#EAF4FF",
        textAlign: "center",
      }}
    >
      <h1 style={{ margin: 0, fontSize: 16, fontWeight: 600, letterSpacing: "0.04em" }}>
        페이지를 찾을 수 없습니다
      </h1>
      <p style={{ margin: 0, fontSize: 14, lineHeight: 1.6, opacity: 0.72 }}>
        주소가 올바르지 않습니다.
      </p>
      <Link
        href="/"
        style={{ marginTop: 8, fontSize: 14, fontWeight: 600, color: "#7EC8FF", textDecoration: "underline" }}
      >
        AURELIA CORE로 돌아가기
      </Link>
    </div>
  )
}
