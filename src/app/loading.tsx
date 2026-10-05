/** Route-level boot shell: match game void; slim shimmer, no Card FOUC. */
export default function RootLoading() {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-live="polite"
      aria-label="로딩 중"
      style={{
        display: "flex",
        minHeight: "100dvh",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 14,
        background: "#070B12",
        color: "#EAF4FF",
        letterSpacing: "0.06em",
        fontSize: 14,
      }}
    >
      <span>CORE를 깨우는 중…</span>
      <span
        aria-hidden
        style={{
          display: "block",
          width: 160,
          height: 3,
          borderRadius: 999,
          overflow: "hidden",
          background: "rgba(234, 244, 255, 0.12)",
        }}
      >
        <span
          style={{
            display: "block",
            width: "40%",
            height: "100%",
            borderRadius: 999,
            background: "linear-gradient(90deg, transparent, rgba(120, 200, 255, 0.85), transparent)",
            animation: "clicker-boot-shimmer 1.1s ease-in-out infinite",
          }}
        />
      </span>
      <style>{`@keyframes clicker-boot-shimmer{0%{transform:translateX(-120%)}100%{transform:translateX(320%)}}`}</style>
    </div>
  )
}
