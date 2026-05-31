# mpump — SEO Audit & Findability Plan

_Date: 2026-05-31 · Domain: https://mpump.live · Report only — no code changed._

mpump is a browser groovebox / drum machine where "the beat lives in the link."
This audit mirrors the one done for the sibling project mdrone. Good news first:
**mpump is in much better shape than mdrone was** — it is indexed and ranks for
its brand. The work here is consolidation and competitive growth, not rescue.

---

## Status — what shipped (2026-05-31)

**Phase 0 — homepage identity (done):**
- **De-cloaked the router** (`scripts/post-build.cjs`): the root stub now forwards
  *every* visitor — humans and crawlers alike — to `app.html`, preserving the
  share payload (`search`+`hash`). No referrer sniffing. _(C2)_
- **One canonical home**: root stub canonical → `https://mpump.live/` (was
  `landing.html`); `app.html` canonical → `/` (was self); `landing.html` now has a
  **self-canonical + `robots` meta** and its stale `og:url` (`landing-2.html`) is
  fixed. _(C1, C3, C4)_
- **`app.html` un-blocked in robots.txt** so its canonical→`/` is seen and it
  consolidates instead of floating as a thin indexed duplicate. _(C3)_
- **Sitemap**: added `landing.html`; removed `live-jam-live-set.html`.

**Phase 1 — on-page keywords (done):**
- `landing.html` `<title>` is now keyword-led ("Browser Drum Machine & Groovebox —
  Share Beats as Links | mpump"); description + hero lede now include **"drum
  machine"** and **"step sequencer"** (previously absent). H1 kept as the brand
  hero ("a beat that lives in a link") — keywords carried by title/lede/og.

**Phase 2 — subdomain strategy (decided):**
- `mloop.mpump.live` is **kept** as mloop's canonical home (no action). 
- `mdrone.mpump.live` already 301s to mdrone.org (2026-05-31).

**Also done:** removed all **live-jam-live-set** references (service is off) — the
page is deleted and nav links, CTAs, the sitemap entry, and the stale "Play live
too" bullet are gone.

**Still MANUAL (the real growth lever — see Phase 3/4 below):**
- **Off-page authority**: press pitches (CDM, MusicRadar, BPB, Synth Anatomy,
  llllllll.co), Show HN, relevant subreddits, GitHub repo topics. Confirmed by the
  Reddit caveat below — the current ranking is *borrowed*, not owned.
- **Google Search Console**: resubmit the sitemap, confirm the `app.html` thin
  entry drops out after the canonical/robots change.

---

## TL;DR

**What's working:**
- `mpump.live` **is indexed** — `site:mpump.live` returns the homepage and app.html.
- Ranks **#1** for `mpump browser groovebox`, and **page 1 (~#2)** for bare `mpump`
  (behind industrial-pump companies — see brand collision).
- It already has the thing mdrone lacks: a **4-URL sitemap with dedicated keyword
  landing pages** (`browser-groovebox.html`, `shareable-beat-links.html`) and a
  rich ~1,750-word `landing.html`. _(Note: `live-jam-live-set.html` was removed —
  that service is now off.)_

> **Caveat (important):** that top-of-results visibility is **borrowed from an
> external Reddit thread, not earned by mpump.live's own pages.** So the domain's
> own authority is still thin and the ranking is **fragile** — it rides on a page
> mpump doesn't control. This reframes the audit: on-page fixes alone won't move
> the needle; **off-page authority (Phase 3) is the primary lever.** It also makes
> the broken homepage-identity signals (below) more costly, because the little
> link equity Reddit sends is being split across `/`, `landing.html`, and
> `app.html` instead of concentrating on one canonical home.

**The real problems:**
1. **Same cloaking-shaped router at `/`** as mdrone: a referrer test sends search
   traffic to `landing.html` and everyone else to `app.html`. Serving Googlebot
   different content than users is against guidelines.
2. **Three URLs fight to be "the homepage"** — incoherent canonical/sitemap signals
   (`/`, `landing.html`, `app.html`). Details below.
3. **Not ranking for competitive head terms** — `browser groovebox` is owned by
   Tahti.studio (heavy press); `shareable beat links` is directly contested by
   HitGroove (same feature). mpump's landing pages don't surface for these yet.
4. **Brand collision** with industrial pump makers (mpumps.it, mpump.com,
   mpumpsprocess.com).

---

## How findability was tested (live Google, May 2026)

| Query | mpump result | Notes |
|---|---|---|
| `site:mpump.live` | `/` **and** `/app.html` indexed | also `mloop.mpump.live`, `mdrone.mpump.live` |
| `mpump browser groovebox` | **#1** mpump.live, #2 GitHub | brand owns this |
| `mpump` | page 1 (~#2) | #1 is MPUMPS-PROCESS (industrial pumps) |
| `browser groovebox online drum machine shareable beat link free` | **not in top 9** | Tahti, HitGroove, orDrumbox, 808303, WebSynths dominate |

---

## The homepage-identity problem (the core technical issue)

Three URLs all represent "the homepage," sending mixed signals:

| URL | What it is | canonical | In sitemap? | Indexed? |
|---|---|---|---|---|
| `/` (`index.html`) | redirect stub | → `landing.html` | **yes** (prio 1.0) | yes |
| `landing.html` | the real content homepage (~1,750 words) | _none found_ | **no** | — |
| `app.html` | the SPA app shell | → **self** | no (robots-blocked) | **yes** (thin entry) |

Problems that fall out of this:

- **C1 — `/` canonicalises to `landing.html`, but `landing.html` is not in the
  sitemap** and the sitemap instead lists `/`. Google is told "the home is
  landing.html" by the canonical and "the home is `/`" by the sitemap.
- **C2 — Referrer-based router = cloaking.** `index.html` runs
  `location.replace(fromSearch ? "landing.html" : "app.html")`. Googlebot crawls
  with an **empty** referrer → it gets sent to `app.html`, which is
  `Disallow`-ed in robots.txt → dead end; indexing then leans entirely on the
  `/ → landing.html` canonical hint, which is a weaker signal than a real page.
- **C3 — `app.html` is indexed despite the robots `Disallow`.** A `Disallow`
  blocks *crawling*, not *indexing of a known URL*; because the router points
  humans at `app.html` and the page self-canonicalises, Google indexed it as a
  thin "mpump — Instant Browser Groovebox" entry that competes with the real
  homepage. `Disallow` + self-canonical is the wrong combination — it should be
  `noindex` (served, not blocked) or canonical-to-`/`, not both.
- **C4 — `landing.html` appears to have no self-`<link rel=canonical>` and no
  `robots` meta** (verify). The de-facto homepage doesn't assert its own identity.

**Recommended consolidation (pick the architecture, then I implement):**
Same fork as mdrone — and since mdrone chose **"keep launch, index a content
page"**, the consistent choice here is likely:
- De-cloak the router (no referrer branch).
- Pick **one** canonical home. Cleanest: make `landing.html` the indexed content
  page, list **it** in the sitemap, give it a self-canonical, and have `/` simply
  forward to `app.html` (canonical `/`) like mdrone now does — OR promote
  `landing.html` to be served at `/` directly. Either way: one URL = the content,
  one URL = the app, no third competitor.
- Stop `app.html` competing: serve it with `noindex` (and drop the `Disallow` so
  the `noindex` is actually seen), or canonical it to `/`.

---

## On-page gaps

- **`landing.html` never says "drum machine" (0×) or "sequencer" (0×).** It leans on
  "beat" (27×), "share" (20×), "groovebox" (4×). But "online drum machine" /
  "browser drum machine" / "beat maker" are far higher-volume queries than
  "groovebox" — and competitors win them. mpump should claim them on-page.
- **Titles are brand-poetic.** `landing.html`: _"mpump — A beat that lives in a
  link"_. Evocative, but a keyword-led variant (e.g. _"Browser Drum Machine &
  Groovebox — Share Beats as Links | mpump"_) would compete better. The dedicated
  pages already do this well (`browser-groovebox.html`, etc.) — apply the same to
  the home.
- **Verify `landing.html` has exactly one clear `<h1>`** containing a head keyword.

---

## Competitive landscape

| Keyword cluster | Who owns it | Difficulty | Verdict |
|---|---|---|---|
| `browser groovebox` | **Tahti.studio** (CDM, MusicRadar, BPB, Sonicstate press) | High | Hard head-on |
| `online drum machine` / `beat maker` | orDrumbox, HitGroove, hiphopmakers lists | High volume, high comp | Long-tail in |
| `shareable beat link` / `remixable beat` | **HitGroove** markets the same feature | Medium | **Differentiate & win** |
| `808 / 303 / x0x browser groovebox` | 808303.studio, Endless Acid Banger | Niche | Skip |
| `collaborative beat / send a beat back changed` | mostly open | **Low** | **mpump's unique angle** |

mpump's genuine differentiator vs HitGroove/Tahti is **bidirectional collaboration**
— "open it, change it, send it back different." Lean the messaging and target
keywords there; it's the least contested and most on-brand.

---

## Plan (prioritized, no code yet)

### Phase 0 — Homepage identity (fixes C1–C4)
- [ ] Decide the architecture fork (de-cloak + one canonical home; options above).
- [ ] Make sitemap + canonical agree on a single home URL.
- [ ] Add `landing.html` to the sitemap (or serve it at `/`) and give it a
  self-canonical + `robots` meta.
- [ ] Stop `app.html` competing: `noindex` (and remove its `Disallow`) or
  canonical-to-`/`.
- [ ] Remove the referrer branch from `index.html` (no cloaking).

### Phase 1 — On-page keywords
- [ ] Work "drum machine", "online drum machine", "beat maker", "step sequencer"
  into `landing.html` naturally (currently absent).
- [ ] Keyword-lead the home `<title>`/`<h1>`; keep the poetic line as a subtitle.
- [ ] Consider a dedicated `online-drum-machine.html` landing page (the term
  outweighs "groovebox" in search volume) — extends the existing page pattern.

### Phase 2 — Subdomain strategy (decided 2026-05-31)
- [x] `mloop.mpump.live` is **kept** as mloop's canonical home (no redirect).
- [x] `mdrone.mpump.live` 301s to mdrone.org (done 2026-05-31).

### Phase 3 — Off-page / authority (the real growth lever)
- [ ] Pitch the outlets that made Tahti famous: **CDM (cdm.link), MusicRadar,
  Bedroom Producers Blog, Synth Anatomy, Sonicstate, llllllll.co**. The
  "collaborative remixable beat link" hook is genuinely novel and press-friendly.
- [ ] **Show HN**, r/edmproduction, r/WeAreTheMusicMakers, r/drummachine,
  Product Hunt. GitHub repo `topics` (web-audio, groovebox, drum-machine,
  step-sequencer) pointing at mpump.live.

### Phase 4 — Measure (Google Search Console)
- [ ] Confirm the `app.html` thin entry drops out after the canonical/noindex fix.
- [ ] Track impressions for the "shareable/remixable/collaborative beat" cluster.
- [ ] Resubmit the corrected sitemap.

---

## Suggested keyword targets

**Primary (winnable, on-brand):** `shareable beat link`, `remixable beat`,
`collaborative beat maker`, `send a beat as a link`, `browser drum machine no install`
**Secondary:** `online drum machine browser free`, `browser groovebox`, `beat maker online`
**Brand:** `mpump` (already page 1 — reinforce with backlinks)
**Avoid as primary:** bare `groovebox` (Tahti owns it via press), `808 303` niche.

---

## Sources (live queries, May 2026)
- [mpump.live (indexed homepage)](https://mpump.live/) · [app.html thin entry](https://mpump.live/app.html)
- Competitors: [Tahti.studio coverage (CDM)](https://cdm.link/free-browser-groovebox-tahti-is-surprisingly-powerful-elektron-inspired-groovemaker/),
  [HitGroove (shareable beats)](https://hitgroove.com/), [orDrumbox](https://www.ordrumbox.com/),
  [808303.studio](https://synthanatomy.com/2020/10/808303-studio-a-free-303-808-based-groovebox-for-your-web-browser.html)
- Brand collision: [MPUMPS-PROCESS](https://www.mpumpsprocess.com/), [M Pumps](https://www.mpumps.it/)
