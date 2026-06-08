// Shared SVG: the hand-drawn Rosie pig + the glyph sprite, lifted verbatim from
// the Claude Design handoff bundle (Analytics Dashboard.html / Login.html).

export function Rosie({ size = 76 }) {
  return (
    <svg
      className="rosie"
      width={size}
      height={size}
      viewBox="0 0 76 76"
      aria-label="Rosie"
    >
      <path d="M17 24 L11 9 L30 19 Z" fill="#f8a8b3" stroke="#2a1f15" strokeWidth="2.5" strokeLinejoin="round" />
      <path d="M59 24 L65 9 L46 19 Z" fill="#f8a8b3" stroke="#2a1f15" strokeWidth="2.5" strokeLinejoin="round" />
      <circle cx="38" cy="42" r="25" fill="#ffd6dc" stroke="#2a1f15" strokeWidth="2.5" />
      <circle cx="29" cy="38" r="2.6" fill="#2a1f15" />
      <circle cx="47" cy="38" r="2.6" fill="#2a1f15" />
      <circle cx="22" cy="47" r="3.4" fill="#f8a8b3" />
      <circle cx="54" cy="47" r="3.4" fill="#f8a8b3" />
      <ellipse cx="38" cy="49" rx="12" ry="8.5" fill="#f8a8b3" stroke="#2a1f15" strokeWidth="2.5" />
      <ellipse cx="34" cy="49" rx="1.9" ry="2.7" fill="#2a1f15" />
      <ellipse cx="42" cy="49" rx="1.9" ry="2.7" fill="#2a1f15" />
    </svg>
  );
}

export function GlyphSprite() {
  return (
    <svg width="0" height="0" style={{ position: "absolute" }} aria-hidden="true">
      <symbol id="i-users" viewBox="0 0 24 24" fill="#fff" stroke="#2a1f15" strokeWidth="2" strokeLinejoin="round">
        <circle cx="9" cy="8" r="3.4" /><path d="M3.2 20 C3.2 15.6 6 13.6 9 13.6 C12 13.6 14.8 15.6 14.8 20Z" />
        <circle cx="17" cy="9.2" r="2.7" /><path d="M14.6 20 C14.6 16.6 16 15 17 15 C19.6 15 21 16.8 21 20Z" />
      </symbol>
      <symbol id="i-clock" viewBox="0 0 24 24" fill="#fff" stroke="#2a1f15" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="8.2" /><path d="M12 7.4V12l3.2 2.1" />
      </symbol>
      <symbol id="i-cal" viewBox="0 0 24 24" fill="#fff" stroke="#2a1f15" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="4" y="5.5" width="16" height="14.5" rx="2.4" /><path d="M4 10h16M8.5 3v4M15.5 3v4" />
      </symbol>
      <symbol id="i-bell" viewBox="0 0 24 24" fill="#fff" stroke="#2a1f15" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M6.5 17V11a5.5 5.5 0 0 1 11 0v6" /><path d="M4.6 17h14.8" /><path d="M10 20a2 2 0 0 0 4 0" />
      </symbol>
      <symbol id="i-crown" viewBox="0 0 24 24" fill="#fff" stroke="#2a1f15" strokeWidth="2" strokeLinejoin="round">
        <path d="M3.6 18.4 4.8 8.2l4.2 4 3-6.2 3 6.2 4.2-4 1.2 10.2Z" /><path d="M3.6 18.4h16.8" />
      </symbol>
      <symbol id="i-heart" viewBox="0 0 24 24" fill="#fff" stroke="#2a1f15" strokeWidth="2" strokeLinejoin="round">
        <path d="M12 20.4C12 20.4 3.4 14 3.4 8.6A4.4 4.4 0 0 1 12 6.4 4.4 4.4 0 0 1 20.6 8.6C20.6 14 12 20.4 12 20.4Z" />
      </symbol>
      <symbol id="i-broken" viewBox="0 0 24 24" fill="#fff" stroke="#2a1f15" strokeWidth="2" strokeLinejoin="round">
        <path d="M12 20.4C12 20.4 3.4 14 3.4 8.6A4.4 4.4 0 0 1 12 6.4 4.4 4.4 0 0 1 20.6 8.6C20.6 14 12 20.4 12 20.4Z" />
        <path d="M12 6.4 10 11l3 1.6-2.2 4.4" fill="none" />
      </symbol>
      <symbol id="i-barn" viewBox="0 0 24 24" fill="#fff" stroke="#2a1f15" strokeWidth="2" strokeLinejoin="round">
        <path d="M3.6 20V9.6L12 4.4l8.4 5.2V20Z" /><path d="M9 20v-6.2h6V20" />
      </symbol>
      <symbol id="i-halo" viewBox="0 0 24 24" fill="none" stroke="#2a1f15" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round">
        <ellipse cx="12" cy="8" rx="6.4" ry="2.4" fill="#fff" />
        <path d="M6.6 13.5 7.8 16M17.4 13.5 16.2 16M12 14.5V18" />
      </symbol>
      <symbol id="i-goblin" viewBox="0 0 24 24" fill="#fff" stroke="#2a1f15" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round">
        <path d="M5.4 9 3.2 4.6 7.6 7M18.6 9 20.8 4.6 16.4 7" />
        <path d="M5.4 9C5.4 15.6 8.4 19 12 19C15.6 19 18.6 15.6 18.6 9Z" />
        <path d="M9 12h.02M15 12h.02" /><path d="M9.4 15.2q2.6 1.8 5.2 0" />
      </symbol>
      <symbol id="i-truffle" viewBox="0 0 24 24" fill="#fff" stroke="#2a1f15" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round">
        <path d="M5 13.5c0-4 3.4-6.5 7-6.5s7 2.5 7 6.5c0 2.4-3 4-7 4s-7-1.6-7-4Z" />
        <path d="M9 12h.02M14.5 11h.02M12 14.6h.02" />
      </symbol>
      <symbol id="i-shovel" viewBox="0 0 24 24" fill="#fff" stroke="#2a1f15" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round">
        <path d="M13.5 4.2 19.8 10.5M16.5 7.2 9.5 14.2" />
        <path d="M9.5 14.2 5.4 18.3a2.1 2.1 0 0 0 3 3l4.1-4.1Z" />
      </symbol>
      <symbol id="i-swap" viewBox="0 0 24 24" fill="none" stroke="#2a1f15" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round">
        <path d="M4.6 9.2h13l-3.4-3.4M19.4 14.8h-13l3.4 3.4" />
      </symbol>
      <symbol id="i-share" viewBox="0 0 24 24" fill="#fff" stroke="#2a1f15" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round">
        <circle cx="6" cy="12" r="2.7" /><circle cx="17.4" cy="6" r="2.7" /><circle cx="17.4" cy="18" r="2.7" />
        <path d="M8.4 10.9 15 7.2M8.4 13.1 15 16.8" />
      </symbol>
      <symbol id="i-ticket" viewBox="0 0 24 24" fill="#fff" stroke="#2a1f15" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round">
        <path d="M4 7.5h16v3.2a1.8 1.8 0 0 0 0 3.6V18H4v-3.7a1.8 1.8 0 0 0 0-3.6Z" />
        <path d="M14 7.5V18" strokeDasharray="2.2 2.4" />
      </symbol>
      <symbol id="i-star" viewBox="0 0 24 24" fill="#fff" stroke="#2a1f15" strokeWidth="2" strokeLinejoin="round">
        <path d="M12 3.2 14.7 9l6.3.6-4.8 4.2 1.5 6.2L12 16.9 6.3 20l1.5-6.2L3 9.6 9.3 9Z" />
      </symbol>
      <symbol id="i-medal" viewBox="0 0 24 24" fill="#fff" stroke="#2a1f15" strokeWidth="2" strokeLinejoin="round">
        <path d="M9 8.6 6.8 3.2M15 8.6 17.2 3.2" />
        <circle cx="12" cy="14.4" r="5.6" />
        <path d="M12 11.7l.9 1.9 2 .2-1.5 1.4.5 2-1.9-1.1-1.9 1.1.5-2L8.6 13.8l2-.2Z" strokeWidth="1.5" />
      </symbol>
      <symbol id="i-lock" viewBox="0 0 24 24" fill="#fff" stroke="#2a1f15" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round">
        <rect x="5" y="10.6" width="14" height="9.4" rx="2.4" /><path d="M8 10.6V8a4 4 0 0 1 8 0v2.6" /><path d="M12 14v2.6" />
      </symbol>
      <symbol id="i-flag" viewBox="0 0 24 24" fill="#fff" stroke="#2a1f15" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round">
        <path d="M6 21V4" /><path d="M6 5h11l-2.2 3.2L17 11.6H6" />
      </symbol>
    </svg>
  );
}
