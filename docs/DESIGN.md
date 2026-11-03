# Design: "Pulse"

**Goal:** within seconds, a judge should see a real product for one person. Sam runs fundraising at a small food bank. Monthly donors' gifts sometimes fail silently, and Lifeline catches each one and wins the donor back. The screen should be calm and warm, with one signature motif: the heartbeat.

Chosen on 22 Oct 2026 after two image-model rounds (Pulse, Harvest and Signal, then a merged round). The user picked the Pulse look and asked for the chat rail, the white-and-black avatar and real KPIs.

## Rules
- **Light, warm paper.**
  - Background: `--paper` #F8F5F0. Cards: white with a hairline `--line` #E7E1D8 border and a very soft shadow. Ink: #1A1414.
  - **One accent only: coral `--brand` #E5484D.** Use it for the heartbeat, failed gifts and the single primary action on a screen. If coral spreads, the app looks alarming.
  - **Sage `--recovered` #3E8E6A** is used only for money brought back.
- **The heartbeat is real data, never decoration.**
  - Each beat is one gift PayPal charged; its height is the amount.
  - A coral dip below the line is a failed gift; a sage beat is a recovered one.
  - Every beat can be hovered to show who, how much and what happened.
  - New beats arrive live.
- **Little text:**
  - short labels;
  - one-line rows;
  - the diagnosis in one sentence;
  - details folded away (Preview, Other fixes, a donor drawer).
- **Say what a number means.** Write "Monthly gift · $25", never a bare "$25 / month". Rescues show the yearly amount at stake ("$300 a year at stake").
- **Three columns:**
  - a slim sidebar (Rescues, Donors, Dashboard, Activity; "Connected to PayPal · Sandbox" at the bottom);
  - a wide main column;
  - a ~360px **chat rail, "Lifeline AI"**, on every page.

  The rail is where the AI talks: the morning brief, and the plan and live tool calls for each rescue, which fold into "N steps in Xs". On the Dashboard the rail is AG Studio's own agent chat, styled the same so it reads as one assistant. Main content always comes first; the rail can be collapsed.
- **Agent avatar:**
  - a white rounded body, with a black visor only across the eyes and soft glowing curved eyes inside it;
  - moods: idle, working (eyes scan), thinking (eyes narrow), worried (eyes droop when a gift fails) and happy (curved eyes when a donor is saved);
  - finishing: a small hop and one coral heartbeat ring pulsing out;
  - calm, slower motion in lists.
- **KPIs, all from real PayPal data:**
  - Monthly giving (what active donors have committed per month);
  - At risk (failed gifts not yet recovered);
  - Recovered (this month);
  - Recovery rate.
- **Never:**
  - coloured left-border stripes on cards;
  - gradients or glassmorphism;
  - robot or emoji icons;
  - invented numbers or invented facts.

  PayPal never shows a merchant a donor's card or bank, so Lifeline must not claim to know one. It knows only PayPal's failure code, the failed count, the retry date and the giving history.
- **Type:** Geist Sans, tabular figures for money, and Geist Mono only for tool names and IDs.
- **AG Studio** uses the same tokens through its theme params: paper background, coral and sage series, a hairline grid and Geist. It also has a custom heartbeat widget.
