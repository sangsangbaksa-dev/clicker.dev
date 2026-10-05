"use client"

import { useId } from "react"

type Props = {
  size?: number
  className?: string
}

/** Forge / dock lock — iron body, cyan core keyhole, matches Aurelia hub chrome. */
export function ClickerLockMark({ size = 14, className = "clicker-lock-mark" }: Props) {
  const raw = useId()
  const uid = raw.replace(/:/g, "")

  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      aria-hidden
      focusable="false"
    >
      <defs>
        <linearGradient id={`${uid}-shackle`} x1="12" y1="4" x2="12" y2="12" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#e8f0ff" />
          <stop offset="42%" stopColor="#9eb0cc" />
          <stop offset="100%" stopColor="#5a6478" />
        </linearGradient>
        <linearGradient id={`${uid}-body`} x1="6" y1="11" x2="18" y2="21" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#5c6d88" />
          <stop offset="38%" stopColor="#2e384c" />
          <stop offset="100%" stopColor="#121820" />
        </linearGradient>
        <linearGradient id={`${uid}-bevel`} x1="12" y1="11" x2="12" y2="14.5" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#b8d4ff" stopOpacity="0.45" />
          <stop offset="100%" stopColor="#b8d4ff" stopOpacity="0" />
        </linearGradient>
        <radialGradient id={`${uid}-key`} cx="12" cy="15.6" r="2.2" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#e8ffff" />
          <stop offset="55%" stopColor="#5ce8ff" />
          <stop offset="100%" stopColor="#1a8aa8" stopOpacity="0.2" />
        </radialGradient>
        <filter id={`${uid}-glow`} x="-80%" y="-80%" width="260%" height="260%">
          <feGaussianBlur stdDeviation="1.1" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      <path
        d="M7.25 11.2V8.4a4.75 4.75 0 0 1 9.5 0v2.8"
        fill="none"
        stroke={`url(#${uid}-shackle)`}
        strokeWidth="2.35"
        strokeLinecap="round"
      />
      <path
        d="M6.2 11h11.6c.9 0 1.6.7 1.6 1.6v7.8c0 .9-.7 1.6-1.6 1.6H6.2c-.9 0-1.6-.7-1.6-1.6v-7.8c0-.9.7-1.6 1.6-1.6z"
        fill={`url(#${uid}-body)`}
        stroke="#1a2230"
        strokeWidth="0.65"
      />
      <path
        d="M6.8 11.5h10.4v2.8H6.8z"
        fill={`url(#${uid}-bevel)`}
        opacity="0.55"
      />
      <circle cx="12" cy="15.55" r="1.45" fill={`url(#${uid}-key)`} filter={`url(#${uid}-glow)`} />
      <path
        d="M12 16.95v2.35"
        stroke="#9ef4ff"
        strokeWidth="1.15"
        strokeLinecap="round"
        opacity="0.88"
      />
      <path
        d="M7.4 12.2h9.2"
        stroke="#ffffff"
        strokeOpacity="0.12"
        strokeWidth="0.5"
      />
    </svg>
  )
}
