import fs from "node:fs";
import path from "node:path";
import {
	SOUNDER_COORDINATION_PRESETS,
	SOUNDER_RECRUITING_COPY,
} from "@/utils/sounderMessages";

const ROOT = path.resolve(__dirname, "..");
const migration = fs.readFileSync(
	path.join(
		ROOT,
		"supabase/migrations/20260826040000_preset_sounder_messages.sql"
	),
	"utf8"
);
const oinkSheet = fs.readFileSync(
	path.join(ROOT, "components/SounderOinkSheet.tsx"),
	"utf8"
);
const sounderCard = fs.readFileSync(
	path.join(ROOT, "components/SounderCard.tsx"),
	"utf8"
);
const playerInvitePicker = fs.readFileSync(
	path.join(ROOT, "components/PlayerInvitePicker.tsx"),
	"utf8"
);
const inbox = fs.readFileSync(path.join(ROOT, "components/Inbox.tsx"), "utf8");
const rootLayout = fs.readFileSync(path.join(ROOT, "app/_layout.tsx"), "utf8");

describe("preset Sounder messages", () => {
	it("pins the five approved pieces of copy", () => {
		expect(SOUNDER_RECRUITING_COPY).toBe("We saved you a place in our Sounder.");
		expect(SOUNDER_COORDINATION_PRESETS.map((preset) => preset.body)).toEqual([
			"The Truffle Patch is open—come dig!",
			"Dig when you can; the Feeding is waiting.",
			"One more pig can unlock our Sounder Bonus.",
			"Fine digging, Sounder!",
		]);
		for (const body of [
			SOUNDER_RECRUITING_COPY,
			...SOUNDER_COORDINATION_PRESETS.map((preset) => preset.body),
		]) {
			expect(migration).toContain(body);
		}
	});

	it("enforces recipient scope, moderation, state, and duplicate limits on the server", () => {
		expect(migration).toContain("public.are_blocked(caller_id, cm.user_id)");
		expect(migration).toContain("cm.crew_id = my_crew");
		expect(migration).toContain("c.leader_id = caller_id");
		expect(migration).toContain("public.invite_to_crew(p_invitee)");
		expect(migration).toContain("sounder_messages_one_recruit_per_invite_idx");
		expect(migration).toContain("sounder_messages_one_preset_per_feeding_idx");
		expect(migration).toContain("dug_count = 1 AND member_count > 1");
		expect(migration).toContain("'reason', 'bonus_condition_not_met'");
		expect(migration).toContain("'reason', 'already_sent'");
	});

	it("keeps both tables RPC-only and never sends an immediate OS push", () => {
		expect(migration).toContain(
			"REVOKE ALL ON TABLE public.sounder_messages FROM PUBLIC, anon, authenticated"
		);
		expect(migration).toContain(
			"REVOKE ALL ON TABLE public.sounder_message_recipients FROM PUBLIC, anon, authenticated"
		);
		expect(migration).not.toMatch(/GRANT\s+SELECT\s+ON TABLE public\.sounder_/);

		const sendBody = migration.slice(
			migration.indexOf("CREATE OR REPLACE FUNCTION public.send_sounder_coordination"),
			migration.indexOf("CREATE OR REPLACE FUNCTION public.invite_to_crew_with_recruiting")
		);
		const recruitBody = migration.slice(
			migration.indexOf("CREATE OR REPLACE FUNCTION public.invite_to_crew_with_recruiting"),
			migration.indexOf("CREATE OR REPLACE FUNCTION public.my_sounder_messages")
		);
		expect(sendBody).not.toContain("send_push_to_user");
		expect(recruitBody).not.toContain("send_push_to_user");
	});

	it("wires the two sender entry points with literal preset-only UI", () => {
		expect(sounderCard).toContain("Oink the Sounder");
		expect(sounderCard).toContain("<SounderOinkSheet");
		expect(oinkSheet).toContain("SOUNDER_COORDINATION_PRESETS.map");
		expect(oinkSheet).not.toContain("TextInput");
		expect(playerInvitePicker).toContain("Recruiting Oink:");
		expect(playerInvitePicker).toContain("Invite + Oink");
		expect(playerInvitePicker).toContain("inviteWithRecruiting(p.id)");
	});

	it("retains board history and marks only the dismissed next-active digest", () => {
		expect(inbox).toContain("fetchSounderMessages(100)");
		expect(inbox).toContain('kind: "sounder"');
		expect(rootLayout).toContain('rpc<SounderMessageRow[]>("my_unshown_sounder_messages"');
		expect(rootLayout).toContain('if (state === "active") check()');
		expect(rootLayout).toContain('event.source === "sounder"');
		expect(rootLayout).toContain('rpc("mark_sounder_messages_shown"');
		expect(migration).toContain("SET shown_at = COALESCE(shown_at, now())");
		expect(migration).toContain("CREATE OR REPLACE FUNCTION public.my_sounder_messages");
	});
});
