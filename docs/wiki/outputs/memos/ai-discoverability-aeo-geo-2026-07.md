# AI discoverability for Tickle the Pig

**Date:** 2026-07-22  
**Scope:** Adapt Microsoft Advertising's AEO/GEO playbook to a single-developer iOS game. Primary sources only. No application-code changes.

## Decision in one sentence

Treat the App Store listing and `ticklethepig.com` as one factual product record: first make the public site crawlable and useful in plain HTML, then align App Store metadata and screenshots to the same current positioning, add modest structured data, and measure actual search/citation traffic instead of chasing speculative “GEO hacks.”

## Implementation status

The current working tree now implements the first technical slice in `landing/`: an evergreen root-page explanation, canonical and social metadata, visible answer-first sections, `MobileApplication` + `VideoGame` JSON-LD, `robots.txt` with explicit `OAI-SearchBot` access, and `sitemap.xml`. These changes are local until the existing Vercel site is deployed. App Store metadata, webmaster verification, screenshot updates, and measurement setup remain external follow-up work.

## What the linked guidance actually says

The X post appears to point to Microsoft's official playbook, [*From Discovery to Influence: A Guide to AEO and GEO*](https://about.ads.microsoft.com/content/dam/sites/msa-about/global/common/content-lib/pdf/from-discovery-to-influence-a-guide-to-aeo-and-geo.pdf).

Microsoft defines:

- **AEO** as making content usable by agents and assistants so they can find, understand, and present it.
- **GEO** as making content discoverable, trustworthy, and authoritative in generative-search environments.

The playbook's durable point is not that SEO has been replaced. It says the existing base remains: current, crawlable, structured content. Its three discovery inputs are crawled/indexed pages, structured feeds or APIs, and information visible on the live site. Its action framework is:

1. machine-readable data that agrees with the rendered page;
2. intent-rich, modular content with direct answers, lists, specs, and comparisons; and
3. factual trust signals such as genuine reviews and authoritative coverage.

Microsoft's [companion content guidance](https://about.ads.microsoft.com/en/blog/post/october-2025/optimizing-your-content-for-inclusion-in-ai-search-answers) makes this more applicable to a game website: align the title, meta description, and H1; use descriptive headings; answer likely questions directly; put important facts in HTML rather than only images, PDFs, tabs, or accordions; and avoid unsupported claims. It also says there is no guaranteed method for selection in an AI answer.

The retail-specific pieces do **not** transfer literally. Tickle the Pig has no product catalog, price inventory, GTINs, or merchant feed to optimize. The useful translation is:

| Retail playbook concept | Tickle the Pig equivalent |
| --- | --- |
| Product feed/catalog | App Store Connect metadata |
| Product detail page | Official game landing page |
| Product attributes | Platforms, price, genre, gameplay, social model, ads/IAP, age rating |
| Availability and offer | Live App Store URL and free-download status |
| Verified review data | Genuine App Store ratings/reviews, never invented testimonials |
| Category/use-case copy | “cozy pig game,” “virtual pet,” “dress-up,” “play with friends,” and other truthful intents |

That mapping is an inference for this project, not a claim made by Microsoft.

## Current-state audit

Checked on 2026-07-22:

- [`ticklethepig.com`](https://ticklethepig.com/) returns `200`, but the root page is the referral landing page from `landing/index.html`: title “Tickle the Pig — you've got a code,” invite-oriented description, and an invite-oriented H1. It is not a durable explanation of the game.
- The root page has Open Graph metadata, but no canonical link and no `SoftwareApplication`/`MobileApplication` JSON-LD.
- [`/robots.txt`](https://ticklethepig.com/robots.txt) and [`/sitemap.xml`](https://ticklethepig.com/sitemap.xml) both return `404`.
- The live [App Store listing](https://apps.apple.com/us/app/tickle-the-pig/id6740339848) is already indexable and exposes Apple-generated `SoftwareApplication` JSON-LD. Its live subtitle is “A pig sounder & a kind game.” Its description is an older alignment/blessings/bounties version of the product, while the repository's current domain model centers the cooperative Great Hunger, Sounders, Feeding, mood, collecting, and the seasonal loop.
- The live listing showed a 5.0 aggregate rating from 10 ratings at audit time. This is a promising trust signal, but too small and changeable to hard-code on the official site without a maintenance path.
- `docs/APP_STORE_LISTING.md` is also internally stale: it proposes “Cozy pig game with friends,” but its promotional text and description still say Sounders race rival squads. `CONTEXT.md` explicitly says the 2026-07-06 co-op rebuild removed Sounder-vs-Sounder war/league competition.

The immediate problem is therefore not a missing AI-only file. It is that the two authoritative descriptions a search or answer engine can retrieve—the official site and App Store page—do not yet provide one current, consistent explanation of the game.

## Prioritized plan

### P0 — Build one canonical, crawlable game page

Keep referral handling under `/r/<code>`, but make `/` the evergreen game page. This page should be useful even if no crawler or structured-data parser exists.

Minimum visible HTML:

- one direct H1 and a one- or two-sentence answer to “What is Tickle the Pig?”;
- a current description of the core loop: tickle Rosie, collect/equip cosmetics, visit friends, form a Sounder, and cooperate in seasonal activities;
- concise sections for “How does it play?”, “Can I play with friends?”, “Is it free?”, “Does it have ads?”, “What devices does it support?”, and “Who made it?”;
- a stable App Store link, real screenshots with useful alt text, and links to support/privacy;
- only claims that remain true in the shipped build.

This is the direct adaptation of Microsoft's “modular, citable content.” A visible FAQ is useful because it answers natural-language queries; FAQ schema itself is optional and should not be treated as the goal.

Use a self-referencing canonical URL and avoid splitting the same product explanation across both `docs/index.html` and `landing/index.html`. Google calls redirects and `rel="canonical"` strong canonicalization signals and sitemap inclusion a weaker supporting signal ([Google canonical guidance](https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls)).

### P0 — Make crawling explicit and observable

Add at the deployed site root:

- `robots.txt` that allows normal search crawling and references the sitemap;
- `sitemap.xml` containing the canonical public pages;
- verification for Google Search Console and Bing Webmaster Tools;
- sitemap submission to both tools.

Google says a sitemap identifies new/updated canonical URLs but does not guarantee indexing ([Google sitemap guidance](https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap)). Bing likewise describes sitemaps as a discovery mechanism ([Bing sitemap guidance](https://www.bing.com/webmasters/help/sitemaps-3b5cf6ed)).

For ChatGPT search inclusion, allow `OAI-SearchBot` and ensure the host/CDN does not block OpenAI's published crawler IPs. OpenAI says this is important for inclusion, while also saying ranking is not guaranteed ([ChatGPT Search](https://help.openai.com/en/articles/9237897-chatgpt-search.ejs), [publisher FAQ](https://help.openai.com/en/articles/12627856-publishers-and-developers-faq)). `GPTBot` is a separate training control: the project can allow `OAI-SearchBot` while disallowing `GPTBot` if that is the desired policy.

Do **not** make `llms.txt` a prerequisite. Google's official AI-search guidance says there are no special AI files or special schema needed; ordinary crawlability, index eligibility, useful text, internal links, and accurate structured data remain the foundation ([Google AI features guidance](https://developers.google.com/search/docs/appearance/ai-features)). OpenAI's published inclusion control is `OAI-SearchBot`, not `llms.txt`.

IndexNow is optional, not P0, for this small static site. It becomes useful when season/game pages change regularly. Bing recommends it for notifying participating engines when URLs are added, updated, or deleted, while explicitly noting that submission does not guarantee indexing ([Bing IndexNow](https://www.bing.com/indexnow/getstarted)).

### P0 — Reconcile App Store metadata with the shipped game

Apple says App Store search uses text relevance from the app title, subtitle, keywords, and primary category, plus behavior including downloads, ratings, and reviews. It also uses metadata to generate search-result app tags with LLMs ([App Store search](https://developer.apple.com/app-store/search/)).

Recommended next metadata pass:

1. Keep the name **Tickle the Pig**.
2. Prefer the repository's proposed subtitle **Cozy pig game with friends** over the live “A pig sounder & a kind game.” It explains genre and audience in ordinary search language. This is a hypothesis to test, not a guaranteed ranking win.
3. Rewrite the first paragraph and full description around the current shipped product. Remove dead war/rival-Sounder promises everywhere.
4. Make the first three screenshots explain the product without requiring the description: tickle/virtual-pet hero, Sounder/co-op play, and collecting/dress-up. Apple says the name, subtitle, and screenshots can appear directly in search results.
5. Review Apple's generated app tags in App Store Connect and deselect only inaccurate tags. Apple says tags are derived from metadata, AI, and human curation and currently display in the US ([app tags](https://developer.apple.com/help/app-store-connect/manage-app-information/manage-app-tags/)).

Apple advises against repeating words already present in the name, subtitle, or category and limits keywords to 100 characters. The draft keyword field currently repeats `pig`, `cozy`, `friends`, `casual`, and effectively `game`. A truthful non-duplicative test set could be:

```text
virtual pet,dress up,kawaii,collect,truffle,farm,relaxing,tapper,wholesome,social,idle
```

That is 86 characters, but it should be treated as a candidate based on product fit—not keyword-volume research. Promotional text does not affect App Store search ranking, so use it for timely season conversion copy rather than keyword stuffing. Apple also states that the App Store description is used for web-engine search results after release ([platform version metadata](https://developer.apple.com/help/app-store-connect/reference/app-information/platform-version-information)).

### P1 — Add accurate app structured data to the official site

Add JSON-LD that matches the visible page. A sensible type is `MobileApplication` co-typed with `VideoGame`, with fields such as:

- `name`: Tickle the Pig;
- `operatingSystem`: the actual minimum supported iOS version;
- `applicationCategory`: `GameApplication`;
- `offers.price`: `0` and `priceCurrency`: `USD`;
- canonical `url` and App Store `downloadUrl`;
- image/icon and creator/publisher;
- a concise description identical in meaning to the page.

Google supports software-app structured data and specifically says to co-type a game with a software-app type rather than using only `VideoGame` ([Google software-app structured data](https://developers.google.com/search/docs/appearance/structured-data/software-app)). Google also requires rating/review data for software-app rich-result eligibility. Do not fabricate or freeze this field: include an App Store aggregate rating only if the same rating is visibly attributed on the page and can be kept current. Otherwise accept that markup can clarify the entity without qualifying for that particular rich result.

Validate with Google's Rich Results Test and Bing's URL Inspection/markup tools. Structured data improves machine understanding; neither Google nor Bing promises a rich result or higher ranking ([Google structured-data guidelines](https://developers.google.com/search/docs/appearance/structured-data/sd-policies), [Bing structured-data guidance](https://www.bing.com/webmasters/help/marking-up-your-site-with-structured-data-3a93e731)).

### P1 — Publish a small set of answerable, evergreen pages

Do not start a high-volume SEO blog. Add pages only where the project has genuine first-party knowledge or a player need, for example:

- `/game` or the canonical homepage: complete game overview;
- `/how-to-play`: core loops and honest mechanics;
- `/season`: current Great Hunger/Feeding overview, updated when the season changes;
- `/support` and `/privacy`;
- optionally a compact press kit with creator identity, facts, screenshots, logo, and contact details.

Use descriptive page titles/H1s, short answer-first sections, lists, and real screenshots with alt text. Avoid putting the only explanation in a cinematic, image, PDF, or interactive demo. This follows both Microsoft's content guidance and Google's requirement that important content be available as text.

### P1 — Earn rather than manufacture trust

- Use Apple's normal in-app rating request at a satisfying moment, without gating or rewarding the score.
- Keep support/contact, creator identity, privacy policy, pricing, and ads/IAP claims consistent across the official site and stores.
- Create a useful press page and pursue genuine coverage from relevant indie/cozy-game outlets or creators; link to real coverage when earned.
- Never invent testimonials, “best” claims, certifications, review sentiment, or rating markup.

The current 10 ratings are useful but statistically fragile. Product quality and a respectful rating-request cadence matter more than adding decorative trust language.

### P2 — Test multiple search intents without muddying the default page

Apple's custom product pages can present different screenshots, previews, promotional text, deep links, and keyword assignments for distinct intents, with their own shareable URLs and analytics ([Apple custom product pages](https://developer.apple.com/app-store/custom-product-pages/)). Once the default listing is current, test no more than two or three truthful narratives:

- cozy virtual-pet/tickling;
- dress-up and collecting;
- playing/cooperating with friends.

Each page should show the corresponding feature in its first screenshots. Do not create variants for features that are feature-flagged, seasonal, or absent from the public build.

## Measurement

Establish a baseline before metadata or page changes, then review monthly rather than daily.

| Surface | Measure | Source |
| --- | --- | --- |
| App Store | impressions, product-page views, conversion rate, downloads, search source | App Store Connect App Analytics |
| Apple metadata experiments | conversion lift for icon/screenshot/preview variants | Product Page Optimization / custom product page analytics |
| Google | indexed pages, queries, impressions, clicks, rich-result validity | Search Console |
| Bing/Copilot | indexed pages, search queries, citations, cited URLs, grounding-query samples | Bing Webmaster Tools |
| ChatGPT | referrals containing `utm_source=chatgpt.com` | web analytics/server logs |

Bing's AI Performance dashboard reports citations and cited pages across supported Microsoft AI surfaces, but Microsoft warns these counts do not indicate answer placement, ranking, or authority ([Bing AI Performance](https://blogs.bing.com/webmaster/February-2026/Introducing-AI-Performance-in-Bing-Webmaster-Tools-Public-Preview)). Treat the data as diagnostic, not as a score to game.

For the App Store, Apple explicitly recommends monitoring impressions, downloads, and conversion by source type and notes that ratings/reviews can influence search ranking ([App Store search](https://developer.apple.com/app-store/search/)). Change one meaningful metadata/creative variable at a time where possible.

## Suggested implementation order

1. **Content truth pass:** define the one current, public two-sentence pitch from `CONTEXT.md` and reconcile `docs/APP_STORE_LISTING.md`.
2. **Homepage:** replace the invite-only root with the evergreen game page; preserve referral routes.
3. **Crawl plumbing:** canonical, `robots.txt`, `sitemap.xml`, Search Console, Bing Webmaster Tools, `OAI-SearchBot` policy.
4. **Store pass:** subtitle, description, keywords, generated tags, first three screenshots.
5. **Structured data:** add and validate app JSON-LD that exactly matches visible facts.
6. **Measurement baseline:** record current App Store/search numbers, then review after enough impressions accrue.
7. **Only then:** custom product pages, season/how-to-play pages, IndexNow, and earned-coverage outreach.

## Non-goals

- no separate “AI-optimized” copy that disagrees with what players see;
- no hidden bot-only text or schema-only claims;
- no keyword stuffing or duplicated App Store keyword terms;
- no mass-generated blog;
- no fabricated reviews, awards, or ratings;
- no claim that structured data, crawler access, or “GEO” guarantees recommendation.
