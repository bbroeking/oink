// The Den builder — renders docs/ideas/the-den.md (+ archived player voices)
// into the password-protected page at landing/den/index.html.
//
//   node tools/build_den.mjs                 # rebuild page, fetch new voices
//   node tools/build_den.mjs --no-voices     # skip the feedback fetch (offline)
//   node tools/build_den.mjs --mark          # also flip fetched 'new' rows → 'seen'
//   DEN_PASS=... node tools/build_den.mjs    # override the gate passphrase
//
// Voices come from the feedback table via the secret-gated feedback_dump RPC
// (secret lives in the *_feedback_den.sql migration — repo-visible pull secret,
// rotatable with one UPDATE; threat model: player suggestions, not secrets).
// The page itself: gate (passphrase + "leave an idea at the door" public form)
// → AES-256-GCM-encrypted library. Deploy: cd landing && npx vercel --prod.
import { readFileSync, writeFileSync, mkdirSync, readdirSync } from "fs";
import { createRequire } from "module";
import crypto from "crypto";
import path from "path";
import { fileURLToPath } from "url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PASS = process.env.DEN_PASS || "rosie-remembers";
const args = new Set(process.argv.slice(2));

// ── supabase coords (same source the app uses) ───────────────────────────────
const supaSrc = readFileSync(path.join(ROOT, "utils/supabase.ts"), "utf8");
const SUPA_URL = supaSrc.match(/supabaseUrl = "([^"]+)"/)[1];
const SUPA_ANON = supaSrc.match(/supabaseAnonKey =\s*\n?\s*"([^"]+)"/)[1];

// ── pull secret from the migration (single source of truth) ─────────────────
function dumpSecret() {
	const dir = path.join(ROOT, "supabase/migrations");
	const file = readdirSync(dir).find((f) => f.endsWith("_feedback_den.sql"));
	if (!file) return null;
	const m = readFileSync(path.join(dir, file), "utf8").match(/den-[0-9a-f]{16,}/);
	return m ? m[0] : null;
}

// ── fetch voices ─────────────────────────────────────────────────────────────
async function fetchVoices() {
	const secret = dumpSecret();
	if (!secret) return { rows: [], note: "no feedback migration on disk yet" };
	const require2 = createRequire(path.join(ROOT, "package.json"));
	const { createClient } = require2("@supabase/supabase-js");
	const sb = createClient(SUPA_URL, SUPA_ANON);
	const { data, error } = await sb.rpc("feedback_dump", { p_secret: secret });
	if (error || !data?.ok) return { rows: [], note: `dump unavailable (${error?.message ?? "refused"})` };
	if (args.has("--mark") && data.rows.length) {
		const ids = data.rows.filter((r) => r.status === "new").map((r) => r.id);
		if (ids.length) await sb.rpc("feedback_mark", { p_secret: secret, p_ids: ids, p_status: "seen" });
	}
	return { rows: data.rows, note: null };
}

// ── minimal md → html ────────────────────────────────────────────────────────
function inline(s) {
	return s
		.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
		.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
		.replace(/\*([^*]+)\*/g, "<em>$1</em>")
		.replace(/`([^`]+)`/g, "<code>$1</code>");
}
function mdToHtml(md) {
	const lines = md.split("\n");
	let html = "", i = 0, inList = false, inQuote = false;
	const closeAll = () => {
		if (inList) { html += "</ul>\n"; inList = false; }
		if (inQuote) { html += "</blockquote>\n"; inQuote = false; }
	};
	while (i < lines.length) {
		const L = lines[i];
		if (/^\|/.test(L)) {
			closeAll();
			const rows = [];
			while (i < lines.length && /^\|/.test(lines[i])) { rows.push(lines[i]); i++; }
			const cells = (r) => r.replace(/^\||\|$/g, "").split("|").map((c) => inline(c.trim()));
			html += "<table><thead><tr>" + cells(rows[0]).map((c) => `<th>${c}</th>`).join("") + "</tr></thead><tbody>";
			for (const r of rows.slice(2)) html += "<tr>" + cells(r).map((c) => `<td>${c}</td>`).join("") + "</tr>";
			html += "</tbody></table>\n";
			continue;
		}
		if (/^---\s*$/.test(L)) { closeAll(); html += "<hr/>\n"; }
		else if (/^# /.test(L)) { closeAll(); html += `<h1>${inline(L.slice(2))}</h1>\n`; }
		else if (/^## /.test(L)) { closeAll(); html += `<h2>${inline(L.slice(3))}</h2>\n`; }
		else if (/^> ?/.test(L)) {
			if (!inQuote) { closeAll(); html += "<blockquote>"; inQuote = true; }
			html += inline(L.replace(/^> ?/, "")) + " ";
		}
		else if (/^- /.test(L)) {
			if (inQuote) { html += "</blockquote>\n"; inQuote = false; }
			if (!inList) { html += "<ul>"; inList = true; }
			html += `<li>${inline(L.slice(2))}</li>`;
		}
		else if (/^\s*$/.test(L)) { closeAll(); }
		else { closeAll(); html += `<p>${inline(L)}</p>\n`; }
		i++;
	}
	closeAll();
	return html;
}

// ── voices section ───────────────────────────────────────────────────────────
const KIND_LABEL = { idea: "an idea", bug: "something's broken", love: "a love note" };
function voicesHtml(rows, note) {
	let h = `<hr/><h1>voices from the bog</h1>`;
	if (note) return h + `<p><em>${inline(note)}</em></p>`;
	if (!rows.length) return h + `<p><em>no whispers yet — the door just opened.</em></p>`;
	for (const kind of ["idea", "bug", "love"]) {
		const group = rows.filter((r) => r.kind === kind);
		if (!group.length) continue;
		h += `<h2>${KIND_LABEL[kind]} (${group.length})</h2><ul>`;
		for (const r of group) {
			const d = (r.created_at || "").slice(0, 10);
			h += `<li><strong>${inline(r.username)}</strong> <em>${d} · ${r.source}${r.status === "folded" ? " · folded in" : ""}</em><br/>${inline(r.body)}</li>`;
		}
		h += `</ul>`;
	}
	return h;
}

// ── build ────────────────────────────────────────────────────────────────────
const md = readFileSync(path.join(ROOT, "docs/ideas/the-den.md"), "utf8");
const voices = args.has("--no-voices") ? { rows: [], note: "voices skipped (--no-voices)" } : await fetchVoices();
const contentHtml = mdToHtml(md) + voicesHtml(voices.rows, voices.note);

const salt = crypto.randomBytes(16);
const iv = crypto.randomBytes(12);
const key = crypto.pbkdf2Sync(PASS, salt, 310000, 32, "sha256");
const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
const ct = Buffer.concat([cipher.update(contentHtml, "utf8"), cipher.final(), cipher.getAuthTag()]);
const b64 = (b) => b.toString("base64");

const page = `<!DOCTYPE html>
<html lang="en"><head>
<meta charset="UTF-8"/><meta name="viewport" content="width=device-width, initial-scale=1.0"/>
<meta name="robots" content="noindex, nofollow"/>
<title>the den</title>
<link href="https://fonts.googleapis.com/css2?family=Archivo:wght@500;700;800&family=Archivo+Black&display=swap" rel="stylesheet"/>
<style>
:root{--ink:#2a1f15;--paper:#fffaf0;--rose:#ffd6dc;--sun:#ffd87a;--sage:#c9dec1;--mute:#9a8c7a;}
*{box-sizing:border-box;margin:0;padding:0}
body{background:var(--paper);color:var(--ink);font-family:"Archivo",system-ui,sans-serif;min-height:100vh;display:flex;align-items:flex-start;justify-content:center;padding:40px 18px}
.col{max-width:440px;width:100%;margin-top:6vh;display:flex;flex-direction:column;gap:22px}
.card{background:#fff;border:3px solid var(--ink);border-radius:22px;box-shadow:8px 8px 0 var(--ink);padding:26px 28px;transform:rotate(-.4deg)}
.card.door{transform:rotate(.5deg)}
.den{display:none;background:#fff;border:3px solid var(--ink);border-radius:22px;box-shadow:8px 8px 0 var(--ink);max-width:860px;width:100%;padding:30px 34px}
h1{font-family:"Archivo Black";font-size:24px;margin-bottom:8px}
.card p{color:var(--mute);font-size:14px;margin-bottom:14px}
input,textarea,select{width:100%;border:2.5px solid var(--ink);border-radius:12px;padding:9px 12px;font-size:15px;font-family:inherit;margin-bottom:10px;background:var(--paper)}
textarea{min-height:90px;resize:vertical}
button{width:100%;border:2.5px solid var(--ink);border-radius:12px;padding:10px;font-size:15px;font-weight:800;font-family:inherit;background:var(--sun);cursor:pointer;box-shadow:3px 3px 0 var(--ink)}
button:active{transform:translate(2px,2px);box-shadow:0 0 0}
.door button{background:var(--sage)}
.msg{font-size:13px;min-height:18px;margin-top:8px;text-align:center}
.msg.bad{color:#b0483e}.msg.good{color:#4a7a43}
.hp{position:absolute;left:-9999px;opacity:0;height:0;width:0}
.den h1{font-size:30px;margin:18px 0 8px}.den h2{font-family:"Archivo Black";font-size:20px;margin:26px 0 8px}
.den p{font-size:15px;line-height:1.55;margin:8px 0}.den li{font-size:15px;line-height:1.55;margin:4px 0 4px 18px}
.den blockquote{border:2px dashed var(--ink);border-radius:12px;background:var(--rose);padding:10px 14px;margin:12px 0;font-size:14px}
.den table{border-collapse:collapse;width:100%;margin:12px 0;font-size:13.5px;display:block;overflow-x:auto}
.den th,.den td{border:1.5px solid var(--ink);padding:6px 9px;text-align:left;vertical-align:top}
.den th{background:var(--sun)}.den code{background:var(--paper);border:1px solid var(--mute);border-radius:5px;padding:0 4px;font-size:.9em}
.den hr{border:none;border-top:2.5px dashed var(--mute);margin:20px 0}
</style></head><body>
<div class="col" id="col">
  <div class="card">
    <h1>the den 🐽</h1>
    <p>a quiet place for ideas that aren't ready for daylight. whisper the word.</p>
    <input id="pw" type="password" placeholder="the word the pigs whisper" autofocus/>
    <button id="go">open the den</button>
    <div class="msg bad" id="err"></div>
  </div>
  <div class="card door">
    <h1>or leave an idea at the door</h1>
    <p>no word needed — the pigs read everything left on the step.</p>
    <select id="fk"><option value="idea">an idea</option><option value="bug">something's broken</option><option value="love">a love note</option></select>
    <input id="fn" maxlength="24" placeholder="your name (or stay a passing pig)"/>
    <textarea id="fb" maxlength="1000" placeholder="what should the bog know?"></textarea>
    <input class="hp" id="fh" tabindex="-1" autocomplete="off" placeholder="leave this empty"/>
    <button id="fs">slip it under the door</button>
    <div class="msg" id="fm"></div>
  </div>
</div>
<article class="den" id="den"></article>
<script>
const SALT="${b64(salt)}",IV="${b64(iv)}",CT="${b64(ct)}";
const SUPA="${SUPA_URL}",ANON="${SUPA_ANON}";
const un=(s)=>Uint8Array.from(atob(s),c=>c.charCodeAt(0));
async function openDen(){
  const pw=document.getElementById("pw").value;
  const err=document.getElementById("err");err.textContent="";
  try{
    const km=await crypto.subtle.importKey("raw",new TextEncoder().encode(pw),"PBKDF2",false,["deriveKey"]);
    const key=await crypto.subtle.deriveKey({name:"PBKDF2",salt:un(SALT),iterations:310000,hash:"SHA-256"},km,{name:"AES-GCM",length:256},false,["decrypt"]);
    const pt=await crypto.subtle.decrypt({name:"AES-GCM",iv:un(IV)},key,un(CT));
    document.getElementById("den").innerHTML=new TextDecoder().decode(pt);
    document.getElementById("col").style.display="none";
    document.getElementById("den").style.display="block";
  }catch(e){err.textContent="that's not the word the pigs whisper.";}
}
async function slip(){
  const fm=document.getElementById("fm");fm.className="msg";fm.textContent="…";
  const body={p_kind:document.getElementById("fk").value,p_body:document.getElementById("fb").value.trim(),p_name:document.getElementById("fn").value.trim(),p_honey:document.getElementById("fh").value};
  try{
    const r=await fetch(SUPA+"/rest/v1/rpc/submit_feedback_web",{method:"POST",headers:{apikey:ANON,Authorization:"Bearer "+ANON,"Content-Type":"application/json"},body:JSON.stringify(body)});
    const j=await r.json().catch(()=>null);
    if(r.ok&&j&&j.ok){fm.className="msg good";fm.textContent="the bog heard you. thank you.";document.getElementById("fb").value="";}
    else if(j&&j.reason==="resting"){fm.className="msg bad";fm.textContent="the door's ears are full this hour — try again soon.";}
    else if(j&&(j.reason==="too_short"||j.reason==="too_long")){fm.className="msg bad";fm.textContent="a whisper needs a few words (but not a thousand).";}
    else{fm.className="msg bad";fm.textContent="the door's still being carved — try again soon.";}
  }catch(e){fm.className="msg bad";fm.textContent="the door's still being carved — try again soon.";}
}
document.getElementById("go").addEventListener("click",openDen);
document.getElementById("pw").addEventListener("keydown",e=>{if(e.key==="Enter")openDen();});
document.getElementById("fs").addEventListener("click",slip);
</script></body></html>`;

mkdirSync(path.join(ROOT, "landing/den"), { recursive: true });
writeFileSync(path.join(ROOT, "landing/den/index.html"), page);
console.log(`den built: landing/den/index.html · voices: ${voices.rows.length}${voices.note ? ` (${voices.note})` : ""} · ct ${ct.length}B`);
