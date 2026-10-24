# Presentation

## What judges get

1. **A video under 3 minutes.** Most judges will only watch this, so it carries the story.
2. **The live site** (`lifeline-giving.vercel.app`): the landing page, then **See it live**, with no sign-up. It has to stay live until judging ends.
3. **The public GitHub repo** with an MIT licence, the README, the architecture picture, `.env.example` and `paypal-plan.md`.
4. **The Devpost write-up** (skeleton below).

## What to film

Everything in the video is real: real sandbox subscriptions, PayPal's own events, real model calls and a real email. Cora Reed's sandbox account has no funding, so PayPal's daily $1 charge fails every day at about **13:30–15:00 UTC**. Each failure opens a new rescue by itself.

**The story in one line:** a monthly gift fails silently. Lifeline catches it, the AI works out why, Tunde approves one fix, and the gift comes back.

| Time | Screen (what to click) | Voice-over |
| --- | --- | --- |
| 0:00–0:12 | Landing page: the heartbeat draws in, dips coral at "Cora's $1 gift failed", and the agent card starts working | "Monthly donors keep small nonprofits running. But when a monthly PayPal gift fails, nobody notices. Not the donor, and not the food bank." |
| 0:12–0:20 | Hover the "Why it matters" numbers (27% · 1 in 10) | "Monthly giving is over a quarter of online giving. And a gift that fails quietly is a donor lost by accident." |
| 0:20–0:32 | **See it live** → Rescues: KPIs, the giving pulse with the coral dip, "Needs you" | "This is Lifeline, at Larkhaven Food Bank. Every beat is a real PayPal gift. That dip is Cora: today PayPal couldn't charge her." |
| 0:32–0:40 | **Activity**: the "PayPal · verified" event at the top | "PayPal told Lifeline the moment it happened, with a signed event that Lifeline checks before trusting it." |
| 0:40–1:10 | Open Cora's rescue: the agent's plan, then its steps (Read the subscription · Read the failed payment · Checked the giving history), then the diagnosis and the fix cards | "A rescue opened by itself, and the agent took it. It wrote a plan, read Cora's subscription from PayPal and her giving history, and explained why it failed in one sentence. Every tool it has is read-only." |
| 1:10–1:25 | Point at the fix cards and the recommended one | "It suggests fixes PayPal can actually do: retry the charge, pause, lower the gift, or a kind note. Code drops anything PayPal can't carry out." |
| 1:25–1:45 | Open the note, edit one word, **Approve · Send a note**; cut to the email arriving in the test inbox | "Nothing happens without Tunde. He reads the note, changes a word, and approves. The note goes to Cora." |
| 1:45–2:10 | (After Cora re-adds funding, see setup) Next rescue → **Approve · Retry the charge now** → the rescue turns **Recovered**; the pulse gets a green beat | "When Cora updates her payment, one more approval retries the charge through PayPal's Subscriptions API. The gift comes back, and Lifeline marks it recovered." |
| 2:10–2:25 | Ask Lifeline in the rail: "How much have we recovered this month?", with its steps streaming | "Tunde can ask anything about his donors in plain words, answered from live data." |
| 2:25–2:38 | **Reports**: ask the AG Studio AI "Chart recovered money per week"; the chart lands | "And Reports, built on AG Studio, builds a chart from a sentence." |
| 2:38–2:50 | `/architecture` → **Trust**: the safety parts light up, then "What the AI can't do" | "Under the hood, code checks the AI at every step. It can't change a gift without approval, and it can't charge anyone twice." |
| 2:50–2:55 | Landing hero; end card: **Lifeline · lifeline-giving.vercel.app** | "Lifeline. Failed gifts, brought back." |

## Before recording

1. **A fresh failure.** Record on a day after Cora's charge has failed (check Rescues: "Needs you" shows Cora with "Fix ready").
2. **The recovery scene.** In the PayPal sandbox, log in as Cora's buyer account and add a card back. Then approve **Retry the charge now** on her open rescue. PayPal charges the outstanding balance and sends `PAYMENT.SALE.COMPLETED`, and the rescue turns Recovered. Film this once you're happy with the earlier scenes, because it uses up the open rescue. Remove the card again afterwards so the failures continue.
3. **The test inbox** is open in another tab for the email shot.
4. Open the live site once beforehand, so nothing is cold.
5. Record at **1440×900, browser zoom 100%, light mode**, with the cursor visible. Record each scene separately and cut them together.
6. Hide the bookmarks bar and close other tabs. Turn notifications off.

**Rules:**
- Say "sandbox" once, honestly.
- Burn in captions.
- No copyrighted music.
- No PayPal logo except where PayPal's own screens show it.
- Record the voice separately and lay it over the screen recording.

**Scenes checklist:** ☐ landing ☐ numbers ☐ rescues + pulse ☐ verified event ☐ agent working ☐ fix cards ☐ note approved + email ☐ retry → recovered ☐ Ask Lifeline ☐ Reports chart ☐ trust lens ☐ end card

## Devpost write-up skeleton

- **Inspiration:** monthly giving is 27% of nonprofits' online revenue (M+R 2026), yet 1 in 10 new monthly donors stop within two months, and some of those losses are failed payments the donor never meant.
- **What it does:** catch the failure, diagnose it, approve one fix, watch for the gift's return; plus Ask Lifeline and Reports.
- **How we built it:**
  - PayPal: Subscriptions v1 through the SDK from APIMatic's PayPal Context Plugin (get, capture, suspend, patch, cancel) and Webhooks (signature-verified).
  - OpenAI `gpt-5.4-mini`: a forced plan, read-only tools and a structured diagnosis, with fixes filtered in code.
  - AG Studio 3.0: the Reports page with its own agents, plus a custom heartbeat widget.
  - Next.js 16 on Vercel, Neon Postgres, Resend.
- **Challenges:**
  - Making a real failure happen in the sandbox: remove the buyer's funding on a daily plan.
  - PayPal can't move a billing date, so Lifeline never offers it.
  - The webhook simulator never delivered, so we used real events.
  - Writes that must never repeat: claim first, then re-read if the answer is lost.
- **Accomplishments:** a real failure handled end to end on the live site: verified event, rescue, diagnosis in 8.7 s, an approved note sent.
- **What's next:**
  - Many nonprofits through PayPal's partner onboarding.
  - Card-updater partners.
  - An eval suite for the agent.
- **Try it:** live link, repo, architecture page.
