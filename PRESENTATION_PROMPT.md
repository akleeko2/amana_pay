# Amana Pay — Master Prompt for a World-Class Pitch Deck (12 slides)

> Paste the block below into any AI deck generator (Gamma, Beautiful.ai, Tome, Canva AI, MS Copilot, or ChatGPT + slides).
> The deck is **fully in English** and has **exactly 12 slides**. The spoken pitch stays in Arabic in `PITCH_SCRIPT.md`.
> There is **no live-demo slide** — a short demo video is played **after** the deck. The last slide cues that video.
> Every slide maps 1:1 to a speaker: Adel (Product) 1–4 · Malek (Finance) 5–8 · Abdullah (Developer) 9–11 · all three 12.

---

## 🎯 THE PROMPT (copy everything inside the block)

```
ROLE: You are a senior brand & presentation designer who builds investor-grade Fintech pitch decks at the level of Stripe, Linear, Ramp, and Wise. Produce a visually stunning, cohesive deck of EXACTLY 12 slides for a startup called "Amana Pay".

============================================================
PRODUCT (ground truth — do not invent features)
============================================================
Amana Pay AUTOMATES CliQ payment confirmation for online stores in Jordan. It is a smart layer on top of JoPACC Open Finance.
- The pain: thousands of merchants accept CliQ, but confirming each payment is 100% MANUAL (customer sends a screenshot; merchant opens the bank app, searches, checks amount + sender). 5–30 minutes per order, human error, screenshot fraud, no scalability.
- The fix: Amana Pay confirms payments automatically in seconds via Open Finance.
- Trust fact: the MONEY NEVER PASSES THROUGH Amana Pay — funds go DIRECTLY from customer to merchant. We only READ and CONFIRM (non-custodial).
- Revenue model (do NOT change to a percentage commission): tiered SaaS monthly subscription (Starter 15, Growth 25, Enterprise 70 JOD/mo) PLUS a per-transaction matching fee that equals the EXACT dynamic fraction the buyer already paid (order 10.000 → buyer pays 10.024 → merchant matching fee = 0.024). Enterprise has no matching fee (unlimited + ERP).

============================================================
ART DIRECTION (make it beautiful — this matters most)
============================================================
Overall vibe: premium, dark, calm, high-contrast, lots of negative space. A Series-A Fintech deck, not a template.

COLOR SYSTEM:
- Background: near-black deep navy #0b0f14; secondary surface #10151d for cards.
- Primary accent: warm orange gradient #ff6a3d → #ffb020 (ONE hero highlight per slide — never overuse).
- Secondary accent: teal/cyan #35d0ba (confirmations, positive states, checkmarks).
- Text: primary off-white #eef2f6; muted #8b98a8. Hairline borders #26303c. Card radius 20px. Soft diffuse shadows.
- ONE subtle radial glow per slide background (orange OR teal) at ~12% opacity for depth.

TYPOGRAPHY:
- Headlines: modern geometric sans (Plus Jakarta Sans / Inter / Söhne feel), bold, tight letter-spacing (-2%), 44–60px.
- Body 18–22px. Numbers/metrics: tabular sans, extra-bold, oversized as a design element.
- Strict hierarchy: ONE headline, optional one-line subhead, then 3–5 short points MAX. Never a paragraph.

LAYOUT & GRID:
- 16:9, consistent 64px outer margin, 12-column grid.
- Each slide = ONE strong idea + ONE strong visual/diagram. Prefer asymmetric layouts (text one side, visual the other) over centered bullet lists.
- Reusable footer on every slide: left = "Amana Pay" wordmark (small); center = "0X / 12"; right = speaker name + role (muted).
- Icons: thin line icons, 1.8px stroke, rounded caps — NO emojis, NO clipart, NO stock photos. Diagrams and iconography only.
- Motion (if supported): gentle fade + 8px rise. No spinning, no bounce.

QUALITY BAR: pixel-perfect alignment, 8px spacing rhythm, every slide clearly part of the same family. Minimal text; let whitespace and one bold visual carry each slide.

============================================================
THE 12 SLIDES (exact content — match precisely)
============================================================

── SLIDE 1 — TITLE ──  (Adel Aqleh · Product Manager)
Centered wordmark on dark canvas with a single orange radial glow.
- Wordmark (huge): "Amana Pay"
- Subtitle: "Automated CliQ payment confirmation for online stores"
- Tagline (accent, small caps): "TRUST, DELIVERED IN SECONDS"
- Bottom: 3 team name cards — Adel Aqleh (Product Manager) · Malek Al-Hour (Finance & Accounting) · Abdullah Al-Harahsheh (Full Stack Developer).

── SLIDE 2 — THE PROBLEM ──  (Adel Aqleh)
Headline: "Confirming a CliQ payment is 100% manual"
Left: vertical 4-step manual-flow diagram (Customer pays via CliQ → sends screenshot → merchant opens bank app & searches → confirms by hand), styled slow/heavy with a small clock icon.
Right: 3 pain cards — Human Error · Screenshot Fraud · Doesn't Scale.
Hero metric (bottom, oversized): "5–30 min per order".

── SLIDE 3 — THE SOLUTION ──  (Adel Aqleh)
Headline: "A smart layer on Open Finance"
Left: 3-tier stacked architecture — [ Online Stores ] → [ Amana Pay — smart layer ] (orange highlight) → [ JoPACC Open Finance ] → [ All Banks ]. Caption: "One integration, not one per bank. Like Stripe, but for CliQ."
Right: a compact 3-second flow — Pay → Detect & Match (Open Finance) → Confirm + Webhook.

── SLIDE 4 — CUSTOMER EXPERIENCE ──  (Adel Aqleh)
Headline: "Fast for everyone, extra-safe when needed"
Two equal cards:
  Card A "Express" (teal edge): fast direct payment · zero friction · no account linking.
  Card B "Verified" (orange edge): one-time Consent · valid 90 days · silently reused across every merchant.
Footnote (muted): "Returning customers pay with zero extra steps."

── SLIDE 5 — BUSINESS MODEL & PRICING ──  (Malek Al-Hour · Finance & Accounting)
Headline: "Subscription + a fee the buyer already paid"
THREE pricing cards (middle highlighted "Most Popular", orange):
  • Starter — 15 JOD/mo · small & Instagram businesses
  • Growth (Most Popular) — 25 JOD/mo · mid-size online stores
  • Enterprise — 70 JOD/mo · unlimited reconciliations · ERP integration · no matching fee
Key-idea band (orange): "Matching fee per transaction = the exact dynamic fraction the buyer paid" with a tiny illustration: order 10.000 → buyer pays 10.024 → merchant fee 0.024.
Footnote (muted): "Non-custodial — funds go directly to the merchant."

── SLIDE 6 — UNIT ECONOMICS & BREAK-EVEN ──  (Malek Al-Hour)
Headline: "90%+ gross margin · break-even at ~11 stores"
Left: a small cost table — Open Finance API ~0.002 JOD/query · Cloud ~150 JOD/mo · SMS ~0.005 JOD · COGS ~5 fils/tx · Fixed ~300 JOD/mo.
Right: a clean break-even visual — "Margin/store ≈ 25 + (400 × 0.010) = 29 JOD/mo" and a big "300 ÷ 29 ≈ 11 stores" callout (orange), with "reached by month 3".
Big metric strip: "90%+ gross margin".

── SLIDE 7 — 3-YEAR PROJECTIONS & MERCHANT SAVINGS ──  (Malek Al-Hour)
Headline: "From 80 to 1,200 stores — 90% margins"
Main visual: a 3-year bar/line chart (Year 1 / 2 / 3) showing Revenue and Net Profit:
  Y1: 80 stores · Revenue 29,760 · Net 24,240 (93.5%)
  Y2: 350 stores · Revenue 142,800 · Net 115,200 (91.1%)
  Y3: 1,200 stores · Revenue 532,800 · Net 430,200 (89.1%)
Side callouts: "Year-1 = under 3% market share (conservative)" and a savings chip: "Merchant cost: 350 JOD (manual auditor) → 40 JOD (Amana Pay) = 88.5% saving; confirmation hours → under 2 minutes".

── SLIDE 8 — COMPLIANCE & RISK ──  (Malek Al-Hour)
Headline: "Regulated, non-custodial, risk-mitigated"
Top "Regulatory" band with three chips: Non-Custodial (no PSP license) · AISP under CBJ Open Finance · Explicit encrypted Consent + End-to-End encryption.
Bottom: a compact 4-row Risk → Mitigation matrix:
  Screenshot fraud → Smart Matching Engine (bank data, 5 factors)
  Overlapping transactions → Unique Dynamic Amount
  API downtime → Time-Window match + processing queue
  Data leakage → End-to-End encryption (no full account numbers stored)

── SLIDE 9 — SMART MATCHING ENGINE ──  (Abdullah Al-Harahsheh · Full Stack Developer)
Headline: "The Smart Matching Engine — our moat"
Sub: "How do we know THIS transfer belongs to THIS order?"
HERO VISUAL (most striking slide): "10.000 → 10.024" with ".024" in the orange gradient, labeled "Unique dynamic amount — the cornerstone (and the matching fee)."
Below: a horizontal row of 5 signal chips combining into one result: Dynamic Amount (primary) · Reference · Time Window · Balance Change · Sender Identity → ✓ Confirmed (teal).
Footnote (muted): "We moved beyond relying only on a reference number — the unique amount alone is enough."

── SLIDE 10 — TECHNICAL READINESS & TWO MODES ──  (Abdullah Al-Harahsheh)
Headline: "Production-ready — two matching modes"
Left "Production-Ready": full mock of JoPACC SDKs incl. JAdES (signature) & JWE (encryption); going live = swap Mock for the real SDK, no other code change.
Right "Two Modes" (small timeline/toggle):
  • Balance-Only (Today) — monitors merchant balance via Balances API.
  • Full Mode (Automatic) — activates when Transactions API ships; ~100% accuracy via sender IBAN matching.

── SLIDE 11 — SECURITY & WHY WE SCALE ──  (Abdullah Al-Harahsheh)
Headline: "Bank-grade security. One integration, every bank."
Left (security): every call digitally signed (JAdES) · sensitive data encrypted (JWE) · access by Consent · "We never read a screenshot — we read the bank directly."
Right (scale): one JoPACC integration = all banks; CBJ-regulated framework; new banks supported automatically.

── SLIDE 12 — VISION & THE ASK (+ demo cue) ──  (all three)
Cinematic, mostly empty, single orange glow.
Headline (huge): "Trust, delivered in seconds"
Vision line: "Start with CliQ in Jordan. Expand across MENA as each market opens its Open Finance."
A clear call-out box (orange border): "▶ Live demo video next" — signaling a short demo video plays right after this slide.
Bottom: "Thank you — ready for your questions" and the 3 names.

============================================================
FINAL INSTRUCTIONS
============================================================
- Output ALL 12 slides, same color system, type scale, footer, and spacing across every slide.
- Minimal text per slide (headline + up to 5 short points). Details are spoken.
- Visual peaks: Slide 6–7 (financial viability) and Slide 9 (matching engine).
- Do NOT create a live-demo slide; Slide 12 only cues the external demo video.
- Ready to present to a Fintech judging panel.
```

---

## 🧩 Quick usage notes

- **12 سلايد بالإنجليزي**؛ سكربت الكلام عربي في `PITCH_SCRIPT.md`.
- **بدون سلايد ديمو حي** — فيديو الديمو يُعرض بعد السلايد 12 (والسلايد 12 يمهّد له).
- **توزيع المتحدّثين:** عادل 1–4 · مالك 5–8 (التحليل المالي الكامل من الـ PDF) · عبدالله 9–11 · الثلاثة 12.
- **بدون حشو:** كل سلايد فكرة + visual واحد قوي؛ التفاصيل تُقال شفوياً.
- **الذروة البصرية:** سلايد 6–7 (الجدوى المالية) و9 (المطابقة).
```
