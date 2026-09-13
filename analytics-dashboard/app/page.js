import { getOverview } from "../lib/data";
import { Rosie, GlyphSprite } from "./svg";

export const dynamic = "force-dynamic";

const fmt = (n) => (n ?? 0).toLocaleString("en-US");

function Glyph({ id }) {
  return (
    <span className="glyph">
      <svg>
        <use href={`#${id}`} />
      </svg>
    </span>
  );
}

// ACCENT_SAFE_FILLS (constants/theme.ts): the fills --accent clears 4.5:1 on.
// A caption on lilac / peach / rose-deep wears --ink instead.
const ACCENT_SAFE = new Set(["paper", "cream", "cream2", "rose", "sky", "sage", "sun"]);

function EmptyLine({ children }) {
  return (
    <div className="empty-state">
      <p className="empty-state__line">{children}</p>
    </div>
  );
}

// A panel's title mark: decorative, so it is hidden from the accessibility tree.
function PanelIcon({ id, color }) {
  return (
    <svg className="panel-icon" aria-hidden="true" style={{ color }}>
      <use href={`#${id}`} />
    </svg>
  );
}

// Tilt comes from .sticker-list on the grid — ROW_TILTS in turn, no raw degrees.
function Stat({ fill, glyph, num, lbl, sub }) {
  const cls = ["sticker", `sticker--${fill}`, "stat"];
  if (ACCENT_SAFE.has(fill)) cls.push("stat--accent-safe");
  return (
    <div className={cls.join(" ")}>
      <Glyph id={glyph} />
      <div className="num">{num}</div>
      <div className="lbl">{lbl}</div>
      {sub ? <div className="sub">{sub}</div> : null}
    </div>
  );
}

// "2026-06-08" -> { mo: "Jun"|null, d: "8" }. Show the month accent on the
// first cell and whenever the month rolls over.
const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
function dayLabel(iso, prevIso) {
  const [, m, d] = iso.split("-").map((x) => parseInt(x, 10));
  const prevM = prevIso ? parseInt(prevIso.split("-")[1], 10) : null;
  return { mo: prevM === m ? null : MONTHS[m - 1], d: String(d) };
}

// All three tints are ACCENT_SAFE_FILLS, so .pig .ph small keeps the accent.
const PIG_TINT = { happy: "sage", neutral: "cream", sad: "rose" };
const PIG_BAR = {
  happy: "var(--success-border)",
  neutral: "var(--fill-sun)",
  sad: "var(--fill-rose-deep)",
};

function PigCard({ name, happiness, band }) {
  // map the clamped [20,80] range onto a full-width bar for contrast
  const w = Math.max(0, Math.min(100, ((happiness - 20) / 60) * 100));
  return (
    <div className={`sticker sticker--${PIG_TINT[band]} pig`}>
      <div className="pname" title={name}>{name}</div>
      <div className="ph">
        {happiness}
        <small>{band}</small>
      </div>
      <div className="ptrack">
        <div className="pfill" style={{ width: `${w}%`, background: PIG_BAR[band] }} />
      </div>
    </div>
  );
}

function MoodRow({ label, value, total, color }) {
  const pct = total ? Math.round((value / total) * 100) : 0;
  return (
    <div className="mrow">
      <span className="ml">{label}</span>
      <div className="track">
        <div
          className="fill"
          style={{ width: `${Math.max(2, pct)}%`, background: color }}
        />
      </div>
      <span className="mval">
        {fmt(value)} <small>{pct}%</small>
      </span>
    </div>
  );
}

// WHIMSY.goblin / the neutral warm grey have no dedicated name in tokens.css
// yet (see the system ask); these are their exact values under the rarity
// stripe roles, so nothing here is a fresh hex.
const GOBLIN_GOLD = "var(--rarity-legendary-stripe)";
const NEUTRAL_GREY = "var(--rarity-common-stripe)";
const BAND_FILL = { angel: "var(--fill-lilac)", goblin: GOBLIN_GOLD, neutral: NEUTRAL_GREY };
const signed = (n) => (n > 0 ? `+${n}` : `${n}`);

function AlignChip({ score, band }) {
  return (
    <span className="tag align-chip" style={{ background: BAND_FILL[band] || NEUTRAL_GREY }} title={`alignment ${signed(score)}`}>
      {signed(score)}
    </span>
  );
}

// Ranked tickles / XP boards — each row carries the player's alignment chip.
function Leaderboard({ rows, unit }) {
  if (!rows || rows.length === 0) return <EmptyLine>No data yet.</EmptyLine>;
  return (
    <div className="lb sticker-list">
      {rows.map((r, i) => (
        <div className={"sticker lbrow" + (i === 0 ? " top" : "")} key={r.username + i}>
          <span className="rank">{i + 1}</span>
          <span className="who">
            {i === 0 ? (
              <svg className="who-icon" role="img" style={{ color: GOBLIN_GOLD }}>
                <title>Rank 1</title>
                <use href="#i-crown" />
              </svg>
            ) : null}
            <span className="nm">{r.username}</span>
          </span>
          <AlignChip score={r.align ?? 0} band={r.band || "neutral"} />
          <span className="pts">
            {fmt(r.value)}
            {unit ? ` ${unit}` : ""}
          </span>
        </div>
      ))}
    </div>
  );
}

// Alignment ranking — score IS the value, tinted by side.
function ScoreBoard({ rows, side }) {
  if (!rows || rows.length === 0)
    return <EmptyLine>No {side === "angel" ? "saints" : "goblins"} yet.</EmptyLine>;
  const glyph = side === "angel" ? "i-halo" : "i-goblin";
  return (
    <div className="lb sticker-list">
      {rows.map((r, i) => (
        <div className="sticker lbrow" key={r.username + i}>
          <span className="rank">{i + 1}</span>
          <span className="who">
            <svg
              className="who-icon"
              aria-hidden="true"
              style={{ color: side === "angel" ? "var(--fill-lilac-deep)" : GOBLIN_GOLD }}
            >
              <use href={`#${glyph}`} />
            </svg>
            <span className="nm">{r.username}</span>
          </span>
          <span className="pts">{signed(r.score)}</span>
        </div>
      ))}
    </div>
  );
}

// Tickles missed — wasted count + share of potential haul.
function WasteBoard({ rows }) {
  if (!rows || rows.length === 0) return <EmptyLine>No tickles missed yet.</EmptyLine>;
  return (
    <div className="lb sticker-list">
      {rows.map((r, i) => (
        <div className="sticker lbrow" key={r.username + i}>
          <span className="rank">{i + 1}</span>
          <span className="who"><span className="nm">{r.username}</span></span>
          <span className="pts">
            {fmt(r.wasted)}
            <small>{r.pct}% of haul</small>
          </span>
        </div>
      ))}
    </div>
  );
}

export default async function Page() {
  let data;
  try {
    data = await getOverview();
  } catch (e) {
    return (
      <div className="dashboard">
        <div className="wrap">
          <header className="head">
            <div className="title-wrap">
              <Rosie />
              <div>
                <div className="kicker">★ tickle the pig</div>
                <h1 className="text-display-lg">Analytics</h1>
              </div>
            </div>
          </header>
          <div className="sticker sticker--cream errpanel">
            <div className="kicker">couldn't load analytics</div>
            <pre>{String(e.message || e)}</pre>
            <p className="why">
              If this says the function doesn't exist, the analytics_overview
              migration hasn't been pushed yet.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const t = data.totals;
  const gen = new Date(data.generated_at).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
  const pushPct = Math.round((t.push_enabled / Math.max(1, t.users)) * 100);

  // ---- chart ----
  const chartSeries = [
    { name: "Signups", key: "signups", color: "var(--fill-sun)" },
    { name: "Barn visits", key: "visits", color: "var(--fill-sky)" },
    { name: "Blessings", key: "blessings", color: "var(--fill-sage)" },
    { name: "Curses", key: "curses", color: "var(--fill-rose-deep)" },
    { name: "Trades", key: "trades", color: "var(--fill-peach)" },
    { name: "Truffle digs", key: "truffle_digs", color: "var(--fill-lilac)" },
  ];
  const maxV = Math.max(
    1,
    ...data.series.flatMap((d) => chartSeries.map((s) => d[s.key] || 0))
  );

  // ---- distributions ----
  const h = data.happiness;
  const happyTotal = (h.happy || 0) + (h.neutral || 0) + (h.sad || 0);
  const a = data.alignment;
  const alignTotal = (a.angel || 0) + (a.neutral || 0) + (a.goblin || 0);

  return (
    <div className="dashboard">
      <GlyphSprite />
      <div className="wrap">
        {/* ---------- header ---------- */}
        <header className="head">
          <div className="title-wrap">
            <Rosie />
            <div>
              <div className="kicker">★ tickle the pig</div>
              <h1 className="text-display-lg">Analytics</h1>
            </div>
          </div>
          <span className="tag tag--sun">updated {gen}</span>
        </header>

        {/* ---------- the herd ---------- */}
        <div className="section-header">
          <div className="kicker">★ the herd</div>
          <h2 className="section-header__title">The herd</h2>
          <div className="rule" />
        </div>
        <div className="grid sticker-list">
          <Stat fill="rose" glyph="i-users" num={fmt(t.users)} lbl="Total users" />
          <Stat fill="sky" glyph="i-clock" num={fmt(t.active_1d)} lbl="Active today" />
          <Stat fill="sage" glyph="i-cal" num={fmt(t.active_7d)} lbl="Active 7 days" />
          <Stat fill="sun" glyph="i-cal" num={fmt(t.active_30d)} lbl="Active 30 days" />
          <Stat fill="lilac" glyph="i-bell" num={fmt(t.push_enabled)} lbl="Push enabled" sub={`${pushPct}% of users`} />
          <Stat fill="peach" glyph="i-crown" num={fmt(t.vip)} lbl="VIP" />
          <Stat fill="rose" glyph="i-heart" num={fmt(t.friendships)} lbl="Friendships" />
          <Stat fill="sky" glyph="i-share" num={fmt(t.referrals_done)} lbl="Referrals done" />
        </div>

        {/* ---------- what they're doing ---------- */}
        <div className="section-header">
          <div className="kicker">★ what they're doing</div>
          <h2 className="section-header__title">What they're doing</h2>
          <div className="rule" />
        </div>
        <div className="grid sticker-list">
          <Stat fill="sun" glyph="i-heart" num={fmt(t.tickles_earned)} lbl="Tickles earned" />
          <Stat fill="rose" glyph="i-broken" num={fmt(t.tickles_wasted)} lbl="Tickles wasted" />
          <Stat fill="sky" glyph="i-barn" num={fmt(t.barn_visits)} lbl="Barn visits" />
          <Stat fill="sage" glyph="i-halo" num={fmt(t.blessings)} lbl="Blessings cast" />
          <Stat fill="lilac" glyph="i-goblin" num={fmt(t.curses)} lbl="Curses cast" />
          <Stat fill="peach" glyph="i-swap" num={fmt(t.trades)} lbl="Tickle trades" sub={`${fmt(t.trades_open)} open · ${fmt(t.trades_fulfilled)} fulfilled`} />
          <Stat fill="sun" glyph="i-truffle" num={fmt(t.truffles_buried)} lbl="Truffles buried" />
          <Stat fill="sky" glyph="i-shovel" num={fmt(t.truffle_digs)} lbl="Truffle digs" />
        </div>

        {/* ---------- last 14 days ---------- */}
        <div className="section-header">
          <div className="kicker">★ last 14 days</div>
          <h2 className="section-header__title">Last 14 days</h2>
          <div className="rule" />
        </div>
        <div className="sticker chartpanel">
          <div className="legend">
            {chartSeries.map((s) => (
              <span className="lg" key={s.key}>
                <span className="sw" style={{ background: s.color }} />
                {s.name}
              </span>
            ))}
          </div>
          <div
            className="plot-scroll"
            tabIndex={0}
            role="group"
            aria-label="Daily activity, last 14 days"
          >
            <div className="plot">
              {data.series.map((d, i) => {
                const lab = dayLabel(d.day, i > 0 ? data.series[i - 1].day : null);
                return (
                  <div className="group" key={d.day}>
                    <div className="bars">
                      {chartSeries.map((s) => {
                        const v = d[s.key] || 0;
                        // % of the plot box — CSS owns the plot height
                        const ht = Math.round((v / maxV) * 100);
                        return (
                          <div
                            className="bar"
                            key={s.key}
                            style={{ height: `${ht}%`, background: s.color }}
                            title={`${s.name}: ${v}`}
                          />
                        );
                      })}
                    </div>
                    <div className="glabel">
                      {lab.mo ? <span className="mo">{lab.mo}</span> : null}
                      {lab.d}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* ---------- mood of the herd ---------- */}
        <div className="section-header">
          <div className="kicker">★ mood of the herd</div>
          <h2 className="section-header__title">Mood of the herd</h2>
          <div className="rule" />
        </div>
        <div className="two sticker-list">
          <div className="sticker sticker--cream panel">
            <div className="ptitle">
              <PanelIcon id="i-heart" color="var(--fill-sun)" />
              Happiness <span className="tag">avg {h.avg}</span>
            </div>
            <MoodRow label="Happy" value={h.happy} total={happyTotal} color="var(--fill-sun)" />
            <MoodRow label="Neutral" value={h.neutral} total={happyTotal} color="var(--fill-sky)" />
            <MoodRow label="Sad" value={h.sad} total={happyTotal} color="var(--fill-rose-deep)" />
          </div>
          <div className="sticker sticker--cream panel">
            <div className="ptitle">
              <PanelIcon id="i-halo" color="var(--fill-lilac-deep)" />
              Alignment
            </div>
            <MoodRow label="Angel" value={a.angel} total={alignTotal} color="var(--fill-lilac)" />
            <MoodRow label="Neutral" value={a.neutral} total={alignTotal} color={NEUTRAL_GREY} />
            <MoodRow label="Goblin" value={a.goblin} total={alignTotal} color={GOBLIN_GOLD} />
          </div>
        </div>

        {/* ---------- every pig's mood (live, per person) ---------- */}
        <div className="section-header">
          <div className="kicker">★ every pig's mood</div>
          <h2 className="section-header__title">Every pig&apos;s mood</h2>
          <div className="rule" />
        </div>
        <p className="note">
          Live happiness for all {data.pigs?.length ?? 0} pigs — decays 0.5/hr
          since each was last cheered up, floor 20, ceiling 80. Happiest first.
        </p>
        <div className="pgrid sticker-list">
          {(data.pigs || []).map((p, i) => (
            <PigCard key={p.username + i} name={p.username} happiness={p.happiness} band={p.band} />
          ))}
        </div>

        {/* ---------- snout season 1 ---------- */}
        <div className="section-header">
          <div className="kicker">★ snout season 1</div>
          <h2 className="section-header__title">Snout season 1</h2>
          <div className="rule" />
        </div>
        <div className="grid sticker-list">
          <Stat fill="lilac" glyph="i-ticket" num={fmt(data.season.players)} lbl="Pass players" />
          <Stat fill="sun" glyph="i-star" num={fmt(data.season.avg_xp)} lbl="Avg XP" />
          <Stat fill="sage" glyph="i-medal" num={data.season.avg_tier} lbl="Avg tier" sub="of 30" />
          <Stat fill="rose" glyph="i-lock" num={fmt(data.season.premium)} lbl="Premium unlocked" />
          <Stat fill="sky" glyph="i-flag" num={fmt(data.season.tier_complete)} lbl="Completed" />
        </div>

        {/* ---------- top of the pen ---------- */}
        <div className="section-header">
          <div className="kicker">★ top of the pen</div>
          <h2 className="section-header__title">Top of the pen</h2>
          <div className="rule" />
        </div>
        <div className="two sticker-list">
          <div className="sticker sticker--peach panel">
            <div className="ptitle">
              <PanelIcon id="i-heart" color="var(--fill-rose-deep)" />
              Top tickles earned
            </div>
            <Leaderboard rows={data.top_tickles} />
          </div>
          <div className="sticker sticker--lilac panel">
            <div className="ptitle">
              <PanelIcon id="i-star" color={GOBLIN_GOLD} />
              Top season XP
            </div>
            <Leaderboard rows={data.top_xp} unit="xp" />
          </div>
        </div>

        {/* ---------- the schism (alignment ranking) ---------- */}
        <div className="section-header">
          <div className="kicker">★ the schism</div>
          <h2 className="section-header__title">The schism</h2>
          <div className="rule" />
        </div>
        <div className="two sticker-list">
          <div className="sticker sticker--lilac panel">
            <div className="ptitle">
              <PanelIcon id="i-halo" color="var(--fill-lilac-deep)" />
              Saints of the sounder
            </div>
            <ScoreBoard rows={data.saints} side="angel" />
          </div>
          <div className="sticker sticker--sun panel">
            <div className="ptitle">
              <PanelIcon id="i-goblin" color={GOBLIN_GOLD} />
              Goblin kings
            </div>
            <ScoreBoard rows={data.goblins} side="goblin" />
          </div>
        </div>

        {/* ---------- tickles missed ---------- */}
        <div className="section-header">
          <div className="kicker">★ tickles missed</div>
          <h2 className="section-header__title">Tickles missed</h2>
          <div className="rule" />
        </div>
        <p className="note">
          Passive regen thrown away at the cap — players who were maxed out and
          didn&apos;t spend. A read on who&apos;s over-capped or drifting away.
        </p>
        <div className="two sticker-list">
          <div className="sticker sticker--peach panel">
            <div className="ptitle">
              <PanelIcon id="i-broken" color="var(--fill-rose-deep)" />
              Most tickles missed
            </div>
            <WasteBoard rows={data.most_wasted} />
          </div>
          <div className="sticker sticker--rose panel">
            <div className="ptitle">
              <PanelIcon id="i-broken" color="var(--accent)" />
              Highest waste rate
            </div>
            <WasteBoard rows={data.waste_rate} />
          </div>
        </div>
      </div>
    </div>
  );
}
