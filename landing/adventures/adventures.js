"use strict";(()=>{var g="ttp.adventure-clickthrough.v1",c=Object.freeze([Object.freeze({id:"invitation",label:"Invitation"}),Object.freeze({id:"prepare",label:"Prepare"}),Object.freeze({id:"journey",label:"Journey"}),Object.freeze({id:"return",label:"Welcome Home"}),Object.freeze({id:"reflect",label:"Replay"})]),p=Object.freeze({destination:Object.freeze([Object.freeze({id:"clover-verge",name:"Clover Verge",detail:"After rain \xB7 puddle light \xB7 a humming fencepost"})]),tool:Object.freeze([Object.freeze({id:"wooden-spoon",name:"Wooden Spoon",detail:"Pry, tap, and listen without hurting small things"}),Object.freeze({id:"lantern",name:"Lantern",detail:"Notice paths and creatures that only answer light"})]),pack:Object.freeze([Object.freeze({id:"wicker-basket",name:"Wicker Basket",detail:"Carry sturdy Finds Home in the open air"}),Object.freeze({id:"dry-bag",name:"Dry Bag",detail:"Preserve wet, fragile Finds on the walk Home"})]),intention:Object.freeze([Object.freeze({id:"something-strange",name:"Look for something strange",detail:"Rosie follows the detail that does not quite belong"}),Object.freeze({id:"something-for-home",name:"Bring something for Home",detail:"Rosie favors a Find that can live near the Barn"})]),trip:Object.freeze([Object.freeze({id:"poke-around",name:"Poke Around",detail:"A short wander near the familiar path"}),Object.freeze({id:"good-wander",name:"Good Wander",detail:"Stay long enough for the Verge to change"})])}),i=Object.freeze({CHOOSE:"choose",NEXT:"next",BACK:"back",RESET:"reset",SET_REDUCED_MOTION:"set-reduced-motion",SET_VERDICT:"set-verdict"});function h({reduceMotion:e=!1}={}){return{version:1,step:0,destination:"clover-verge",tool:"wooden-spoon",pack:"wicker-basket",intention:"something-strange",trip:"poke-around",ticklesBefore:120,ticklesEarned:0,reduceMotion:e,verdict:{pull:null,resend:null},trace:["Opened the Adventure invitation"]}}function j(e,t){return p[e]?.some(n=>n.id===t)??!1}function k(e,t){return e.trace[e.trace.length-1]===t?e.trace:[...e.trace,t]}function w(e,t){switch(t.type){case i.CHOOSE:{if(!j(t.kind,t.value))return e;let n=o(t.kind,t.value);return{...e,[t.kind]:t.value,trace:k(e,`Chose ${t.kind}: ${n.name}`)}}case i.NEXT:{let n=Math.min(c.length-1,e.step+1);return n===e.step?e:{...e,step:n,ticklesEarned:n>=3?20:e.ticklesEarned,trace:k(e,`Reached ${c[n].label}`)}}case i.BACK:{let n=Math.max(0,e.step-1);return n===e.step?e:{...e,step:n}}case i.SET_REDUCED_MOTION:return{...e,reduceMotion:!!t.value};case i.SET_VERDICT:return Object.hasOwn(e.verdict,t.kind)?{...e,verdict:{...e.verdict,[t.kind]:t.value},trace:k(e,`Answered ${t.kind}: ${t.value}`)}:e;case i.RESET:return h({reduceMotion:e.reduceMotion});default:return e}}function o(e,t){return p[e]?.find(n=>n.id===t)??null}function m(e){return e.trip==="good-wander"&&e.tool==="wooden-spoon"?{kind:"Wonder",name:"The Hedge Bell",story:"Rosie tapped the hollow fencepost with the Wooden Spoon and waited. Near dusk, something beneath the hedge answered with one small bell note.",cause:"The longer wander gave the fencepost time to answer; the Spoon let Rosie listen without breaking the hiding place.",trace:"The Hedge Bell now hangs beside the Barn door.",next:"Would the Bell answer differently after rain, or if Rosie carried a light?"}:e.pack==="dry-bag"?{kind:"Discovery",name:"Creek Glass",story:"The puddle held a blue-green shard that looked like a piece of sky. Rosie sealed it in the Dry Bag before the rain-light could dissolve.",cause:"The Dry Bag preserved a wet, fragile Find that the open Wicker Basket could only remember as a clue.",trace:"Creek Glass rests on Rosie's Adventure shelf.",next:"What else appears only while Clover Verge is wet?"}:e.tool==="lantern"&&e.intention==="something-strange"?{kind:"Observation",name:"The Clover Beetle's Route",story:"The Lantern made a warm moon beneath the hedge. A green beetle crossed the light carrying a clover husk like a parcel.",cause:"The Lantern revealed a night path, and Rosie's strange-things intention kept her watching instead of collecting.",trace:"A beetle route is sketched in Rosie's Field Guide.",next:"Where does the tiny courier go when nobody lights the path?"}:{kind:"Curio + clue",name:"The Blue Button",story:"Rosie found a blue button beside Rain-Glass Puddle. The Basket brought the button Home, but a glimmer in the puddle vanished through its weave.",cause:"The Wicker Basket carried the sturdy Curio and taught Rosie that the glimmer needs something waterproof.",trace:"The Blue Button sits on the Barn shelf; Rain-Glass Puddle is marked for another visit.",next:"What would come Home if Rosie changed only the Pack?"}}function $(e){let t=m(e);return["Tickle the Pig \u2014 Adventure-only prototype",`Destination: ${o("destination",e.destination)?.name}`,`Tool: ${o("tool",e.tool)?.name}`,`Pack: ${o("pack",e.pack)?.name}`,`Intention: ${o("intention",e.intention)?.name}`,`Trip: ${o("trip",e.trip)?.name}`,`Return: ${t.kind} \u2014 ${t.name}`,`Home trace: ${t.trace}`,`Fixed homecoming reward: +${e.ticklesEarned} tickles`,`Primary pull: ${e.verdict.pull??"unanswered"}`,`Would resend: ${e.verdict.resend??"unanswered"}`].join(`
`)}function T(e){return JSON.stringify(e)}function S(e,{reduceMotion:t=!1}={}){if(!e)return h({reduceMotion:t});try{let n=JSON.parse(e),s=h({reduceMotion:t});return n?.version!==s.version?s:{...s,...n,step:Math.max(0,Math.min(c.length-1,Number(n.step)||0)),reduceMotion:t,verdict:{...s.verdict,...n.verdict},trace:Array.isArray(n.trace)?n.trace.slice(-30):s.trace}}catch{return h({reduceMotion:t})}}var y=document.querySelector("#adventure-root"),A=window.matchMedia("(prefers-reduced-motion: reduce)"),O=new URLSearchParams(window.location.search).get("fresh")==="1";O&&localStorage.removeItem(g);var a=S(O?null:localStorage.getItem(g),{reduceMotion:A.matches});a=R(a);function r(e){return String(e).replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#039;")}function R(e){let t=new URLSearchParams(window.location.search),n=e;for(let u of["destination","tool","pack","intention","trip"]){let f=t.get(u);f&&p[u].some(C=>C.id===f)&&(n={...n,[u]:f})}let s=t.get("step"),d=c.findIndex(u=>u.id===s);return d>=0&&(n={...n,step:d,ticklesEarned:d>=3?20:0}),n}function x(){localStorage.setItem(g,T(a));let e=new URL(window.location.href);e.searchParams.delete("fresh"),e.searchParams.set("step",c[a.step].id);for(let t of["tool","pack","intention","trip"])e.searchParams.set(t,a[t]);window.history.replaceState({},"",e)}function l(e,{announce:t=!0}={}){a=w(a,e),x(),b(),t&&document.querySelector("#screen-title")?.focus({preventScroll:!1})}function v(e,t){return`
		<fieldset class="choice-group">
			<legend>${r(t)}</legend>
			<div class="choice-list">
				${p[e].map(n=>{let s=a[e]===n.id;return`
							<button
								type="button"
								class="choice${s?" is-selected":""}"
								data-choice-kind="${e}"
								data-choice-value="${n.id}"
								aria-pressed="${s}"
							>
								<span class="choice-dot" aria-hidden="true"></span>
								<span><strong>${r(n.name)}</strong><small>${r(n.detail)}</small></span>
							</button>`}).join("")}
			</div>
		</fieldset>`}function B(){let e=o("destination",a.destination);return`
		<section class="screen scene-screen invitation-screen" aria-labelledby="screen-title">
			<img class="scene-image" src="./assets/homegrown-adventures/adventure-clearing-lantern.webp" alt="A narrow hedge path lit by faint lights at dusk" />
			<div class="scene-shade"></div>
			<div class="scene-copy sticker dark-sticker">
				<p class="hand-label">A possibility just beyond Home</p>
				<h2 id="screen-title" tabindex="-1">A glow beneath the hedge</h2>
				<p>Rosie noticed warm lights gathering near Clover Verge. Choose how she should look closer.</p>
				<div class="place-ticket">
					<span>${r(e.name)}</span>
					<small>${r(e.detail)}</small>
				</div>
			</div>
		</section>`}function z(){return`
		<section class="screen prepare-screen" aria-labelledby="screen-title">
			<div class="paper-heading">
				<p class="hand-label">Rosie's Adventure Bag</p>
				<h2 id="screen-title" tabindex="-1">Prepare a possibility</h2>
				<p>Nothing here is grown or harvested. Adventure choices stand on their own.</p>
			</div>
			<div class="bag-stage sticker sticker--sky sticker--sm sticker--straight" aria-hidden="true">
				<img src="./assets/homegrown-adventures/open-adventure-bag.webp" alt="" />
				<img class="bag-rosie" src="./rosie.png" alt="" />
			</div>
			<div class="choice-scroll">
				${v("tool","Choose one Tool")}
				${v("pack","Choose one Pack")}
				${v("intention","Give Rosie an Intention")}
				${v("trip","Choose the trip shape")}
			</div>
		</section>`}function N(){let e=o("tool",a.tool),t=o("pack",a.pack),n=o("intention",a.intention),s=o("trip",a.trip);return`
		<section class="screen scene-screen journey-screen" aria-labelledby="screen-title">
			<img class="scene-image" src="./assets/homegrown-adventures/adventure-clearing-discovery.webp" alt="A deep hedge clearing at dusk with a faint golden glow beneath the roots" />
			<div class="scene-shade"></div>
			<div class="journey-route" aria-hidden="true"><i></i><i></i><i></i><i></i></div>
			<div class="scene-copy sticker dark-sticker journey-note">
				<p class="hand-label">Clover Verge \xB7 while you are away</p>
				<h2 id="screen-title" tabindex="-1">Rosie follows what you made possible</h2>
				<ul class="causality-list">
					<li><strong>${r(e.name)}</strong><span>${r(e.detail)}</span></li>
					<li><strong>${r(t.name)}</strong><span>${r(t.detail)}</span></li>
					<li><strong>${r(n.name)}</strong><span>${r(s.name)} gives the choice time to matter.</span></li>
				</ul>
				<p class="journey-promise">The click-through skips the wait. The shipped game would let this unfold kindly while you are away.</p>
			</div>
		</section>`}function P(){let e=m(a);return`
		<section class="screen scene-screen return-screen" aria-labelledby="screen-title">
			<img class="scene-image" src="./assets/homegrown-adventures/return-homecoming-discovery.webp" alt="A lantern-lit Barn worktable facing an open hedge gate at dusk" />
			<div class="scene-shade return-shade"></div>
			<img class="return-rosie" src="./rosie.png" alt="Rosie home from her Adventure" />
			<div class="scene-copy sticker return-card">
				<p class="hand-label">${r(e.kind)} \xB7 Rosie is Home</p>
				<h2 id="screen-title" tabindex="-1">${r(e.name)}</h2>
				<p>${r(e.story)}</p>
				<div class="cause-receipt sticker sticker--sun sticker--flat sticker--straight"><strong>Your care mattered</strong><span>${r(e.cause)}</span></div>
				<div class="reward-row">
					<span><strong>+20 tickles</strong><small>fixed homecoming reward</small></span>
					<span><strong>${r(e.trace)}</strong><small>the world remembers</small></span>
				</div>
			</div>
		</section>`}function E(e,t,n){return`
		<fieldset class="verdict-group">
			<legend>${r(t)}</legend>
			<div>
				${n.map(([s,d])=>`
						<button type="button" data-verdict-kind="${e}" data-verdict-value="${s}" aria-pressed="${a.verdict[e]===s}" class="verdict-choice chip${a.verdict[e]===s?" is-selected":""}">${r(d)}</button>`).join("")}
			</div>
		</fieldset>`}function I(){let e=m(a);return`
		<section class="screen reflect-screen" aria-labelledby="screen-title">
			<div class="paper-heading">
				<p class="hand-label">The next page is yours</p>
				<h2 id="screen-title" tabindex="-1">Would you send Rosie again?</h2>
				<p class="next-question sticker sticker--sun sticker--flat sticker--straight">${r(e.next)}</p>
			</div>
			<div class="memory-strip sticker sticker--sky sticker--sm sticker--straight">
				<img src="./rosie.png" alt="Rosie waiting beside the Adventure journal" />
				<div><small>Home remembers</small><strong>${r(e.name)}</strong><span>${r(e.trace)}</span></div>
			</div>
			<div class="validation-sheet sticker sticker--straight">
				<h3>Two quick validation questions</h3>
				<p>No account, analytics, or personal data. Copy the anonymous result and send it back to the facilitator.</p>
				${E("pull","What most makes you want another Adventure?",[["place","The place"],["preparation","Changing preparation"],["rosie","Rosie's story"],["find","The named Find"],["nothing","Nothing yet"]])}
				${E("resend","Would you send Rosie out again?",[["yes","Yes"],["maybe","Maybe"],["no","No"]])}
				<div class="validation-actions">
					<button type="button" class="secondary-button btn btn--sm" data-action="copy">Copy anonymous result</button>
					<button type="button" class="primary-button btn btn--sm" data-action="change-one">Change one thing</button>
				</div>
				<p class="copy-status" role="status" aria-live="polite"></p>
			</div>
		</section>`}function D(){return c.map((e,t)=>`
		<li class="${t===a.step?"is-current":t<a.step?"is-complete":""}" ${t===a.step?'aria-current="step"':""}>
			<span>${t+1}</span><small>${r(e.label)}</small>
		</li>`).join("")}function H(){return[B,z,N,P,I][a.step]()}function b(){let e=a.step===0,t=a.step===c.length-1;y.innerHTML=`
		<header class="lab-header">
			<div>
				<a class="brand-link" href="./" aria-label="Tickle the Pig home"><span class="pig-mark" aria-hidden="true"><i></i></span>Tickle the Pig</a>
				<h1>Beyond the Hedge</h1>
				<p>An Adventure-only web click-through. No crops, plots, harvests, compost, or Farm stock.</p>
			</div>
			<div class="header-actions">
				<span class="lab-badge tag tag--sun">Local-only prototype</span>
				<button type="button" class="text-button btn btn--link" data-action="reset">Start fresh</button>
			</div>
		</header>
		<div class="question-bar sticker sticker--bark sticker--straight">
			<strong>Validation question</strong>
			<span>Does preparation create enough curiosity and causality that you want to send Rosie out again?</span>
		</div>
		<main class="review-layout">
			<section class="phone-stage" aria-label="Adventure prototype">
				<div class="phone ${a.reduceMotion?"reduce-motion":""}">
					<div class="phone-status" aria-hidden="true"><span>9:41</span><i></i><span>${a.ticklesBefore+a.ticklesEarned} tickles</span></div>
					${H()}
				</div>
				<div class="review-controls sticker sticker--straight">
					<button type="button" data-action="back" ${e?"disabled":""}><span aria-hidden="true">\u2190</span><strong>Previous</strong></button>
					<div><small>Adventure step</small><strong>${a.step+1} / ${c.length} \xB7 ${r(c[a.step].label)}</strong></div>
					<button type="button" data-action="next" ${t?"disabled":""}><strong>${a.step===2?"Welcome Home":"Next"}</strong><span aria-hidden="true">\u2192</span></button>
				</div>
			</section>
			<aside class="review-notes sticker">
				<h2>Adventure stands alone</h2>
				<p>The player begins with a nearby mystery, not a crop requirement. The choices change Rosie's story and Find; every return leaves a trace at Home.</p>
				<ol class="step-list">${D()}</ol>
				<div class="boundary-note sticker sticker--sky sticker--flat sticker--straight">
					<strong>Deliberate boundary</strong>
					<p>Farming can become its own game and reward lane. It does not unlock, provision, accelerate, or explain this Adventure loop.</p>
				</div>
				<label class="motion-toggle"><input type="checkbox" data-action="motion" ${a.reduceMotion?"checked":""} /><span>Reduce motion</span></label>
			</aside>
		</main>`}async function M(){let e=$(a);try{await navigator.clipboard.writeText(e);let t=document.querySelector(".copy-status");t&&(t.textContent="Anonymous result copied.")}catch{let t=document.createElement("textarea");t.value=e,document.body.append(t),t.select(),document.execCommand("copy"),t.remove();let n=document.querySelector(".copy-status");n&&(n.textContent="Anonymous result copied.")}}y.addEventListener("click",e=>{let t=e.target.closest("[data-choice-kind]");if(t){l({type:i.CHOOSE,kind:t.dataset.choiceKind,value:t.dataset.choiceValue},{announce:!1});return}let n=e.target.closest("[data-verdict-kind]");if(n){l({type:i.SET_VERDICT,kind:n.dataset.verdictKind,value:n.dataset.verdictValue},{announce:!1});return}let s=e.target.closest("[data-action]")?.dataset.action;s==="next"&&l({type:i.NEXT}),s==="back"&&l({type:i.BACK}),s==="change-one"&&(a={...a,step:1},x(),b(),document.querySelector("#screen-title")?.focus()),s==="copy"&&M(),s==="reset"&&l({type:i.RESET})});y.addEventListener("change",e=>{e.target.matches('[data-action="motion"]')&&l({type:i.SET_REDUCED_MOTION,value:e.target.checked},{announce:!1})});A.addEventListener("change",e=>{l({type:i.SET_REDUCED_MOTION,value:e.matches},{announce:!1})});window.addEventListener("popstate",()=>{a=R(a),b()});b();})();
