// The design system's front door.
//
// Spec §2, Primitive API contract: **`components/ui/index.tsx` exports
// everything and is the only sanctioned import path** [F-12, F-25]. It covered
// 9 of ~50 primitives before wave 2; a barrel that covers a fifth of the system
// is not a barrel, it is a suggestion — every screen went on reaching past it
// for a deep path, and a deep path is how a primitive gets forked instead of
// extended.
//
// Grouped the way the design canvas is: text · surfaces · controls · lists ·
// modals · feedback · pig · art.
//
// Two deliberate omissions: platform files (`RivePig.native` / `.web` — the
// index-resolved `./RivePig` is exported once and the bundler picks the build)
// and internals nothing outside `components/ui` imports (`rivePigContract`,
// `useRivePigPlayback`, `RivePigFallback`, `PigRenderer`'s private pieces).
// `pigRendererContract` and `rivePigAsset` ARE re-exported, because eight files
// outside this directory import them today.

// ── text ───────────────────────────────────────────────────────────────────
export {
	T,
	Display,
	PageTitle,
	SectionTitle,
	CardTitle,
	Body,
	BodyLg,
	BodySm,
	Label,
	Hand,
	HandLg,
	Numeral,
	Kicker,
	KickerPill,
	type TextRole,
	type TextTone,
	type TProps,
} from "./Text";
export { Divider, TitleRule } from "./Divider";
export { PageHeader, type PageHeaderVariant } from "./PageHeader";
export { StackPage } from "./StackPage";
export { SectionHeader } from "./SectionHeader";

// ── surfaces ───────────────────────────────────────────────────────────────
export { Sticker, Tape } from "./Sticker";
export { PageBackground } from "./PageBackground";
export { AnimatedBackground } from "./AnimatedBackground";
export { BarnOverlay } from "./BarnOverlay";
export { HangingSignsTabBar } from "./HangingSignsTabBar";

// ── controls ───────────────────────────────────────────────────────────────
export { Button } from "./Button";
export { IconButton } from "./IconButton";
export { TicketButton, type TicketButtonTone } from "./TicketButton";
export { SegmentedControl, type SegmentOption } from "./SegmentedControl";
export { TextField, type TextFieldState } from "./TextField";
export { Toggle, type ToggleProps } from "./Toggle";
export {
	Chip,
	Tag,
	Ribbon,
	type ChipTone,
	type ChipProps,
	type TagProps,
	type RibbonTone,
	type RibbonProps,
} from "./Chip";

// ── lists ──────────────────────────────────────────────────────────────────
export { ListRow, NavRow, type ListRowProps, type NavRowProps } from "./ListRow";
export { ReceiptRows, ReceiptRow, ReceiptNote, ReceiptTotal } from "./Receipt";
export { CrewRow } from "./CrewRow";
export {
	Accent,
	AccentNote,
	CrewPortrait,
	CrewSectionKicker,
	DashedRule,
	DiscText,
	FlagIcon,
	HandLink,
	RowStatus,
	SunPill,
	textOf,
	theCrew,
	CREW_ROW_INDENT,
} from "./SocialRows";
export { Avatar, type AvatarFill } from "./Avatar";
export { Stat } from "./Stat";
export { ProgressTrack } from "./ProgressTrack";
export {
	EffectCard,
	formatEffectCountdown,
	type EffectCardEffect,
	type EffectCardSize,
	type EffectKind,
} from "./EffectCard";

// ── modals ─────────────────────────────────────────────────────────────────
export { Sheet } from "./Sheet";
export { SlideUpSheet, SheetGrabber } from "./SlideUpSheet";
export { AdaptiveModalScaffold } from "./AdaptiveModalScaffold";
export { ConfirmDialog } from "./ConfirmDialog";
export { DialogButtonRow, type DialogTone } from "./DialogButtonRow";
export { DialogCloseRow } from "./DialogCloseRow";
export { Ceremony } from "./Ceremony";
export { ActionSheet, type ActionSheetItem } from "./ActionSheet";
export {
	SpotlightProvider,
	SpotlightTarget,
	SpotlightOverlay,
	type SpotlightRect,
} from "./Spotlight";
export {
	PopupQueueProvider,
	usePopupHold,
	usePopupActive,
	usePopupSlot,
	useUnmanagedModalHold,
	releasePopupThenNavigate,
	POPUP_HANDOFF_GAP_MS,
	POPUP_TEARDOWN_MS,
} from "./PopupQueue";

// ── feedback ───────────────────────────────────────────────────────────────
export { EmptyState, LoadingBeat, type EmptyStateKind } from "./EmptyState";
export { Skeleton, ListRowSkeleton } from "./Skeleton";
export { PageDots, type PageDotsProps } from "./PageDots";
export { showToast, ToastHost, type ToastTone, type ToastOpts } from "./Toast";
export { BuyCelebration, type BuyCelebrationHandle } from "./BuyCelebration";
export { TierUpBanner, type TierUpBannerHandle } from "./TierUpBanner";
export { WaitingRosie, ROSIE_LOADING_DELAY_MS } from "./WaitingRosie";

// ── pig ────────────────────────────────────────────────────────────────────
export {
	PigStage,
	forcedRitualItem,
	resolveSlot,
	resolvePigStageAssetAspect,
	type EquippedItem,
	type PigStageProps,
} from "./PigStage";
export { PigAvatar } from "./PigAvatar";
export { PigPortrait } from "./PigPortrait";
export { PrestigeAvatar } from "./PrestigeAvatar";
export { ProfileIdentity, type ProfileIdentityTitle } from "./ProfileIdentity";
export {
	PigRenderer,
	shouldUseRiveRenderer,
	type PigRendererKind,
	type PigRendererComponentProps,
	type PigRendererDecision,
} from "./PigRenderer";
export { RasterPig } from "./RasterPig";
export { SpritePig } from "./SpritePig";
export { RivePig, type RivePigProps } from "./RivePig";
export {
	PIG_ANIMATION_SPECS,
	pigMoodAnimation,
	resolvePigAnimation,
	pigAnimationDurationMs,
	type PigAnimation,
	type PigAnimationSpec,
	type PigEquipmentSelection,
	type PigMood,
	type PigReaction,
	type PigReactionKind,
	type PigRendererProps,
} from "./pigRendererContract";
export { RIVE_PIG_SOURCE } from "./rivePigAsset";

// ── art ────────────────────────────────────────────────────────────────────
export { Glyph, IconText, glyphSource, type GlyphName } from "./Glyph";
export { Icon, type IconName } from "./Icon";
export { SnoutCoin } from "./SnoutCoin";
export { TickleIcon } from "./TickleIcon";
export { Shovel } from "./Shovel";
export { BarnDoor } from "./BarnDoor";
export { Snout } from "./Snout";
export { Trotter } from "./Trotter";
export { RitualIconWell } from "./RitualIconWell";
export {
	AnimatedCosmetic,
	CosmeticGlow,
	type AnimatedCosmeticProps,
} from "./AnimatedCosmetic";
export {
	ConfettiBurst,
	type ConfettiBurstHandle,
	type ConfettiBurstProps,
} from "./ConfettiBurst";
export { HicBubble, PigBubbles, PigFollower } from "./PigRitualFx";
export { AlignmentBadge } from "./AlignmentBadge";
export { AlignmentBar } from "./AlignmentBar";
export { AlignmentEmblem, type AlignmentEmblemKind } from "./AlignmentEmblem";
