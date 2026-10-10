const ICONS = {
 "swords": "<path d=\"m13 19 6-6\"/><path d=\"M14.5 17.5 3.586 6.586A2 2 0 013 5.172V3h2.172a2 2 0 011.414.586L17.5 14.5\"/><path d=\"m14.828 6.172 2.586-2.586A2 2 0 0118.828 3H21v2.172a2 2 0 01-.586 1.414l-2.586 2.586\"/><path d=\"m16 16 4 4\"/><path d=\"m19 21 2-2\"/><path d=\"m5 14 4 4\"/><path d=\"m5 21-2-2\"/><path d=\"M7.5 16.5 4 20\"/>",
 "shield": "<path d=\"M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z\"/>",
 "hourglass": "<path d=\"M5 22h14\"/><path d=\"M5 2h14\"/><path d=\"M17 22v-4.172a2 2 0 0 0-.586-1.414L12 12l-4.414 4.414A2 2 0 0 0 7 17.828V22\"/><path d=\"M7 2v4.172a2 2 0 0 0 .586 1.414L12 12l4.414-4.414A2 2 0 0 0 17 6.172V2\"/>",
 "rotate-ccw": "<path d=\"M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8\"/><path d=\"M3 3v5h5\"/>",
 "book-open": "<path d=\"M12 5v16\"/><path d=\"M20.001 19A2 2 0 0022 17V5a2 2 0 00-1.999-2L16 3.002A5 5 0 0012 5a5 5 0 00-4-2H4a2 2 0 00-2 2v12a2 2 0 001.999 2H8a5 5 0 014 2 5 5 0 014-2z\"/>",
 "skull": "<path d=\"m12.5 17-.5-1-.5 1h1z\"/><path d=\"M15 22a1 1 0 0 0 1-1v-1a2 2 0 0 0 1.56-3.25 8 8 0 1 0-11.12 0A2 2 0 0 0 8 20v1a1 1 0 0 0 1 1z\"/><circle cx=\"15\" cy=\"12\" r=\"1\"/><circle cx=\"9\" cy=\"12\" r=\"1\"/>",
 "sparkles": "<path d=\"M11.017 2.814a1 1 0 0 1 1.966 0l1.051 5.558a2 2 0 0 0 1.594 1.594l5.558 1.051a1 1 0 0 1 0 1.966l-5.558 1.051a2 2 0 0 0-1.594 1.594l-1.051 5.558a1 1 0 0 1-1.966 0l-1.051-5.558a2 2 0 0 0-1.594-1.594l-5.558-1.051a1 1 0 0 1 0-1.966l5.558-1.051a2 2 0 0 0 1.594-1.594z\"/><path d=\"M20 2v4\"/><path d=\"M22 4h-4\"/><circle cx=\"4\" cy=\"20\" r=\"2\"/>",
 "flame": "<path d=\"M12 3q1 4 4 6.5t3 5.5a1 1 0 0 1-14 0 5 5 0 0 1 1-3 1 1 0 0 0 5 0c0-2-1.5-3-1.5-5q0-2 2.5-4\"/>",
 "moon": "<path d=\"M20.985 12.486a9 9 0 1 1-9.473-9.472c.405-.022.617.46.402.803a6 6 0 0 0 8.268 8.268c.344-.215.825-.004.803.401\"/>",
 "menu": "<path d=\"M4 5h16\"/><path d=\"M4 12h16\"/><path d=\"M4 19h16\"/>",
 "layers": "<path d=\"M12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83z\"/><path d=\"M2 12a1 1 0 0 0 .58.91l8.6 3.91a2 2 0 0 0 1.65 0l8.58-3.9A1 1 0 0 0 22 12\"/><path d=\"M2 17a1 1 0 0 0 .58.91l8.6 3.91a2 2 0 0 0 1.65 0l8.58-3.9A1 1 0 0 0 22 17\"/>",
 "scroll-text": "<path d=\"M15 12h-5\"/><path d=\"M15 8h-5\"/><path d=\"M19 17V5a2 2 0 0 0-2-2H4\"/><path d=\"M8 21h12a2 2 0 0 0 2-2v-1a1 1 0 0 0-1-1H11a1 1 0 0 0-1 1v1a2 2 0 1 1-4 0V5a2 2 0 1 0-4 0v2a1 1 0 0 0 1 1h3\"/>",
 "sun": "<circle cx=\"12\" cy=\"12\" r=\"4\"/><path d=\"M12 2v2\"/><path d=\"M12 20v2\"/><path d=\"m4.93 4.93 1.41 1.41\"/><path d=\"m17.66 17.66 1.41 1.41\"/><path d=\"M2 12h2\"/><path d=\"M20 12h2\"/><path d=\"m6.34 17.66-1.41 1.41\"/><path d=\"m19.07 4.93-1.41 1.41\"/>",
 "flag": "<path d=\"M4 22V4a1 1 0 0 1 .4-.8A6 6 0 0 1 8 2c3 0 5 2 7.333 2q2 0 3.067-.8A1 1 0 0 1 20 4v10a1 1 0 0 1-.4.8A6 6 0 0 1 16 16c-3 0-5-2-8-2a6 6 0 0 0-4 1.528\"/>",
 "settings": "<path d=\"M9.671 4.136a2.34 2.34 0 0 1 4.659 0 2.34 2.34 0 0 0 3.319 1.915 2.34 2.34 0 0 1 2.33 4.033 2.34 2.34 0 0 0 0 3.831 2.34 2.34 0 0 1-2.33 4.033 2.34 2.34 0 0 0-3.319 1.915 2.34 2.34 0 0 1-4.659 0 2.34 2.34 0 0 0-3.32-1.915 2.34 2.34 0 0 1-2.33-4.033 2.34 2.34 0 0 0 0-3.831A2.34 2.34 0 0 1 6.35 6.051a2.34 2.34 0 0 0 3.319-1.915\"/><circle cx=\"12\" cy=\"12\" r=\"3\"/>",
 "sword": "<path d=\"m11 19-6-6\"/><path d=\"m5 21-2-2\"/><path d=\"m8 16-4 4\"/><path d=\"M9.5 17.5 20.414 6.586A2 2 0 0021 5.172V3h-2.172a2 2 0 00-1.414.586L6.5 14.5\"/>",
 "hand": "<path d=\"M18 11V6a2 2 0 0 0-2-2a2 2 0 0 0-2 2\"/><path d=\"M14 10V4a2 2 0 0 0-2-2a2 2 0 0 0-2 2v2\"/><path d=\"M10 10.5V6a2 2 0 0 0-2-2a2 2 0 0 0-2 2v8\"/><path d=\"M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15\"/>",
 "library-big": "<rect width=\"8\" height=\"18\" x=\"3\" y=\"3\" rx=\"1\"/><path d=\"M7 3v18\"/><path d=\"M20.4 18.9c.2.5-.1 1.1-.6 1.3l-1.9.7c-.5.2-1.1-.1-1.3-.6L11.1 5.1c-.2-.5.1-1.1.6-1.3l1.9-.7c.5-.2 1.1.1 1.3.6Z\"/>",
 "ghost": "<path d=\"M15 10v1\"/><path d=\"M7.528 20.472a1.6 1.6 0 012.277 0l1.057 1.056a1.6 1.6 0 002.276 0l1.057-1.056a1.6 1.6 0 012.277 0l1.114 1.114a1.4 1.4 0 002.414-1V10a8 8 0 00-16 0v10.586a1.4 1.4 0 002.414 1z\"/><path d=\"M9 10v1\"/>",
 "archive": "<rect width=\"20\" height=\"5\" x=\"2\" y=\"3\" rx=\"1\"/><path d=\"M4 8v11a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8\"/><path d=\"M10 12h4\"/>"
};

/*
 * Mockup only: draws two example scenes onto the table. Nothing here is game
 * logic – the real table gets every value from Forge.
 */

const SZENEN = {
  konzept: {
    zug: 7, amZug: "ich",
    gegner: {
      leben: 16, hand: 7, bibliothek: 42, friedhof: { anzahl: 7, oben: "Lightning Bolt" }, exil: 1,
      kreaturen: [{ k: "Serra Angel", pt: "4/4", ziel: true }, { k: "Snapcaster Mage", pt: "2/1" }, { k: "Goblin Guide", pt: "2/2" }],
      andere: [{ k: "Plains", n: 2 }, { k: "Island", n: 2, getappt: true }, { k: "Mountain" }, { k: "Hallowed Fountain" }],
    },
    ich: {
      leben: 20, bibliothek: 38, friedhof: { anzahl: 3, oben: "Thoughtseize" }, exil: 0,
      kreaturen: [{ k: "Llanowar Elves", pt: "1/1" }, { k: "Tarmogoyf", pt: "3/4", getappt: true, angriff: true }, { k: "Courser of Kruphix", pt: "2/4" }],
      andere: [{ k: "Forest", n: 2 }, { k: "Island", getappt: true }, { k: "Mountain", getappt: true }, { k: "Breeding Pool" }, { k: "Steam Vents" }],
    },
    hand: [["Thoughtseize"], ["Lightning Bolt", 1], ["Counterspell", 1], ["Supreme Verdict"], ["Growth Spiral", 1], ["Fatal Push"], ["Llanowar Elves"]],
    chronik: [
      { k: "Counterspell", gegner: true, text: "Ziel: Blitzschlag" },
      { k: "Lightning Bolt", text: "Ziel: Serra-Engel", pfeil: true },
      { k: "Brainstorm", text: "Von dir gewirkt" },
    ],
    phase: ["kampf", "angreifer"],
  },
  voll: {
    zug: 14, amZug: "ich",
    gegner: {
      leben: 9, hand: 4, bibliothek: 27, friedhof: { anzahl: 18, oben: "Counterspell" }, exil: 3,
      kreaturen: [{ k: "Serra Angel", pt: "4/4", ziel: true }, { k: "Baneslayer Angel", pt: "5/5" }, { k: "Thalia, Guardian of Thraben", pt: "2/1" }, { k: "Snapcaster Mage", pt: "2/1" }, { k: "Spell Queller", pt: "2/3" }, { k: "Goblin Guide", pt: "2/2", n: 2 }, { k: "Monastery Swiftspear", pt: "1/2" }, { k: "Glorybringer", pt: "4/4", getappt: true }],
      andere: [{ k: "Jace, the Mind Sculptor", treue: 3 }, { k: "Sol Ring" }, { k: "Rest in Peace" }, { k: "Plains", n: 3 }, { k: "Island", n: 3, getappt: true }, { k: "Mountain", n: 2 }, { k: "Hallowed Fountain" }, { k: "Steam Vents", getappt: true }],
    },
    ich: {
      leben: 13, bibliothek: 24, friedhof: { anzahl: 15, oben: "Fatal Push" }, exil: 2,
      kreaturen: [{ k: "Llanowar Elves", pt: "1/1", n: 2 }, { k: "Tarmogoyf", pt: "5/6", getappt: true, angriff: true }, { k: "Questing Beast", pt: "4/4", getappt: true, angriff: "Jace, the Mind Sculptor" }, { k: "Courser of Kruphix", pt: "2/4" }, { k: "Tireless Tracker", pt: "3/2" }, { k: "Lotus Cobra", pt: "2/1" }, { k: "Shivan Dragon", pt: "5/5" }, { k: "Grizzly Bears", pt: "2/2" }],
      andere: [{ k: "Oko, Thief of Crowns", treue: 5 }, { k: "Sol Ring", getappt: true }, { k: "Forest", n: 4 }, { k: "Island", n: 2, getappt: true }, { k: "Swamp" }, { k: "Breeding Pool", n: 2 }, { k: "Steam Vents", getappt: true }],
    },
    hand: [["Thoughtseize"], ["Lightning Bolt", 1], ["Counterspell", 1], ["Supreme Verdict"], ["Growth Spiral", 1], ["Fatal Push", 1], ["Brainstorm", 1], ["Llanowar Elves"], ["Serra Angel"]],
    chronik: [
      { k: "Counterspell", gegner: true, text: "Ziel: Wachstumsspirale" },
      { k: "Growth Spiral", text: "Von dir gewirkt" },
      { k: "Lightning Bolt", text: "Ziel: Serra-Engel", pfeil: true },
      { k: "Brainstorm", gegner: true, text: "Vom Gegner gewirkt" },
      { k: "Fatal Push", text: "Ziel: Goblin-Wegefinder" },
    ],
    phase: ["kampf", "angreifer"],
  },
};

const PHASEN = [
  { id: "anfang", name: "Anfang", icon: "rotate-ccw", schritte: [["enttappen", "Enttappen"], ["versorgung", "Versorgung"], ["ziehen", "Ziehen"]] },
  { id: "haupt1", name: "Erste Hauptphase", icon: "sparkles" },
  { id: "kampf", name: "Kampf", icon: "swords", schritte: [["beginn", "Kampfbeginn"], ["angreifer", "Angreifer"], ["blocker", "Blocker"], ["schaden", "Kampfschaden"], ["ende", "Kampfende"]] },
  { id: "haupt2", name: "Zweite Hauptphase", icon: "sparkles" },
  { id: "ende", name: "Ende", icon: "moon", schritte: [["endsegment", "Endsegment"], ["aufraeumen", "Aufräumen"]] },
];

const ico = (name) => `<svg class="ico" viewBox="0 0 24 24" aria-hidden="true">${ICONS[name]}</svg>`;
const de = (k) => KARTEN[k].de;
const bild = (k) => KARTEN[k].img;
const $ = (id) => document.getElementById(id);

function karte(c) {
  const n = c.n || 1;
  const klassen = ["karte", c.getappt && "getappt", c.angriff && "angriff", c.ziel && "ziel"].filter(Boolean).join(" ");
  let schichten = "";
  for (let i = 0; i < n; i++) schichten += `<img class="karte-bild" style="--k:${i}" src="${bild(c.k)}" alt="${i === n - 1 ? de(c.k) : ""}" decoding="async">`;
  const werte = c.pt ? `<span class="werte">${c.pt}</span>` : c.treue ? `<span class="werte treue">${ico("shield")}${c.treue}</span>` : "";
  const angriff = c.angriff ? ` data-angriff="${c.angriff === true ? "spieler" : c.angriff}"` : "";
  return `<div class="${klassen}" data-k="${c.k}"${c.ziel ? " data-pfeil-ziel" : ""}${angriff}><div class="karte-flaeche" style="--n:${n}">${n > 1 ? `<span class="stapel-zahl">×${n}</span>` : ""}${schichten}${werte}</div></div>`;
}

function reihe(karten, art) {
  // --u: row width in card widths (tapped ≈ 1.4, a pile grows by 0.12 per card), --c: number of slots.
  const u = karten.reduce((s, c) => s + (c.getappt ? 1.4 : 1) + 0.12 * ((c.n || 1) - 1), 0);
  return `<div class="reihe ${art}" style="--u:${u.toFixed(2)};--c:${karten.length}">${karten.map(karte).join("")}</div>`;
}

function feld(seite) {
  return reihe(seite.kreaturen, "kreaturen") + reihe(seite.andere, "andere");
}

function medaillon(leben, band, amZug) {
  return `<div id="medaillon-${band === "Du" ? "ich" : "gegner"}" class="medaillon${amZug ? " am-zug" : ""}"><svg viewBox="0 0 120 120"><use href="#medaillon"/></svg><span class="leben">${leben}</span><span class="medaillon-band">${band}</span></div>`;
}

function zonen(seite) {
  return `<div class="zone"><div class="zone-karte bibliothek"><svg viewBox="0 0 63 88"><use href="#rueckseite"/></svg></div><span class="zone-zahl">${seite.bibliothek}</span><span class="zone-name">Bibliothek</span></div>
    <div class="zone"><div class="zone-karte friedhof"><img src="${bild(seite.friedhof.oben)}" alt="Friedhof: ${de(seite.friedhof.oben)}"></div><span class="zone-zahl">${seite.friedhof.anzahl}</span><span class="zone-name">Friedhof</span></div>`;
}

function render(name) {
  const s = SZENEN[name];
  $("tisch").dataset.szene = name;
  zustand.szene = name;
  $("zug-info").innerHTML = `Zug <b>${s.zug}</b> · ${s.amZug === "ich" ? "Dein Zug" : "Gegner am Zug"}`;
  $("kopf-nav").innerHTML = [["skull", "Friedhof"], ["ghost", "Exil"], ["scroll-text", "Protokoll"], ["settings", "Einstellungen"]]
    .map(([i, t]) => `<button type="button">${ico(i)}<span>${t}</span></button>`).join("");
  document.querySelector('[data-icon="menu"]').innerHTML = ico("menu");

  let rueck = "";
  for (let i = 0; i < s.gegner.hand; i++) rueck += `<svg class="rueckseite" viewBox="0 0 63 88"><use href="#rueckseite"/></svg>`;
  $("leiste-gegner").innerHTML = `<div class="leiste-links"><div class="rueckseiten">${rueck}</div><span class="anzahl-text"><b>${s.gegner.hand}</b> Hand</span></div>
    ${medaillon(s.gegner.leben, "Gegner", s.amZug !== "ich")}<div class="leiste-rechts">${zonen(s.gegner)}</div>`;
  $("leiste-ich").innerHTML = `<div class="leiste-links"><span class="anzahl-text"><b>${s.hand.length}</b> Hand</span><span class="anzahl-text"><b>${s.ich.exil}</b> Exil</span></div>
    ${medaillon(s.ich.leben, "Du", s.amZug === "ich")}<div class="leiste-rechts">${zonen(s.ich)}</div>`;

  $("feld-gegner").innerHTML = feld(s.gegner);
  $("feld-ich").innerHTML = feld(s.ich);

  const n = s.hand.length, mitte = (n - 1) / 2;
  $("hand").innerHTML = s.hand.map(([k, spielbar], i) => {
    const d = i - mitte;
    return `<div class="hand-karte${spielbar ? " spielbar" : ""}" style="--n:${n};--rot:${(d * Math.min(3.2, 24 / n)).toFixed(2)}deg;--dy:${(d * d * Math.min(1.1, 8 / n)).toFixed(2)}%"><img src="${bild(k)}" alt="${de(k)}"></div>`;
  }).join("");

  $("chronik").innerHTML = `<div class="tafel-kopf"><h2 class="tafel-titel">Zauber&shy;chronik</h2><span class="tafel-zahl">${s.chronik.length}</span></div>
    <ol class="chronik-liste">${s.chronik.map((e, i) => `<li class="chronik-eintrag${i === 0 ? " oben" : ""}${e.gegner ? " gegner" : ""}"${e.pfeil ? " data-pfeil-start" : ""}>
      <img src="${bild(e.k)}" alt=""><div style="min-width:0"><div class="chronik-name">${de(e.k)}</div><div class="chronik-text">${e.text}</div></div><span class="chronik-nr">${s.chronik.length - i}</span></li>`).join("")}</ol>`;

  const [pAktiv, sAktiv] = s.phase;
  const pIndex = PHASEN.findIndex((p) => p.id === pAktiv);
  const liste = PHASEN.map((p, i) => {
    const zustand = i < pIndex ? "vorbei" : i === pIndex ? "laufend" : "";
    let unter = "";
    if (i === pIndex && p.schritte) {
      const sIndex = p.schritte.findIndex(([id]) => id === sAktiv);
      unter = `<ol class="schritte">${p.schritte.map(([id, t], j) => `<li class="schritt ${j < sIndex ? "vorbei" : j === sIndex ? "aktiv" : ""}">${t}</li>`).join("")}</ol>`;
    }
    return `<li><div class="phase ${zustand}">${ico(p.icon)}<span>${p.name}</span></div>${unter}</li>`;
  }).join("");
  const schrittName = PHASEN[pIndex].schritte?.find(([id]) => id === sAktiv)?.[1];
  const weiter = `<button class="weiter" type="button">Weiter</button>`;
  $("phasen").innerHTML = `<div class="tafel-kopf"><h2 class="tafel-titel">Phasen</h2><span class="tafel-unter">Zug ${s.zug}</span></div>
    <ol class="phasen-liste">${liste}</ol>${weiter}<div class="weiter-hinweis"><b>Du</b> hast Priorität</div>`;
  $("aktionsleiste").innerHTML = `<div class="phasen-kompakt"><div class="phasen-punkte">${PHASEN.map((p, i) => `<span class="${i < pIndex ? "vorbei" : i === pIndex ? "laufend" : ""}" title="${p.name}">${ico(p.icon)}</span>`).join("")}</div>
    <div class="phasen-text"><b>${PHASEN[pIndex].name}${schrittName ? " · " + schrittName : ""}</b> · Du hast Priorität</div></div>${weiter}`;

  requestAnimationFrame(() => { tischZeichnen(); pfeil(); });
}

// Arrows: the spell in the Zauberchronik to its target (red), attackers to whom they attack (amber).
function pfeil() {
  const svg = $("pfeile");
  svg.querySelectorAll("path.pfeil-linie, path.pfeil-glut").forEach((p) => p.remove());
  const t = $("tisch").getBoundingClientRect();
  const hoch = matchMedia("(max-aspect-ratio: 3/4)").matches;
  const zeichne = (d, art) => svg.insertAdjacentHTML("beforeend",
    `<path class="pfeil-glut ${art}" d="${d}"/><path class="pfeil-linie ${art}" d="${d}" marker-end="url(#${art === "angriff" ? "pfeilspitze-angriff" : "pfeilspitze"})"/>`);
  const vorne = (karte) => karte.querySelector(".karte-bild:last-of-type").getBoundingClientRect();

  const start = document.querySelector("[data-pfeil-start]");
  const ziel = document.querySelector("[data-pfeil-ziel]");
  if (start && ziel && start.offsetParent) {
    const a = start.getBoundingClientRect(), b = vorne(ziel);
    // Leaves the Zauberchronik on the side facing the target and ends beside the card, never on its picture.
    const links = b.left + b.width / 2 < a.left + a.width / 2;
    const x1 = hoch ? a.left + a.width * 0.3 - t.left : (links ? a.left - t.left + 4 : a.right - t.left - 4);
    const y1 = hoch ? a.top - t.top + 4 : a.top + a.height / 2 - t.top;
    const x2 = (links && !hoch ? b.right + 6 : b.left - 6) - t.left, y2 = b.top + b.height / 2 - t.top;
    const cx = hoch ? Math.min(x1, x2) - 50 : (x1 + x2) / 2, cy = hoch ? (y1 + y2) / 2 + 20 : Math.min(y1, y2) - 50;
    zeichne(`M${x1} ${y1} Q${cx} ${cy} ${x2} ${y2}`, "ziel");
  }

  document.querySelectorAll("#feld-ich [data-angriff]").forEach((karte, i) => {
    const a = vorne(karte);
    const wen = karte.dataset.angriff;
    const zielKarte = wen === "spieler" ? null : document.querySelector(`#feld-gegner [data-k="${CSS.escape(wen)}"]`);
    const b = zielKarte ? vorne(zielKarte) : $("medaillon-gegner").getBoundingClientRect();
    const x1 = a.left + a.width / 2 - t.left, y1 = a.top - t.top - 6;
    const x2 = b.left + b.width / 2 - t.left, y2 = b.bottom - t.top + (zielKarte ? 8 : 14);
    const bogen = (i % 2 ? 1 : -1) * Math.min(80, Math.abs(y1 - y2) * 0.15);
    zeichne(`M${x1} ${y1} Q${(x1 + x2) / 2 + bogen} ${(y1 + y2) / 2} ${x2} ${y2}`, "angriff");
  });
}

const zustand = { szene: "konzept", tisch: "arkan" };

function waehle(gruppe, wert) {
  if (gruppe === "szene") render(wert);
  else { zustand.tisch = wert; $("tisch").dataset.tisch = wert; tischZeichnen(); }
  history.replaceState(null, "", `?szene=${zustand.szene}&tisch=${zustand.tisch}`);
  document.querySelectorAll(".vorlage-menue [data-gruppe] button").forEach((b) =>
    b.setAttribute("aria-pressed", String(zustand[b.parentElement.dataset.gruppe] === b.dataset.wert)));
}

// In the mockup the menu button opens the mockup menu.
document.querySelector('[data-icon="menu"]').addEventListener("click", (e) => { e.stopPropagation(); $("vorlage-menue").hidden = !$("vorlage-menue").hidden; });
document.addEventListener("click", (e) => { if (!$("vorlage-menue").contains(e.target)) $("vorlage-menue").hidden = true; });
document.querySelectorAll(".vorlage-menue [data-gruppe] button").forEach((b) => b.addEventListener("click", () => waehle(b.parentElement.dataset.gruppe, b.dataset.wert)));
// The playing area: from the opponent's strip to yours, in the battlefields' column.
function tischZeichnen() {
  const a = $("leiste-gegner").getBoundingClientRect(), b = $("leiste-ich").getBoundingClientRect();
  const flaeche = { getBoundingClientRect: () => ({ left: a.left, top: a.top, width: a.width, height: b.bottom - a.top }) };
  Tischflaeche.zeichnen($("tischflaeche"), zustand.tisch, flaeche);
}

// Thumb over the hand: the card nearest to the finger (by its resting position) is lifted.
(() => {
  let mitten = null;
  const heben = (x) => {
    const karten = [...document.querySelectorAll(".hand-karte")];
    if (!mitten) mitten = karten.map((k) => { const r = k.getBoundingClientRect(); return r.left + r.width / 2; });
    let beste = 0;
    mitten.forEach((m, i) => { if (Math.abs(m - x) < Math.abs(mitten[beste] - x)) beste = i; });
    karten.forEach((k, i) => k.classList.toggle("gehoben", i === beste));
  };
  const loslassen = () => { mitten = null; document.querySelectorAll(".hand-karte.gehoben").forEach((k) => k.classList.remove("gehoben")); };
  $("hand").addEventListener("pointerdown", (e) => { if (e.pointerType !== "mouse") { loslassen(); heben(e.clientX); } });
  $("hand").addEventListener("pointermove", (e) => { if (e.pointerType !== "mouse" && mitten) heben(e.clientX); });
  for (const art of ["pointerup", "pointercancel"]) $("hand").addEventListener(art, loslassen);
})();
new ResizeObserver(tischZeichnen).observe($("tisch"));
addEventListener("resize", () => requestAnimationFrame(pfeil));
addEventListener("load", pfeil);
const parameter = new URLSearchParams(location.search);
waehle("tisch", ["arkan", "astrolabium", "matte", "runen"].includes(parameter.get("tisch")) ? parameter.get("tisch") : "arkan");
waehle("szene", parameter.get("szene") === "voll" ? "voll" : "konzept");
