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

function Stat({ fill, tilt, glyph, num, lbl, sub }) {
  return (
    <div
      className="sticker stat"
      style={{ "--fill": `var(--${fill})`, "--tilt": `${tilt}deg` }}
    >
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

const PIG_TINT = { happy: "var(--sage)", neutral: "var(--cream)", sad: "var(--rose)" };
const PIG_BAR = { happy: "var(--grass)", neutral: "var(--sun)", sad: "var(--rose-deep)" };
const PIG_TILTS = [-1.1, 0.7, -0.5, 0.9, -0.8, 0.5, -0.6, 1, -0.9, 0.6];

function PigCard({ name, happiness, band, i }) {
  // map the clamped [20,80] range onto a full-width bar for contrast
  const w = Math.max(0, Math.min(100, ((happiness - 20) / 60) * 100));
  return (
    <div
      className="sticker pig"
      style={{ "--fill": PIG_TINT[band], "--tilt": `${PIG_TILTS[i % PIG_TILTS.length]}deg` }}
    >
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
          style={{ width: `${Math.max(2, pct)}%`, background: `var(--${color})` }}
        />
      </div>
      <span className="mval">
        {fmt(value)} <small>{pct}%</small>
      </span>
    </div>
  );
}

const BAND_FILL = { angel: "var(--lilac)", goblin: "var(--gold)", neutral: "var(--grey)" };
const signed = (n) => (n > 0 ? `+${n}` : `${n}`);

function AlignChip({ score, band }) {
  return (
    <span className="align-chip" style={{ background: BAND_FILL[band] || "var(--grey)" }} title={`alignment ${signed(score)}`}>
      {signed(score)}
    </span>
  );
}

// Ranked tickles / XP boards — each row carries the player's alignment chip.
function Leaderboard({ rows, unit }) {
  if (!rows || rows.length === 0)
    return <div className="empty">No data yet.</div>;
  return (
    <div className="lb">
      {rows.map((r, i) => (
        <div className={"lbrow" + (i === 0 ? " top" : "")} key={r.username + i}>
          <span className="rank">{i + 1}</span>
          <span className="who">
            {i === 0 ? (
              <svg className="crown">
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
    return <div className="empty">No {side === "angel" ? "saints" : "goblins"} yet.</div>;
  const glyph = side === "angel" ? "i-halo" : "i-goblin";
  return (
    <div className="lb">
      {rows.map((r, i) => (
        <div className="lbrow" key={r.username + i}>
          <span className="rank">{i + 1}</span>
          <span className="who">
            <svg style={{ width: 20, height: 20, color: side === "angel" ? "var(--lilac-deep)" : "var(--gold)" }}>
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
  if (!rows || rows.length === 0)
    return <div className="empty">No tickles missed yet.</div>;
  return (
    <div className="lb">
      {rows.map((r, i) => (
        <div className="lbrow" key={r.username + i}>
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
                <h1 className="big">Analytics</h1>
              </div>
            </div>
          </header>
          <div className="sticker errpanel" style={{ "--fill": "var(--cream)" }}>
            <div className="kicker">couldn't load analytics</div>
            <pre>{String(e.message || e)}</pre>
            <div className="sub" style={{ color: "var(--accent)" }}>
              If this says the function doesn't exist, the analytics_overview
              migration hasn't been pushed yet.
            </div>
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
    { name: "Signups", key: "signups", color: "var(--sun)" },
    { name: "Barn visits", key: "visits", color: "var(--sky)" },
    { name: "Blessings", key: "blessings", color: "var(--sage)" },
    { name: "Curses", key: "curses", color: "var(--rose-deep)" },
    { name: "Trades", key: "trades", color: "var(--peach)" },
    { name: "Truffle digs", key: "truffle_digs", color: "var(--lilac)" },
  ];
  const plotH = 200;
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
              <h1 className="big">Analytics</h1>
            </div>
          </div>
          <div className="pill">updated {gen}</div>
        </header>

        {/* ---------- the herd ---------- */}
        <div className="sec">
          <div className="kicker">★ the herd</div>
          <h2>The herd</h2>
          <div className="rule" />
        </div>
        <div className="grid">
          <Stat fill="rose" tilt={-1.2} glyph="i-users" num={fmt(t.users)} lbl="Total users" />
          <Stat fill="sky" tilt={0.8} glyph="i-clock" num={fmt(t.active_1d)} lbl="Active today" />
          <Stat fill="sage" tilt={-0.6} glyph="i-cal" num={fmt(t.active_7d)} lbl="Active 7 days" />
          <Stat fill="sun" tilt={1} glyph="i-cal" num={fmt(t.active_30d)} lbl="Active 30 days" />
          <Stat fill="lilac" tilt={-1} glyph="i-bell" num={fmt(t.push_enabled)} lbl="Push enabled" sub={`${pushPct}% of users`} />
          <Stat fill="peach" tilt={0.6} glyph="i-crown" num={fmt(t.vip)} lbl="VIP" />
          <Stat fill="rose" tilt={-0.8} glyph="i-heart" num={fmt(t.friendships)} lbl="Friendships" />
          <Stat fill="sky" tilt={0.9} glyph="i-share" num={fmt(t.referrals_done)} lbl="Referrals done" />
        </div>

        {/* ---------- what they're doing ---------- */}
        <div className="sec">
          <div className="kicker">★ what they're doing</div>
          <h2>What they're doing</h2>
          <div className="rule" />
        </div>
        <div className="grid">
          <Stat fill="sun" tilt={-1} glyph="i-heart" num={fmt(t.tickles_earned)} lbl="Tickles earned" />
          <Stat fill="rose" tilt={0.9} glyph="i-broken" num={fmt(t.tickles_wasted)} lbl="Tickles wasted" />
          <Stat fill="sky" tilt={-0.7} glyph="i-barn" num={fmt(t.barn_visits)} lbl="Barn visits" />
          <Stat fill="sage" tilt={1.1} glyph="i-halo" num={fmt(t.blessings)} lbl="Blessings cast" />
          <Stat fill="lilac" tilt={-1.1} glyph="i-goblin" num={fmt(t.curses)} lbl="Curses cast" />
          <Stat fill="peach" tilt={0.7} glyph="i-swap" num={fmt(t.trades)} lbl="Tickle trades" sub={`${fmt(t.trades_open)} open · ${fmt(t.trades_fulfilled)} fulfilled`} />
          <Stat fill="sun" tilt={-0.9} glyph="i-truffle" num={fmt(t.truffles_buried)} lbl="Truffles buried" />
          <Stat fill="sky" tilt={0.8} glyph="i-shovel" num={fmt(t.truffle_digs)} lbl="Truffle digs" />
        </div>

        {/* ---------- last 14 days ---------- */}
        <div className="sec">
          <div className="kicker">★ last 14 days</div>
          <h2>Last 14 days</h2>
          <div className="rule" />
        </div>
        <div className="sticker chartpanel" style={{ "--tilt": "-.3deg" }}>
          <div className="legend">
            {chartSeries.map((s) => (
              <span className="lg" key={s.key}>
                <span className="sw" style={{ background: s.color }} />
                {s.name}
              </span>
            ))}
          </div>
          <div className="plot-scroll">
            <div className="plot">
              {data.series.map((d, i) => {
                const lab = dayLabel(d.day, i > 0 ? data.series[i - 1].day : null);
                return (
                  <div className="group" key={d.day}>
                    <div className="bars">
                      {chartSeries.map((s) => {
                        const v = d[s.key] || 0;
                        const ht = Math.max(4, Math.round((v / maxV) * plotH));
                        return (
                          <div
                            className="bar"
                            key={s.key}
                            style={{ height: `${ht}px`, background: s.color }}
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
        <div className="sec">
          <div className="kicker">★ mood of the herd</div>
          <h2>Mood of the herd</h2>
          <div className="rule" />
        </div>
        <div className="two">
          <div className="sticker panel" style={{ "--fill": "var(--cream)", "--tilt": "-.6deg" }}>
            <div className="ptitle">
              <svg style={{ width: 22, height: 22, color: "var(--sun)" }}>
                <use href="#i-heart" />
              </svg>{" "}
              Happiness <span className="badge">avg {h.avg}</span>
            </div>
            <MoodRow label="Happy" value={h.happy} total={happyTotal} color="sun" />
            <MoodRow label="Neutral" value={h.neutral} total={happyTotal} color="sky" />
            <MoodRow label="Sad" value={h.sad} total={happyTotal} color="rose-deep" />
          </div>
          <div className="sticker panel" style={{ "--fill": "var(--cream)", "--tilt": ".6deg" }}>
            <div className="ptitle">
              <svg style={{ width: 22, height: 22, color: "var(--lilac-deep)" }}>
                <use href="#i-halo" />
              </svg>{" "}
              Alignment
            </div>
            <MoodRow label="Angel" value={a.angel} total={alignTotal} color="lilac" />
            <MoodRow label="Neutral" value={a.neutral} total={alignTotal} color="grey" />
            <MoodRow label="Goblin" value={a.goblin} total={alignTotal} color="gold" />
          </div>
        </div>

        {/* ---------- every pig's mood (live, per person) ---------- */}
        <div className="sec">
          <div className="kicker">★ every pig's mood</div>
          <h2>Every pig&apos;s mood</h2>
          <div className="rule" />
        </div>
        <p className="empty" style={{ marginTop: -8, marginBottom: 16 }}>
          Live happiness for all {data.pigs?.length ?? 0} pigs — decays 0.5/hr
          since each was last cheered up, floor 20, ceiling 80. Happiest first.
        </p>
        <div className="pgrid">
          {(data.pigs || []).map((p, i) => (
            <PigCard key={p.username + i} name={p.username} happiness={p.happiness} band={p.band} i={i} />
          ))}
        </div>

        {/* ---------- snout season 1 ---------- */}
        <div className="sec">
          <div className="kicker">★ snout season 1</div>
          <h2>Snout season 1</h2>
          <div className="rule" />
        </div>
        <div className="grid">
          <Stat fill="lilac" tilt={-1} glyph="i-ticket" num={fmt(data.season.players)} lbl="Pass players" />
          <Stat fill="sun" tilt={0.8} glyph="i-star" num={fmt(data.season.avg_xp)} lbl="Avg XP" />
          <Stat fill="sage" tilt={-0.7} glyph="i-medal" num={data.season.avg_tier} lbl="Avg tier" sub="of 30" />
          <Stat fill="rose" tilt={1} glyph="i-lock" num={fmt(data.season.premium)} lbl="Premium unlocked" />
          <Stat fill="sky" tilt={-0.9} glyph="i-flag" num={fmt(data.season.tier_complete)} lbl="Completed" />
        </div>

        {/* ---------- top of the pen ---------- */}
        <div className="sec">
          <div className="kicker">★ top of the pen</div>
          <h2>Top of the pen</h2>
          <div className="rule" />
        </div>
        <div className="two">
          <div className="sticker panel" style={{ "--fill": "var(--peach)", "--tilt": "-.5deg" }}>
            <div className="ptitle">
              <svg style={{ width: 22, height: 22, color: "var(--rose-deep)" }}>
                <use href="#i-heart" />
              </svg>{" "}
              Top tickles earned
            </div>
            <Leaderboard rows={data.top_tickles} />
          </div>
          <div className="sticker panel" style={{ "--fill": "var(--lilac)", "--tilt": ".5deg" }}>
            <div className="ptitle">
              <svg style={{ width: 22, height: 22, color: "var(--gold)" }}>
                <use href="#i-star" />
              </svg>{" "}
              Top season XP
            </div>
            <Leaderboard rows={data.top_xp} unit="xp" />
          </div>
        </div>

        {/* ---------- the schism (alignment ranking) ---------- */}
        <div className="sec">
          <div className="kicker">★ the schism</div>
          <h2>The schism</h2>
          <div className="rule" />
        </div>
        <div className="two">
          <div className="sticker panel" style={{ "--fill": "var(--lilac)", "--tilt": "-.5deg" }}>
            <div className="ptitle">
              <svg style={{ width: 22, height: 22, color: "var(--lilac-deep)" }}>
                <use href="#i-halo" />
              </svg>{" "}
              Saints of the sounder
            </div>
            <ScoreBoard rows={data.saints} side="angel" />
          </div>
          <div className="sticker panel" style={{ "--fill": "var(--sun)", "--tilt": ".5deg" }}>
            <div className="ptitle">
              <svg style={{ width: 22, height: 22, color: "var(--gold)" }}>
                <use href="#i-goblin" />
              </svg>{" "}
              Goblin kings
            </div>
            <ScoreBoard rows={data.goblins} side="goblin" />
          </div>
        </div>

        {/* ---------- tickles missed ---------- */}
        <div className="sec">
          <div className="kicker">★ tickles missed</div>
          <h2>Tickles missed</h2>
          <div className="rule" />
        </div>
        <p className="empty" style={{ marginTop: -8, marginBottom: 16 }}>
          Passive regen thrown away at the cap — players who were maxed out and
          didn&apos;t spend. A read on who&apos;s over-capped or drifting away.
        </p>
        <div className="two">
          <div className="sticker panel" style={{ "--fill": "var(--peach)", "--tilt": "-.5deg" }}>
            <div className="ptitle">
              <svg style={{ width: 22, height: 22, color: "var(--rose-deep)" }}>
                <use href="#i-broken" />
              </svg>{" "}
              Most tickles missed
            </div>
            <WasteBoard rows={data.most_wasted} />
          </div>
          <div className="sticker panel" style={{ "--fill": "var(--rose)", "--tilt": ".5deg" }}>
            <div className="ptitle">
              <svg style={{ width: 22, height: 22, color: "var(--accent)" }}>
                <use href="#i-broken" />
              </svg>{" "}
              Highest waste rate
            </div>
            <WasteBoard rows={data.waste_rate} />
          </div>
        </div>
      </div>
    </div>
  );
}
