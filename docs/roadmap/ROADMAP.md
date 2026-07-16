# Tickle the Pig — Roadmap & To-Do

> The single source of truth for what's in flight, blocked, and planned.
> Rendered to a browsable page via `node tools/build_roadmap.mjs`
> (→ `landing/plan/index.html`, gated). Ask Codex to reason over it with
> `tools/plan_ask.sh "your question"`. Last compiled: 2026-07-16.
> Status legend: 🔴 blocked-on-you · 🟡 staged/ready · 🟢 done · 🔵 planned · 💭 decision-needed

## 1. The 1.3 release train (build 151)

- 🟡 **Deliver build-151.ipa** — in Transporter; your Deliver click. v1.3, buildNumber 151.
- 🔴 **ASC: pull 1.3 from review** (if 150 was submitted) → select build 151 → resubmit.
- 🔴 **Re-seed the demo reviewer account** — it was found deleted + recreated blank; reviewers would land on an empty barn. Author as a ride-along migration on your go.
- 🟢 **Migrations pushed** — pair bonds + window shift + schedule config (legacy anchor seeded; live clients unaffected, verified).
- 🔴 **Release-day flip** (after 1.3 approved): `UPDATE app_settings SET value = jsonb_set(value,'{offset_secs}',to_jsonb(7200)) WHERE key='feeding_schedule';` → feedings move to 6–10 / 2–6 / 10–2 ET everywhere at once.

## 2. Blocked on you (external actions)

- 🔴 **Meta terms checkbox + Create ad account** → then I build the CF1 draft campaign (3 arms, US 18+, IG feed+Reels, all draft).
- 🔴 **Apple Ads card rejection** — "wrong country" error; try a physical (non-virtual/prepaid) card, else check account region in Account Settings → Overview.
- 🔴 **Apple Ads tax + payment** (Business Details) → then flip 4 built campaigns Paused→Active; apply promo credit.
- 🔴 **Create TikTok + X accounts** — grab @playticklethepig on both → unlocks the 33-post content batch + founder build-in-public.
- 🔴 **Instagram post 3 Share** — dig-it-back card staged with caption; your Share click.

## 3. Ready to push / commit (my side, on your word)

- 🟡 **Commit + push the working tree** — 3 days of work across both repos (knock-join, pair bonds, stickers, feeding fixes, landing page, Den tooling, feedback, content batch). Overdue for a checkpoint.
- 🟡 **feedback_den migration** (`20260745000000`) — additive, safe to push anytime; activates the Den doors server-side.

## 4. The 1.4 client lane (in tree, ships after 1.3)

- 🔵 **Rosie sticker pack** — 14 stickers, extension compiles clean. Needs one-time `com.broeking.ttp.stickers` App ID registration with Apple before the build.
- 🔵 **Pair Keepsakes + Strongest Pairs board** — UI (server already live).
- 🔵 **Feeding-clock fixes + server-authoritative schedule** — the +2h binary.
- 🔵 **Feedback UI** — settings whisper row + the occasional gentle nudge.

## 5. Decisions needed (💭 your call)

- 🟢 **Hearth Archive — REJECTED (2026-07-16).** Founder call against both recs: Pair Flames stay the 07-15 streak model (consecutive mutual days, sleep-to-wisp, banked longest). Logged in SKILL.md; flames brief ships unchanged.
- 🟢 **Mud-wrap stacking — decided (2026-07-16):** option 1 (extend duration, never multiply regen). Queued in the workflow-cleanup loop; migration authored there, rides the next push batch.
- 💭 **Sticker set** — approve the 14, or swap any (contact sheet delivered).
- 🟢 **Feedback nudge — decided (2026-07-16):** ships unflagged; cadence stays server-tunable.
- 🟢 **Settings-row glyph — decided (2026-07-16):** `bell`.

## 6. Cleanup / debt

- 🔴 **Two empty test crews in prod** — "The Bristle Sniffers", "The Muddy Diggers". DB op, needs your go.
- 🔵 **Harness glob gap** — smokes 50–53 silently skipped by the run glob; wire or fix (one-minute future task).

## 7. Marketing & growth

- 🟢 **Featuring nomination** — submitted.
- 🟡 **CF1 draft campaign** — built spec + creative, waits on Meta ad account.
- 🟡 **Apple Search Ads** — 4 campaigns built + paused, waits on tax/payment.
- 🔵 **Community home (Discord)** — recommended next infra piece after TikTok/X; the biggest passive-feedback + retention unlock.
- 🔵 **Feedback strategy** — DM 5 players this week (`marketing-setup/feedback-strategy.md`). The single highest-value research action.
- 🔴 **Lawyer pass** — kid-appeal/COPPA + loot-box review, REQUIRED before any paid scale.
- 🟢 **App Store link fix** — canonical link live everywhere (site, invite pages, UTM tooling).
- 🟢 **Notifications** — fixed (were silently dead since May) + locked server-only.

## 8. Future content (the Den — not active work)

The five ships (Shared Dig text-grid → herd-landing links → Monday recap →
Oinkograms → Sounder Supper) + the candidate library live in
`docs/ideas/the-den.md` and at ticklethepig.com/den. Not scheduled — the
idea vault, promoted one at a time through the grill → shape → build path.
