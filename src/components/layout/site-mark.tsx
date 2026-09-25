import Image from "next/image"

export function SiteMark({
  size = 32,
  alt = "",
  priority = false,
}: {
  size?: number
  alt?: string
  priority?: boolean
}) {
  return (
    <Image
      src="/brand/hwasan-mark.png"
      alt={alt}
      width={401}
      height={368}
      priority={priority}
      className="w-auto shrink-0"
      style={{ height: size }}
    />
  )
}
