// https://docs.expo.dev/guides/using-eslint/

// Emoji in rendered UI is an automatic taste failure (docs/design/taste-standard.md).
// The astral emoji planes plus the U+2600–U+27BF dingbat block, MINUS the six marks
// the 2026-07-13 dingbat ruling sanctions as typography/semantics handled elsewhere:
// ★ U+2605, ♥ U+2665, ✓ U+2713, ✕ U+2715, ✦ U+2726, ✧ U+2727.
const EMOJI_RE =
  "(\\uD83C[\\uDF00-\\uDFFF]|\\uD83D[\\uDC00-\\uDE4F]|\\uD83E[\\uDD00-\\uDEFF]|[\\u2600-\\u2604\\u2606-\\u2664\\u2666-\\u2712\\u2714\\u2716-\\u2725\\u2728-\\u27BF])";

const EMOJI_MESSAGE =
  "No emoji in UI. Use components/ui/Glyph (hand-drawn art) or components/ui/Icon (SVG). See docs/design/taste-standard.md.";

const TASTE_RULES = {
  "no-restricted-properties": [
    "error",
    {
      object: "Alert",
      property: "alert",
      message:
        "Refusals are toasts (showAppToast), decisions are ConfirmDialog — Alert is for nothing. See docs/design/design-system-spec.md §3.4.",
    },
  ],
  "no-restricted-imports": [
    "error",
    {
      patterns: [
        {
          group: ["@expo/vector-icons", "@expo/vector-icons/*"],
          message: "Icons render through components/ui/Icon or Glyph.",
        },
      ],
    },
  ],
  "no-restricted-syntax": [
    "error",
    { selector: `JSXText[value=/${EMOJI_RE}/]`, message: EMOJI_MESSAGE },
    {
      selector: `JSXExpressionContainer Literal[value=/${EMOJI_RE}/]`,
      message: EMOJI_MESSAGE,
    },
    {
      selector: `JSXAttribute Literal[value=/${EMOJI_RE}/]`,
      message: EMOJI_MESSAGE,
    },
  ],
};

// Wave 1 of the design-system lint plan (docs/design/design-system-spec.md §3.2).
// These ship as WARN: they surface the existing debt without blocking the
// migration, and they live in a local plugin because ESLint allows one severity
// per rule and `no-restricted-syntax` above is already spent on `error`.
const TTP_WAVE_1_RULES = {
  "ttp/no-raw-style-literal": "error",
  "ttp/no-raw-modal": "error",
  "ttp/no-activity-indicator": "error",
  "ttp/pressable-needs-a11y": "error",
  "ttp/no-space-arithmetic": "error",
  "ttp/animated-needs-motion-policy": "error",
  "ttp/no-legacy-palette": "error",
};

module.exports = {
  extends: "expo",
  ignorePatterns: ["/dist/*"],
  plugins: ["ttp"],
  rules: {
    // Expo 57's React Hooks plugin enables the React Compiler readiness rules.
    // Keep them visible without making the SDK upgrade contingent on rewriting
    // the existing animation/ref architecture in the same change.
    "react-hooks/immutability": "warn",
    "react-hooks/purity": "warn",
    "react-hooks/refs": "warn",
    "react-hooks/set-state-in-effect": "warn",
    "react-hooks/use-memo": "warn",
    // These TypeScript/import rules were not available in the old pnpm install.
    // Surface the existing debt now and tighten it independently.
    "@typescript-eslint/array-type": "warn",
    "@typescript-eslint/no-empty-object-type": "warn",
    "@typescript-eslint/no-require-imports": "warn",
    "import/no-unresolved": "warn",
    // The taste gate (2026-09 audit). Wave 3 brought every app/ + components/
    // file to zero, so the seven eslint-plugin-ttp rules are errors by default;
    // the overrides below only EXEMPT dev tools, prototypes, tests and the
    // primitives (the one place a token becomes a pixel). (2026-09-11)
    ...TASTE_RULES,
    // The seven wave-1 rules (warn).
    ...TTP_WAVE_1_RULES,
  },
  overrides: [
    {
      // theme.ts is where a token BECOMES a pixel; components/ui/** is where a
      // token becomes a component. Dev tools, prototypes, the audit harness,
      // tests, and build scripts are not shipped UI. All are exempt from the
      // wave-1 rules by design, not by debt.
      files: [
        "constants/theme.ts",
        "components/ui/**",
        "components/dev/**",
        "components/prototypes/**",
        "app/*-prototype.tsx",
        "app/ui-audit.tsx",
        "__tests__/**",
        "scripts/**",
        "tools/**",
      ],
      rules: Object.fromEntries(
        Object.keys(TTP_WAVE_1_RULES).map((rule) => [rule, "off"]),
      ),
    },
    {
      // Dev tools, prototypes, the audit harness, and the one sanctioned
      // vector-icons importer are exempt from the taste gate.
      files: [
        "components/dev/**",
        "components/prototypes/**",
        "app/*-prototype.tsx",
        "app/ui-audit.tsx",
        "components/ui/Icon.tsx",
      ],
      rules: {
        "no-restricted-properties": "off",
        "no-restricted-imports": "off",
        "no-restricted-syntax": "off",
      },
    },
  ],
};
