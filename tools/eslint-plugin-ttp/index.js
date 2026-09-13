/**
 * eslint-plugin-ttp — the Tickle the Pig design-system lint rules.
 *
 * Wave 1 of docs/design/design-system-spec.md §3.2 ("Lint rules"). The three
 * automatic taste failures (Alert.alert, rendered emoji, raw @expo/vector-icons)
 * already ship as core-rule `error`s in .eslintrc.js; these seven ship as
 * `warn` so the existing debt is visible without blocking the migration.
 *
 * CommonJS, zero dependencies, ESLint 8 (legacy `create(context)` shape).
 */

const SPEC = "docs/design/design-system-spec.md §3.2";

// ---------------------------------------------------------------------------
// shared helpers
// ---------------------------------------------------------------------------

function ancestorsOf(context, node) {
	const sc = typeof context.getSourceCode === "function" ? context.getSourceCode() : null;
	if (sc && typeof sc.getAncestors === "function") return sc.getAncestors(node);
	return context.getAncestors();
}

/** `StyleSheet.create({ ... })` — the call the object literal is an argument to. */
function isStyleSheetCreate(node) {
	return (
		node.type === "CallExpression" &&
		node.callee.type === "MemberExpression" &&
		!node.callee.computed &&
		node.callee.object.type === "Identifier" &&
		node.callee.object.name === "StyleSheet" &&
		node.callee.property.type === "Identifier" &&
		node.callee.property.name === "create"
	);
}

function isStyleJSXAttribute(node) {
	return (
		node.type === "JSXAttribute" &&
		node.name &&
		node.name.type === "JSXIdentifier" &&
		node.name.name === "style"
	);
}

/** Inside a StyleSheet.create() object, or inside a JSX `style={...}` value. */
function inStyleContext(ancestors) {
	for (let i = ancestors.length - 1; i >= 0; i--) {
		const a = ancestors[i];
		if (isStyleSheetCreate(a) || isStyleJSXAttribute(a)) return true;
	}
	return false;
}

/** Inside any JSX at all (attribute value, child expression, …). */
function inJSX(ancestors) {
	for (let i = ancestors.length - 1; i >= 0; i--) {
		const t = ancestors[i].type;
		if (t === "JSXElement" || t === "JSXFragment" || t === "JSXAttribute") return true;
	}
	return false;
}

function jsxNameOf(openingElement) {
	const n = openingElement.name;
	return n && n.type === "JSXIdentifier" ? n.name : null;
}

function attrNames(openingElement) {
	const out = new Set();
	for (const attr of openingElement.attributes) {
		if (attr.type === "JSXAttribute" && attr.name && attr.name.type === "JSXIdentifier") {
			out.add(attr.name.name);
		}
	}
	return out;
}

function findAttr(openingElement, name) {
	return openingElement.attributes.find(
		(a) =>
			a.type === "JSXAttribute" &&
			a.name &&
			a.name.type === "JSXIdentifier" &&
			a.name.name === name
	);
}

// ---------------------------------------------------------------------------
// ttp/no-raw-style-literal
// ---------------------------------------------------------------------------

const SIZE_KEY_RE =
	/^(?:fontSize|lineHeight|letterSpacing|borderRadius|borderWidth|opacity|gap|rowGap|columnGap|width|height|minHeight|minWidth|(?:padding|margin)[A-Za-z]*)$/;

const HEX_RE = /^#[0-9a-fA-F]{3,8}$/;
const RGB_RE = /^rgba?\(/;

/** 0 / 1 / -1 are structural (hairlines, flex, full opacity), not taste. */
const ALLOWED_NUMBERS = new Set([0, 1, -1]);

const noRawStyleLiteral = {
	meta: {
		type: "suggestion",
		docs: { description: "Style values come from theme.ts tokens, never raw literals." },
		schema: [],
		messages: {
			size: "Raw style value `{{key}}: {{value}}` — use a SPACE / RADII / TYPE / BORDER token. See {{spec}}.",
			color: "Raw color literal `{{value}}` — use a WHIMSY / UI_COLORS token. See {{spec}}.",
		},
	},
	create(context) {
		return {
			Property(node) {
				if (node.computed) return;
				const key =
					node.key.type === "Identifier"
						? node.key.name
						: node.key.type === "Literal"
							? String(node.key.value)
							: null;
				if (!key || !SIZE_KEY_RE.test(key)) return;
				if (node.value.type !== "Literal" || typeof node.value.value !== "number") return;
				if (ALLOWED_NUMBERS.has(node.value.value)) return;
				if (!inStyleContext(ancestorsOf(context, node))) return;
				context.report({
					node: node.value,
					messageId: "size",
					data: { key, value: String(node.value.value), spec: SPEC },
				});
			},
			Literal(node) {
				if (typeof node.value !== "string") return;
				if (!HEX_RE.test(node.value) && !RGB_RE.test(node.value)) return;
				const ancestors = ancestorsOf(context, node);
				if (!inStyleContext(ancestors) && !inJSX(ancestors)) return;
				context.report({
					node,
					messageId: "color",
					data: { value: node.value, spec: SPEC },
				});
			},
		};
	},
};

// ---------------------------------------------------------------------------
// ttp/no-raw-modal
// ---------------------------------------------------------------------------

const noRawModal = {
	meta: {
		type: "suggestion",
		docs: { description: "Modals mount Sheet / Dialog / Ceremony scaffolds, not raw <Modal>." },
		schema: [],
		messages: {
			raw: "Raw <Modal> — mount SlideUpSheet, ConfirmDialog, or AdaptiveModalScaffold. See {{spec}}.",
		},
	},
	create(context) {
		return {
			'JSXOpeningElement[name.name="Modal"]'(node) {
				context.report({ node, messageId: "raw", data: { spec: SPEC } });
			},
		};
	},
};

// ---------------------------------------------------------------------------
// ttp/no-activity-indicator
// ---------------------------------------------------------------------------

const noActivityIndicator = {
	meta: {
		type: "suggestion",
		docs: { description: "Loading is LoadingBeat / Skeleton / label swap, never a spinner." },
		schema: [],
		messages: {
			spinner:
				"<ActivityIndicator> — loading is LoadingBeat, Skeleton, or a label swap. See {{spec}}.",
		},
	},
	create(context) {
		return {
			'JSXOpeningElement[name.name="ActivityIndicator"]'(node) {
				context.report({ node, messageId: "spinner", data: { spec: SPEC } });
			},
		};
	},
};

// ---------------------------------------------------------------------------
// ttp/pressable-needs-a11y
// ---------------------------------------------------------------------------

const TAPPABLES = new Set(["Pressable", "TouchableOpacity"]);

const pressableNeedsA11y = {
	meta: {
		type: "suggestion",
		docs: { description: "Every tappable carries an accessibilityRole and an accessibilityLabel." },
		schema: [],
		messages: {
			missing:
				"<{{name}}> is missing {{what}} — every tappable carries role + label. See {{spec}}.",
		},
	},
	create(context) {
		return {
			JSXOpeningElement(node) {
				const name = jsxNameOf(node);
				if (!name || !TAPPABLES.has(name)) return;

				// Decorative / pass-through wrappers are exempt.
				const accessible = findAttr(node, "accessible");
				if (
					accessible &&
					accessible.value &&
					accessible.value.type === "JSXExpressionContainer" &&
					accessible.value.expression.type === "Literal" &&
					accessible.value.expression.value === false
				) {
					return;
				}
				const pointerEvents = findAttr(node, "pointerEvents");
				if (
					pointerEvents &&
					pointerEvents.value &&
					pointerEvents.value.type === "Literal" &&
					pointerEvents.value.value === "none"
				) {
					return;
				}

				const names = attrNames(node);
				const missing = [];
				if (!names.has("accessibilityRole")) missing.push("accessibilityRole");
				if (!names.has("accessibilityLabel")) missing.push("accessibilityLabel");
				if (missing.length === 0) return;
				context.report({
					node,
					messageId: "missing",
					data: { name, what: missing.join(" + "), spec: SPEC },
				});
			},
		};
	},
};

// ---------------------------------------------------------------------------
// ttp/no-space-arithmetic
// ---------------------------------------------------------------------------

const SPACE_OBJECTS = new Set(["SPACE", "RADII", "PAGE_PAD"]);

function isSpaceToken(node) {
	if (!node) return false;
	if (
		node.type === "MemberExpression" &&
		node.object.type === "Identifier" &&
		SPACE_OBJECTS.has(node.object.name)
	) {
		return node.object.name;
	}
	// PAGE_PAD is a bare number token, not an object.
	if (node.type === "Identifier" && node.name === "PAGE_PAD") return "PAGE_PAD";
	return false;
}

const noSpaceArithmetic = {
	meta: {
		type: "suggestion",
		docs: { description: "The spacing scale is the scale; a step off it needs a new token." },
		schema: [],
		messages: {
			math: "`{{token}} {{op}} n` — off-scale spacing; add a token to theme.ts instead. See {{spec}}.",
		},
	},
	create(context) {
		return {
			BinaryExpression(node) {
				if (node.operator !== "+" && node.operator !== "-") return;
				const token = isSpaceToken(node.left) || isSpaceToken(node.right);
				if (!token) return;
				context.report({
					node,
					messageId: "math",
					data: { token, op: node.operator, spec: SPEC },
				});
			},
		};
	},
};

// ---------------------------------------------------------------------------
// ttp/animated-needs-motion-policy
// ---------------------------------------------------------------------------

const ANIMATED_DRIVERS = new Set(["loop", "spring", "timing"]);
const MOTION_POLICY_NAMES = new Set(["useMotionPolicy", "startDecorativeLoop"]);

const animatedNeedsMotionPolicy = {
	meta: {
		type: "suggestion",
		docs: { description: "Animation obeys the motion policy (reduce-motion, battery, focus)." },
		schema: [],
		messages: {
			policy:
				"This file animates but never consults useMotionPolicy / startDecorativeLoop. See {{spec}}.",
		},
	},
	create(context) {
		let animates = false;
		let hasPolicy = false;
		let firstAnimation = null;

		return {
			ImportDeclaration(node) {
				// A bare `import "react-native-reanimated"` is the runtime
				// side-effect registration, not an animation — skip it.
				if (
					node.source.value === "react-native-reanimated" &&
					node.specifiers.length > 0
				) {
					animates = true;
					if (!firstAnimation) firstAnimation = node;
				}
			},
			CallExpression(node) {
				const callee = node.callee;
				if (
					callee.type === "MemberExpression" &&
					!callee.computed &&
					callee.object.type === "Identifier" &&
					callee.object.name === "Animated" &&
					callee.property.type === "Identifier" &&
					ANIMATED_DRIVERS.has(callee.property.name)
				) {
					animates = true;
					if (!firstAnimation) firstAnimation = node;
				}
			},
			Identifier(node) {
				if (MOTION_POLICY_NAMES.has(node.name)) hasPolicy = true;
			},
			JSXIdentifier(node) {
				if (MOTION_POLICY_NAMES.has(node.name)) hasPolicy = true;
			},
			"Program:exit"(node) {
				if (!animates || hasPolicy) return;
				context.report({ node: firstAnimation || node, messageId: "policy", data: { spec: SPEC } });
			},
		};
	},
};

// ---------------------------------------------------------------------------
// ttp/no-legacy-palette
// ---------------------------------------------------------------------------

const LEGACY_MODULES = new Set([
	"@/constants/Colors",
	"@/components/ThemedText",
	"@/components/ThemedView",
	"@/hooks/useThemeColor",
	"@/hooks/useColorScheme",
]);

const noLegacyPalette = {
	meta: {
		type: "suggestion",
		docs: { description: "The Expo template palette is retired; WHIMSY / UI_COLORS is the palette." },
		schema: [],
		messages: {
			colors:
				"Legacy `COLORS.{{prop}}` — fold to WHIMSY / UI_COLORS / PODIUM. See {{spec}}.",
			module: "Legacy theme module `{{source}}` is being deleted — use constants/theme.ts. See {{spec}}.",
		},
	},
	create(context) {
		return {
			MemberExpression(node) {
				if (node.object.type !== "Identifier" || node.object.name !== "COLORS") return;
				const prop =
					node.property.type === "Identifier" && !node.computed ? node.property.name : "…";
				context.report({ node, messageId: "colors", data: { prop, spec: SPEC } });
			},
			ImportDeclaration(node) {
				if (typeof node.source.value !== "string") return;
				if (!LEGACY_MODULES.has(node.source.value)) return;
				context.report({
					node,
					messageId: "module",
					data: { source: node.source.value, spec: SPEC },
				});
			},
		};
	},
};

// ---------------------------------------------------------------------------

module.exports = {
	rules: {
		"no-raw-style-literal": noRawStyleLiteral,
		"no-raw-modal": noRawModal,
		"no-activity-indicator": noActivityIndicator,
		"pressable-needs-a11y": pressableNeedsA11y,
		"no-space-arithmetic": noSpaceArithmetic,
		"animated-needs-motion-policy": animatedNeedsMotionPolicy,
		"no-legacy-palette": noLegacyPalette,
	},
};
