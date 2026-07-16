// Renders docs/roadmap/ROADMAP.md into a browsable planning page at
// landing/plan/index.html — status-colored, grouped, printable. Same
// paper-craft look as the Den. Deploy: cd landing && npx vercel --prod
//   node tools/build_roadmap.mjs
import { readFileSync, writeFileSync, mkdirSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const md = readFileSync(path.join(ROOT, "docs/roadmap/ROADMAP.md"), "utf8");

const STATUS = {
	"🔴": ["blocked", "#f6d4cf", "blocked on you"],
	"🟡": ["ready", "#ffe6a8", "staged / ready"],
	"🟢": ["done", "#cfe6c4", "done"],
	"🔵": ["planned", "#cfe0f2", "planned"],
	"💭": ["decision", "#e6dbf2", "decision needed"],
};
function badge(line) {
	for (const [emoji, [cls]] of Object.entries(STATUS))
		if (line.includes(emoji)) return { emoji, cls, text: line.replaceAll(emoji, "").trim() };
	return null;
}
const inl = (s) => s
	.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
	.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
	.replace(/`([^`]+)`/g, "<code>$1</code>");

const lines = md.split("\n");
let body = "", inList = false, inQuote = false;
const close = () => { if (inList) { body += "</div>"; inList = false; } if (inQuote) { body += "</blockquote>"; inQuote = false; } };
for (const L of lines) {
	if (/^> ?/.test(L)) { if (!inQuote) { close(); body += "<blockquote>"; inQuote = true; } body += inl(L.replace(/^> ?/, "")) + " "; continue; }
	if (/^# /.test(L)) { close(); body += `<h1>${inl(L.slice(2))}</h1>`; continue; }
	if (/^## /.test(L)) { close(); body += `<h2>${inl(L.slice(3))}</h2>`; continue; }
	if (/^- /.test(L)) {
		if (inQuote) { body += "</blockquote>"; inQuote = false; }
		if (!inList) { body += '<div class="items">'; inList = true; }
		const b = badge(L.slice(2));
		if (b) body += `<div class="item ${b.cls}"><span class="dot">${b.emoji}</span><span>${inl(b.text)}</span></div>`;
		else body += `<div class="item plain"><span>${inl(L.slice(2))}</span></div>`;
		continue;
	}
	if (/^\s*$/.test(L)) { close(); continue; }
	close(); body += `<p>${inl(L)}</p>`;
}
close();

const legend = Object.entries(STATUS)
	.map(([e, [cls, , label]]) => `<span class="lg ${cls}">${e} ${label}</span>`).join("");

const page = `<!DOCTYPE html><html lang="en"><head>
<meta charset="UTF-8"/><meta name="viewport" content="width=device-width, initial-scale=1.0"/>
<meta name="robots" content="noindex, nofollow"/><title>the plan</title>
<link href="https://fonts.googleapis.com/css2?family=Archivo:wght@500;700;800&family=Archivo+Black&display=swap" rel="stylesheet"/>
<style>
:root{--ink:#2a1f15;--paper:#fffaf0;--mute:#9a8c7a;}
*{box-sizing:border-box;margin:0;padding:0}
body{background:var(--paper);color:var(--ink);font-family:"Archivo",system-ui,sans-serif;padding:36px 18px 80px;display:flex;justify-content:center}
.gate{max-width:400px;margin:12vh auto 0;background:#fff;border:3px solid var(--ink);border-radius:22px;box-shadow:8px 8px 0 var(--ink);padding:28px;text-align:center;transform:rotate(-.4deg)}
.gate input{width:100%;border:2.5px solid var(--ink);border-radius:12px;padding:10px 14px;font-size:16px;font-family:inherit;margin:10px 0;background:var(--paper)}
.gate button{width:100%;border:2.5px solid var(--ink);border-radius:12px;padding:10px;font-weight:800;font-family:inherit;background:#ffd87a;cursor:pointer;box-shadow:3px 3px 0 var(--ink)}
.wrap{max-width:820px;width:100%;display:none}
.legendbar{display:flex;flex-wrap:wrap;gap:8px;margin:6px 0 20px;position:sticky;top:0;background:var(--paper);padding:10px 0;z-index:2}
.lg{font-size:12px;font-weight:700;padding:4px 10px;border:2px solid var(--ink);border-radius:20px}
h1{font-family:"Archivo Black";font-size:28px;margin:16px 0 6px}
h2{font-family:"Archivo Black";font-size:19px;margin:26px 0 10px;padding-bottom:6px;border-bottom:2.5px dashed var(--mute)}
blockquote{border:2px dashed var(--ink);border-radius:12px;background:#ffe0e4;padding:10px 14px;margin:10px 0;font-size:13px}
p{font-size:14px;margin:8px 0;color:var(--mute)}
.items{display:flex;flex-direction:column;gap:8px;margin:6px 0 4px}
.item{display:flex;gap:10px;align-items:flex-start;border:2.5px solid var(--ink);border-radius:12px;padding:10px 13px;box-shadow:3px 3px 0 var(--ink);font-size:14px;line-height:1.4}
.item .dot{flex:none}
.item.plain{border-style:dashed;box-shadow:none;background:#fff}
.blocked{background:#f6d4cf}.ready{background:#ffe6a8}.done{background:#cfe6c4}.planned{background:#cfe0f2}.decision{background:#e6dbf2}
code{background:var(--paper);border:1px solid var(--mute);border-radius:5px;padding:0 4px;font-size:.88em;word-break:break-word}
.ask{margin-top:30px;border:2.5px dashed var(--ink);border-radius:14px;padding:14px 16px;background:#fff;font-size:13px;color:var(--mute)}
.ask code{display:block;margin:6px 0;padding:6px 8px;color:var(--ink)}
</style></head><body>
<div class="gate" id="gate"><h1>the plan 🐷</h1><input id="pw" type="password" placeholder="the word the pigs whisper" autofocus/><button id="go">open</button></div>
<div class="wrap" id="wrap">
<div class="legendbar">${legend}</div>
${body}
<div class="ask"><strong>ask codex about this plan</strong> (from the repo root):
<code>tools/plan_ask.sh "what should I do first?"</code>
<code>tools/plan_ask.sh --edit "mark notifications done, add Discord setup"</code></div>
</div>
<script>
document.getElementById("go").addEventListener("click",()=>{
  if(document.getElementById("pw").value==="rosie-remembers"){document.getElementById("gate").style.display="none";document.getElementById("wrap").style.display="block";}
  else{document.getElementById("pw").style.borderColor="#b0483e";}
});
document.getElementById("pw").addEventListener("keydown",e=>{if(e.key==="Enter")document.getElementById("go").click();});
</script></body></html>`;

mkdirSync(path.join(ROOT, "landing/plan"), { recursive: true });
writeFileSync(path.join(ROOT, "landing/plan/index.html"), page);
console.log("roadmap built: landing/plan/index.html");
