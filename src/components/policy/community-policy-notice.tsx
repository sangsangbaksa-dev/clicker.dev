import {
  COMMUNITY_POLICY_ITEMS,
  COMMUNITY_POLICY_SIGNUP_INTRO,
  COMMUNITY_POLICY_SUMMARY,
  COMMUNITY_POLICY_TITLE,
} from "@/domain/services/community-policy"

const boxClass =
  "rounded-md border border-border bg-muted/40 px-3 py-2.5 text-sm leading-6 text-foreground"

export function CommunityPolicyNotice({ variant }: { variant: "signup" | "feed" }) {
  if (variant === "feed") {
    return <p className={boxClass}>{COMMUNITY_POLICY_SUMMARY}</p>
  }

  return (
    <div className={boxClass} role="note" aria-label={COMMUNITY_POLICY_TITLE}>
      <p className="font-medium">{COMMUNITY_POLICY_TITLE}</p>
      <p className="mt-1.5 text-xs leading-5 text-muted-foreground">
        {COMMUNITY_POLICY_SIGNUP_INTRO}
      </p>
      <ul className="mt-2 list-inside list-disc space-y-1 text-xs leading-5 text-muted-foreground">
        {COMMUNITY_POLICY_ITEMS.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
  )
}
