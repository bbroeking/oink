#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "../..");
const OUT = resolve(ROOT, "assets/images/habitat");
const SRC = resolve(OUT, "source");
const THUMBS = resolve(OUT, "thumbnails");
for (const dir of [OUT, SRC, THUMBS]) mkdirSync(dir, { recursive: true });

const ink = "#3A2C1E";
const outline = `stroke="${ink}" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"`;
const svg = (w, h, body, viewBox = `0 0 ${w} ${h}`) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="${viewBox}">${body}</svg>`;
const shadow = (x, y, rx, ry) => `<ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${ry}" fill="#3A2C1E" opacity=".18"/>`;

const room = (wall, plank, beam, floor, accent, extras) => svg(780, 1688, `
  <rect width="780" height="1688" fill="${wall}"/>
  <path d="M0 1050 L390 930 L780 1050 V1688 H0Z" fill="${floor}"/>
  <g opacity=".24" stroke="${plank}" stroke-width="5">${Array.from({length:10},(_,i)=>`<path d="M${i*86-20} 0 V1045"/>`).join("")}</g>
  <path d="M0 1048 L390 930 L780 1048" fill="none" stroke="${ink}" stroke-width="10"/>
  <g fill="${beam}" ${outline}><path d="M0 0H62V1090H0Z"/><path d="M718 0H780V1090H718Z"/><path d="M0 88L390 0L780 88V150L390 66L0 150Z"/></g>
  <g stroke="${plank}" stroke-width="4" opacity=".26">${Array.from({length:7},(_,i)=>`<path d="M0 ${1110+i*100} L780 ${1110+i*100}"/>`).join("")}</g>
  <g ${outline}><path d="M548 760H730V970H548Z" fill="${accent}"/><path d="M530 750H748V792H530Z" fill="#FFF3E2"/><circle cx="590" cy="852" r="8" fill="#FFD87A"/></g>
  <path d="M90 695H265" stroke="${ink}" stroke-width="12" stroke-linecap="round"/><path d="M105 705V760M250 705V760" stroke="${ink}" stroke-width="8"/>
  ${extras}
`);

const assets = {
  warm_plank_barn: room("#D99A62", "#8A5235", "#704027", "#D6AE78", "#A85C48", `<path d="M330 205Q390 155 450 205V470H330Z" fill="#C8E3F0" ${outline}/><path d="M390 170V470M330 310H450" stroke="${ink}" stroke-width="7"/>`),
  spring_whitewash: room("#F7E8D5", "#C6AD91", "#96A879", "#C8B58C", "#C9DEC1", `<g fill="#F8A8B3"><circle cx="118" cy="300" r="14"/><circle cx="145" cy="327" r="10"/><circle cx="668" cy="254" r="12"/></g><path d="M92 420Q150 365 205 420" fill="none" stroke="#789660" stroke-width="9"/>`),
  midnight_rafters: room("#28344C", "#53627B", "#241E2B", "#665B68", "#594760", `<circle cx="402" cy="252" r="98" fill="#FFE7A0" opacity=".88"/><circle cx="440" cy="225" r="99" fill="#28344C"/><g fill="#FFF3E2">${[[125,250],[220,405],[620,310],[690,510],[515,175]].map(([x,y])=>`<circle cx="${x}" cy="${y}" r="5"/>`).join("")}</g>`),

  rosies_pencil_sketch: svg(330,300,`${shadow(165,276,130,12)}<g ${outline}><rect x="20" y="18" width="290" height="250" rx="12" fill="#FFF3E2"/><rect x="42" y="40" width="246" height="206" fill="#FBE7D6" stroke-width="4"/><path d="M91 180Q80 120 130 94Q170 70 214 105Q250 130 229 181Q206 218 158 215Q112 216 91 180Z" fill="none"/><ellipse cx="151" cy="155" rx="47" ry="34" fill="#F8A8B3"/><circle cx="137" cy="151" r="5"/><circle cx="167" cy="151" r="5"/><path d="M122 119L109 87L144 107M195 113L219 87L212 125" fill="#F8A8B3"/></g>`),
  pressed_clover_frame: svg(300,330,`${shadow(150,304,120,12)}<g ${outline}><rect x="22" y="20" width="256" height="272" rx="18" fill="#B97C51"/><rect x="48" y="46" width="204" height="220" rx="8" fill="#FFF8DD"/><g fill="#7FA369" stroke-width="4"><path d="M150 225V145" fill="none"/><circle cx="130" cy="131" r="35"/><circle cx="170" cy="131" r="35"/><circle cx="150" cy="99" r="35"/><path d="M150 151L123 183L150 192L177 183Z"/></g></g>`),
  barn_bunting: svg(520,220,`<path d="M22 38Q260 120 498 38" fill="none" ${outline}/><g ${outline}>${[80,165,250,335,420].map((x,i)=>`<path d="M${x-31} ${58+i%2*14}L${x+31} ${69+i%2*14}L${x} 158Z" fill="${["#F8A8B3","#FFD87A","#C8E3F0","#C9DEC1","#D6C8F0"][i]}"/>`).join("")}</g>`),
  firefly_lantern: svg(300,440,`<path d="M150 8V82" ${outline}/><g ${outline}><path d="M83 101Q150 55 217 101L202 354Q150 396 98 354Z" fill="#6D513E"/><path d="M108 126Q150 98 192 126L181 328Q150 352 119 328Z" fill="#FFE593"/><path d="M78 99H222M97 360H203"/></g><g fill="#FFF8C5">${[[140,172],[166,220],[132,275],[173,304]].map(([x,y])=>`<circle cx="${x}" cy="${y}" r="10"/>`).join("")}</g>`),
  dried_herb_garland: svg(520,260,`<path d="M24 45Q260 218 496 45" fill="none" ${outline}/><g fill="#789660" stroke="${ink}" stroke-width="5">${[85,145,215,285,355,425].map((x,i)=>`<path d="M${x} ${75+i%2*28}Q${x-45} ${130+i%2*20} ${x} ${196+i%2*5}Q${x+45} ${130+i%2*20} ${x} ${75+i%2*28}Z"/>`).join("")}</g>`),
  sunflower_crock: svg(330,430,`${shadow(165,396,125,18)}<g ${outline}><path d="M86 222H244L225 385H105Z" fill="#C8E3F0"/><path d="M93 254Q165 286 237 254" fill="none" stroke="#FFF3E2" stroke-width="16"/><path d="M165 236V89M138 241L112 136M190 242L222 136" fill="none" stroke="#789660" stroke-width="12"/><g fill="#FFD87A">${[[165,78],[108,124],[225,124]].map(([x,y])=>`<g><circle cx="${x}" cy="${y}" r="48"/><circle cx="${x}" cy="${y}" r="19" fill="#704027"/></g>`).join("")}</g></g>`),
  reading_chair: svg(440,500,`${shadow(220,467,180,20)}<g ${outline}><path d="M90 198Q90 96 190 88H259Q353 96 350 198V371H90Z" fill="#D6C8F0"/><path d="M120 248Q220 205 320 248V391Q220 433 120 391Z" fill="#B8A4DE"/><path d="M90 240L48 221V354L115 375M350 240L392 221V354L325 375" fill="#D6C8F0"/><path d="M129 398L110 476M311 398L330 476"/></g>`),
  hay_bale: svg(390,330,`${shadow(195,301,166,18)}<g ${outline}><rect x="32" y="68" width="326" height="225" rx="48" fill="#D7B44A"/><path d="M91 75Q71 180 91 286M294 75Q314 180 294 286" fill="none" stroke="#80662B" stroke-width="13"/><g stroke="#FFF0A0" stroke-width="7">${[[110,120,165,95],[195,153,269,127],[87,221,157,201],[205,246,299,220]].map(v=>`<path d="M${v[0]} ${v[1]}L${v[2]} ${v[3]}"/>`).join("")}</g></g>`),
  milk_can_lamp: svg(320,500,`${shadow(160,470,122,18)}<g ${outline}><path d="M110 239H210L235 451H85Z" fill="#A8B8BD"/><path d="M118 211H202V252H118Z" fill="#E7ECE8"/><path d="M160 211V119"/><path d="M75 118Q160 32 245 118L218 220H102Z" fill="#FFD87A"/><path d="M98 345Q160 381 222 345" fill="none" stroke="#E7ECE8" stroke-width="10"/></g>`),
  patchwork_rug: svg(600,300,`${shadow(300,244,267,30)}<g ${outline}><path d="M45 52Q300 12 555 52L520 236Q300 276 80 236Z" fill="#F8A8B3"/><path d="M174 35L165 251M303 25L300 260M430 35L438 250M62 132Q300 98 538 132" fill="none" stroke-width="5"/><path d="M170 42L300 28L300 116L166 127ZM300 116L435 103L440 183L300 195Z" fill="#C8E3F0" stroke-width="4"/></g>`),
  braided_straw_rug: svg(600,300,`${shadow(300,249,270,28)}<g ${outline}><ellipse cx="300" cy="142" rx="264" ry="111" fill="#D9B760"/><ellipse cx="300" cy="142" rx="212" ry="82" fill="none" stroke="#FFF0A0" stroke-width="16"/><ellipse cx="300" cy="142" rx="148" ry="54" fill="none" stroke="#8F7038" stroke-width="12"/><ellipse cx="300" cy="142" rx="70" ry="23" fill="#FFF0A0"/></g>`),
  muddy_paw_rug: svg(600,310,`${shadow(300,256,270,28)}<g ${outline}><path d="M47 71Q300 20 553 71L519 247Q300 287 81 247Z" fill="#C8E3F0"/><g fill="#7B553F"><ellipse cx="295" cy="172" rx="65" ry="51"/><circle cx="220" cy="120" r="25"/><circle cx="273" cy="94" r="27"/><circle cx="330" cy="94" r="27"/><circle cx="382" cy="123" r="25"/></g></g>`),
  apple_basket: svg(350,300,`${shadow(175,274,145,15)}<g ${outline}><path d="M62 135H288L263 268H87Z" fill="#B97845"/><path d="M97 143Q102 44 175 44Q248 44 253 143" fill="none"/><g fill="#D85D50">${[[116,128],[168,112],[222,130],[143,161],[201,169]].map(([x,y])=>`<circle cx="${x}" cy="${y}" r="43"/>`).join("")}</g><g stroke="#FFF0B8" stroke-width="8"><path d="M77 185H273M72 225H278"/></g></g>`),
  guestbook_keepsake: svg(330,310,`${shadow(165,280,135,15)}<g ${outline}><path d="M43 64Q112 30 165 69Q218 30 287 64V270Q220 235 165 273Q110 235 43 270Z" fill="#FFF3E2"/><path d="M165 70V271"/><path d="M75 103H135M75 136H128M195 103H256" fill="none" stroke-width="5"/><path d="M203 187Q230 148 257 187Q254 222 230 235Q206 222 203 187Z" fill="#F8A8B3"/></g>`),
  tiny_radio: svg(340,300,`${shadow(170,271,135,15)}<g ${outline}><rect x="35" y="82" width="270" height="180" rx="24" fill="#F8A8B3"/><path d="M85 80L217 25"/><circle cx="115" cy="173" r="62" fill="#FFF3E2"/><g stroke-width="4"><circle cx="115" cy="173" r="43" fill="#D9B760"/><path d="M84 143L146 203M84 203L146 143"/></g><circle cx="251" cy="137" r="18" fill="#FFD87A"/><circle cx="251" cy="205" r="18" fill="#C8E3F0"/></g>`),
  barn_door: svg(260,300,`${gDoor("#A85C48")}`),
  workshop_cabinet: svg(360,500,`${shadow(180,472,145,18)}<g ${outline}><path d="M58 70H302V460H58Z" fill="#A85C48"/><path d="M82 101H278V427H82Z" fill="#D99A62"/><path d="M180 101V427"/><circle cx="154" cy="274" r="9" fill="#FFD87A"/><circle cx="206" cy="274" r="9" fill="#FFD87A"/><path d="M101 145H259M101 354H259"/><path d="M120 181H240V318H120Z" fill="#FFF3E2"/><circle cx="180" cy="248" r="42" fill="#C8E3F0"/><path d="M180 218V278M150 248H210"/></g>`),
  missing_item: svg(300,300,`${shadow(150,266,110,15)}<g ${outline}><path d="M52 62H248V252H52Z" fill="#F6E6D4"/><path d="M86 211L131 162L164 194L201 145L238 211" fill="#C9DEC1"/><circle cx="109" cy="116" r="22" fill="#FFD87A"/><path d="M150 103V158M150 188V194"/></g>`),
};

function gDoor(fill) { return `<g ${outline}><path d="M34 286V46Q130 -5 226 46V286Z" fill="${fill}"/><path d="M130 17V286M34 105H226M34 193H226"/><circle cx="107" cy="177" r="10" fill="#FFD87A"/><circle cx="153" cy="177" r="10" fill="#FFD87A"/></g>`; }

for (const [name, content] of Object.entries(assets)) {
  const source = resolve(SRC, `${name}.svg`);
  const output = resolve(OUT, `${name}.png`);
  writeFileSync(source, content);
  execFileSync("magick", ["-background", "none", source, "-strip", output]);
  if (!["warm_plank_barn", "spring_whitewash", "midnight_rafters"].includes(name)) {
    execFileSync("magick", [output, "-background", "none", "-gravity", "center", "-resize", "180x180", "-extent", "192x192", "-strip", resolve(THUMBS, `${name}.png`)]);
  } else {
    execFileSync("magick", [output, "-resize", "192x416^", "-gravity", "center", "-extent", "192x192", "-strip", resolve(THUMBS, `${name}.png`)]);
  }
}

const roomTriptych = resolve(SRC, "imagegen-room-triptych-v2.png");
if (existsSync(roomTriptych)) {
  [["warm_plank_barn", 20], ["spring_whitewash", 532], ["midnight_rafters", 1044]].forEach(([name, x]) => {
    const output = resolve(OUT, `${name}.png`);
    execFileSync("magick", [roomTriptych, "-crop", `473x1024+${x}+0`, "+repage", "-resize", "780x1688!", "-strip", output]);
    execFileSync("magick", [output, "-resize", "192x416^", "-gravity", "center", "-extent", "192x192", "-strip", resolve(THUMBS, `${name}.png`)]);
  });
}

const furnishingSheet = resolve(SRC, "imagegen-furnishings-sheet-v2.png");
if (existsSync(furnishingSheet)) {
  const furnishingCells = [
    ["rosies_pencil_sketch", "270x310+12+35"], ["pressed_clover_frame", "250x280+310+58"], ["barn_bunting", "390x250+570+55"], ["firefly_lantern", "245x330+970+8"], ["dried_herb_garland", "310x270+1225+40"],
    ["sunflower_crock", "275x355+5+345"], ["reading_chair", "330x345+290+355"], ["hay_bale", "325x260+615+420"], ["milk_can_lamp", "210x355+965+345"], ["patchwork_rug", "345x245+1190+430"],
    ["braided_straw_rug", "330x225+5+740"], ["muddy_paw_rug", "285x250+380+710"], ["apple_basket", "265x300+655+700"], ["guestbook_keepsake", "290x250+935+750"], ["tiny_radio", "305x285+1230+700"],
  ];
  const targetSizes = {
    rosies_pencil_sketch: "330x300", pressed_clover_frame: "300x330", barn_bunting: "520x220", firefly_lantern: "300x440", dried_herb_garland: "520x260",
    sunflower_crock: "330x430", reading_chair: "440x500", hay_bale: "390x330", milk_can_lamp: "320x500", patchwork_rug: "600x300",
    braided_straw_rug: "600x300", muddy_paw_rug: "600x310", apple_basket: "350x300", guestbook_keepsake: "330x310", tiny_radio: "340x300",
  };
  furnishingCells.forEach(([name, geometry]) => {
    const [, widthText, heightText] = geometry.match(/^(\d+)x(\d+)/);
    const width = Number(widthText), height = Number(heightText);
    const output = resolve(OUT, `${name}.png`);
    execFileSync("magick", [furnishingSheet, "-crop", geometry, "+repage", "-alpha", "on", "-fuzz", "12%", "-fill", "none", "-draw", `color 0,0 floodfill`, "-draw", `color ${width - 1},0 floodfill`, "-draw", `color 0,${height - 1} floodfill`, "-draw", `color ${width - 1},${height - 1} floodfill`, "-trim", "+repage", "-resize", targetSizes[name], "-gravity", "center", "-background", "none", "-extent", targetSizes[name], "-strip", output]);
    if (name === "apple_basket") {
      execFileSync("magick", [output, "-crop", "250x300+45+0", "+repage", "-gravity", "center", "-background", "none", "-extent", "350x300", output]);
    }
    execFileSync("magick", [output, "-background", "none", "-gravity", "center", "-resize", "180x180", "-extent", "192x192", "-strip", resolve(THUMBS, `${name}.png`)]);
  });
}

const guestbookSource = resolve(SRC, "imagegen-guestbook-keepsake-v3.png");
if (existsSync(guestbookSource)) {
  const output = resolve(OUT, "guestbook_keepsake.png");
  execFileSync("magick", [guestbookSource, "-trim", "+repage", "-resize", "330x310", "-gravity", "center", "-background", "none", "-extent", "330x310", "-strip", output]);
  execFileSync("magick", [output, "-background", "none", "-gravity", "center", "-resize", "180x180", "-extent", "192x192", "-strip", resolve(THUMBS, "guestbook_keepsake.png")]);
}

console.log(`Generated ${Object.keys(assets).length} habitat assets in ${OUT}`);
