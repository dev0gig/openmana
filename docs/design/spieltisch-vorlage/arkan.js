/*
 * Table variant "arkan": an arcanist's desk. The whole screen is a dark wooden
 * desk; the playing area is one board set into it (carved frame, brass
 * corners, an arcane circle across both halves); books, candles, an inkwell,
 * a scroll and a brass astrolabe lie in the free spots around it.
 * Everything is SVG, drawn for the actual sizes (mockup only).
 */
(() => {
  const f = (n) => n.toFixed(1);
  const GOLD = "#d9ac5c";
  const RUNEN = [
    "M5 0V14M5 4 9 0M5 8 1 4", "M2 0V14M2 0 8 5 2 9", "M1 0V14M9 0V14M1 4 9 10", "M5 0V14M1 3 5 7 9 3",
    "M2 0V14M2 7H8M8 0V14", "M5 0 9 7 5 14 1 7Z", "M1 0 9 14M9 0 1 14", "M5 0V14M1 10 5 6 9 10",
    "M1 2H9M5 2V14M1 14H9", "M2 0V14M2 3 8 0M2 9 8 6", "M5 0V8M1 14 5 8 9 14", "M1 0V14M1 0 8 3 1 7 8 11",
  ];
  function zufall(seed) {
    let a = seed >>> 0;
    return () => { a = (a + 0x6d2b79f5) >>> 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  }

  /* ---------- Shared paint ---------- */
  const DEFS = `
    <filter id="ak-holz" x="0" y="0" width="100%" height="100%">
      <feTurbulence type="fractalNoise" baseFrequency=".002 .035" numOctaves="4" seed="11"/>
      <feColorMatrix values="0 0 0 0 .36  0 0 0 0 .22  0 0 0 0 .12  0 0 0 .9 -.25"/>
      <feComposite in2="SourceGraphic" operator="in"/>
    </filter>
    <filter id="ak-leder" x="0" y="0" width="100%" height="100%">
      <feTurbulence type="fractalNoise" baseFrequency=".75" numOctaves="2" seed="4"/>
      <feColorMatrix values="0 0 0 0 .6  0 0 0 0 .65  0 0 0 0 .8  0 0 0 .14 0"/>
      <feComposite in2="SourceGraphic" operator="in"/>
    </filter>
    <filter id="ak-schatten" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="6"/></filter>
    <filter id="ak-weich" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="2.5"/></filter>
    <filter id="ak-glut" x="-100%" y="-100%" width="300%" height="300%"><feGaussianBlur stdDeviation="2.4" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
    <linearGradient id="ak-messing" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#f6dc9a"/><stop offset=".35" stop-color="#c39443"/><stop offset=".7" stop-color="#7a5521"/><stop offset="1" stop-color="#d8b062"/></linearGradient>
    <linearGradient id="ak-inlay" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#f3d896"/><stop offset=".5" stop-color="#b8873a"/><stop offset="1" stop-color="#e6c06e"/></linearGradient>
    <linearGradient id="ak-rahmen" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#4a2f1a"/><stop offset=".5" stop-color="#2a190c"/><stop offset="1" stop-color="#3b2413"/></linearGradient>
    <radialGradient id="ak-flaeche" cx=".5" cy=".5" r=".75"><stop offset="0" stop-color="#1d2a40"/><stop offset=".65" stop-color="#121b2b"/><stop offset="1" stop-color="#0a0f19"/></radialGradient>
    <radialGradient id="ak-licht"><stop offset="0" stop-color="#ffb85c" stop-opacity=".3"/><stop offset=".45" stop-color="#ff9a3a" stop-opacity=".1"/><stop offset="1" stop-color="#ff9a3a" stop-opacity="0"/></radialGradient>
    <radialGradient id="ak-kreislicht"><stop offset="0" stop-color="#7fb4ff" stop-opacity=".16"/><stop offset=".7" stop-color="#7fb4ff" stop-opacity=".04"/><stop offset="1" stop-color="#7fb4ff" stop-opacity="0"/></radialGradient>
    <linearGradient id="ak-papier" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#d9c79c"/><stop offset=".25" stop-color="#efe3c4"/><stop offset=".8" stop-color="#e6d6b0"/><stop offset="1" stop-color="#bba57a"/></linearGradient>
    <linearGradient id="ak-papier-r" x1="1" y1="0" x2="0" y2="0"><stop offset="0" stop-color="#d9c79c"/><stop offset=".25" stop-color="#efe3c4"/><stop offset=".8" stop-color="#e6d6b0"/><stop offset="1" stop-color="#bba57a"/></linearGradient>
    <linearGradient id="ak-rolle" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#b59a68"/><stop offset=".35" stop-color="#f1e4c3"/><stop offset="1" stop-color="#9c8152"/></linearGradient>
    <linearGradient id="ak-glas" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#0b1424"/><stop offset=".3" stop-color="#26385a"/><stop offset=".55" stop-color="#101a2e"/><stop offset="1" stop-color="#05080f"/></linearGradient>
    <linearGradient id="ak-feder" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fbf6ea"/><stop offset=".6" stop-color="#cfc6b4"/><stop offset="1" stop-color="#8d8472"/></linearGradient>
    ${["a", "b", "c", "d"].map((k, i) => {
      const c = [["#6e2320", "#3a0f0e"], ["#24533a", "#0f2a1c"], ["#2b3d70", "#121b38"], ["#5a3b1c", "#2b1a0b"]][i];
      return `<linearGradient id="ak-leder-${k}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${c[1]}"/><stop offset=".3" stop-color="${c[0]}"/><stop offset=".7" stop-color="${c[0]}"/><stop offset="1" stop-color="${c[1]}"/></linearGradient>`;
    }).join("")}
    <radialGradient id="ak-trank-gruen" cx=".4" cy=".35" r=".7"><stop offset="0" stop-color="#b8ffd8"/><stop offset=".45" stop-color="#2fcf8a"/><stop offset="1" stop-color="#0a5a3a"/></radialGradient>
    <radialGradient id="ak-trank-violett" cx=".4" cy=".35" r=".7"><stop offset="0" stop-color="#f0d4ff"/><stop offset=".45" stop-color="#a45ae0"/><stop offset="1" stop-color="#43166e"/></radialGradient>`;

  const schatten = (cx, cy, rx, ry, o = 0.55) => `<ellipse cx="${f(cx)}" cy="${f(cy)}" rx="${f(rx)}" ry="${f(ry)}" fill="#000" opacity="${o}" filter="url(#ak-schatten)"/>`;
  const kritzel = (x, y, breite, zeilen, abstand, rnd, farbe = "#5c4a30") => {
    let d = "";
    for (let i = 0; i < zeilen; i++) {
      const l = breite * (i === zeilen - 1 ? 0.5 : 0.82 + rnd() * 0.18);
      let cx = x;
      while (cx < x + l) { const wort = 4 + rnd() * 14; d += `M${f(cx)} ${f(y + i * abstand)}h${f(Math.min(wort, x + l - cx))}`; cx += wort + 3; }
    }
    return `<path d="${d}" stroke="${farbe}" stroke-width="1.5" stroke-linecap="round" opacity=".55"/>`;
  };

  /* ---------- Props (each in its own box, w × h) ---------- */
  function buecherstapel() {
    const buch = (x, y, b, h, k, dreh = 0) => `<g transform="rotate(${dreh} ${x + b / 2} ${y + h / 2})">
        <path d="M${x + 7} ${y - 9}H${x + b + 7}L${x + b} ${y}H${x}Z" fill="url(#ak-leder-${k})" opacity=".85"/>
        <path d="M${x + b} ${y}L${x + b + 7} ${y - 9}V${y + h - 9}L${x + b} ${y + h}Z" fill="#e9dcb8"/>
        <path d="M${x + b + 1.5} ${y + 3}V${y + h - 3}M${x + b + 3.5} ${y + 1}V${y + h - 5}M${x + b + 5.5} ${y - 2}V${y + h - 7}" stroke="#b9a57c" stroke-width=".8"/>
        <rect x="${x}" y="${y}" width="${b}" height="${h}" rx="3" fill="url(#ak-leder-${k})"/>
        <path d="M${x + b * 0.12} ${y + 2}V${y + h - 2}M${x + b * 0.15} ${y + 2}V${y + h - 2}M${x + b * 0.85} ${y + 2}V${y + h - 2}M${x + b * 0.88} ${y + 2}V${y + h - 2}" stroke="url(#ak-messing)" stroke-width="1.6"/>
        <rect x="${x + b * 0.36}" y="${y + h * 0.26}" width="${b * 0.28}" height="${h * 0.48}" rx="1.5" fill="none" stroke="url(#ak-messing)" stroke-width="1.1"/>
        <path d="M${x + b * 0.4} ${y + h / 2}h${b * 0.2}" stroke="#e9c47a" stroke-width="1" opacity=".7" stroke-dasharray="3 2"/>
      </g>`;
    return { w: 240, h: 150, svg: `${schatten(118, 140, 112, 12)}
      ${buch(4, 104, 214, 38, "a")}${buch(18, 70, 192, 34, "b", -1.5)}${buch(30, 40, 168, 30, "c", 1)}` };
  }

  function offenesBuch(rnd) {
    return { w: 280, h: 190, svg: `${schatten(140, 176, 136, 14)}
      <path d="M6 30Q70 14 140 30Q210 14 274 30V178Q210 164 140 182Q70 164 6 178Z" fill="url(#ak-leder-a)"/>
      <path d="M14 28Q72 10 138 30V172Q72 156 14 168Z" fill="url(#ak-papier)"/>
      <path d="M142 30Q208 10 266 28V168Q208 156 142 172Z" fill="url(#ak-papier-r)"/>
      <path d="M128 30Q140 36 152 30V172Q140 178 128 172Z" fill="#000" opacity=".22"/>
      ${kritzel(28, 42, 92, 11, 11, rnd)}
      ${kritzel(156, 112, 92, 5, 11, rnd)}
      <g transform="translate(204 70)" fill="none" stroke="#6b4f2a" stroke-width="1.2" opacity=".7">
        <circle r="28"/><circle r="20" stroke-dasharray="2 3"/><path d="M0-28 6-6 28 0 6 6 0 28-6 6-28 0-6-6Z"/>
      </g>
      <path d="M138 172C136 184 132 196 128 206L136 200 140 208C142 196 142 184 142 172Z" fill="#8f1d1d"/>` };
  }

  function kerze(hoehe = 1) {
    const h = 140 * hoehe;
    return { w: 80, h: h + 20, svg: `<circle cx="40" cy="${f(h * 0.25)}" r="110" fill="url(#ak-licht)"/>
      ${schatten(40, h + 12, 34, 7, 0.6)}
      <ellipse cx="40" cy="${f(h + 10)}" rx="32" ry="8" fill="url(#ak-messing)"/>
      <ellipse cx="40" cy="${f(h + 7)}" rx="22" ry="5" fill="#5a3d16"/>
      <svg x="10" y="0" width="60" height="${f(h + 2)}" viewBox="0 0 60 140" preserveAspectRatio="none" overflow="visible"><use href="#kerze-symbol"/></svg>` };
  }

  function tintenfass() {
    return { w: 170, h: 210, svg: `${schatten(60, 198, 52, 9)}
      <path d="M22 196Q14 150 34 132H86Q106 150 98 196Z" fill="url(#ak-glas)" stroke="#000" stroke-width="1"/>
      <path d="M28 186Q24 160 36 146" stroke="#8fb0e0" stroke-width="2" fill="none" opacity=".45" stroke-linecap="round"/>
      <rect x="44" y="118" width="32" height="16" rx="2" fill="url(#ak-messing)"/>
      <ellipse cx="60" cy="118" rx="16" ry="4" fill="#0a0d14"/>
      <path d="M60 118C78 82 112 40 160 6" stroke="#3b2a14" stroke-width="2.4" fill="none" stroke-linecap="round"/>
      <path d="M74 92C80 64 104 30 156 6C150 30 132 58 104 80C96 86 86 90 74 92Z" fill="url(#ak-feder)"/>
      <path d="M78 88C100 64 124 38 154 10" stroke="#9d9482" stroke-width=".9" fill="none"/>
      <path d="M90 80l-8-10M100 72l-6-12M112 62l-4-14M124 50l-2-14M136 38l0-13M96 76l10 0M110 66l11 2M124 54l12 2M138 40l11 1" stroke="#a69d8a" stroke-width=".7"/>` };
  }

  function schriftrolle(rnd) {
    return { w: 250, h: 110, svg: `${schatten(125, 100, 118, 10)}
      <rect x="22" y="22" width="200" height="66" fill="#eadbb6"/>
      <rect x="22" y="22" width="200" height="66" fill="url(#ak-rolle)" opacity=".25"/>
      ${kritzel(36, 36, 160, 5, 10, rnd)}
      <rect x="8" y="14" width="24" height="82" rx="12" fill="url(#ak-rolle)"/>
      <ellipse cx="20" cy="15" rx="12" ry="4" fill="#cdb98c"/><ellipse cx="20" cy="15" rx="5" ry="1.8" fill="#7d6640"/>
      <rect x="216" y="14" width="26" height="82" rx="13" fill="url(#ak-rolle)"/>
      <ellipse cx="229" cy="15" rx="13" ry="4" fill="#cdb98c"/><ellipse cx="229" cy="15" rx="5" ry="1.8" fill="#7d6640"/>
      <circle cx="198" cy="76" r="11" fill="#8f1d1d"/><circle cx="198" cy="76" r="7" fill="none" stroke="#c0503f" stroke-width="1.2"/>
      <path d="M192 86l-4 14M204 86l4 14" stroke="#8f1d1d" stroke-width="3" stroke-linecap="round"/>` };
  }

  function trank(farbe, x0 = 0) {
    return `<g transform="translate(${x0} 0)">${schatten(35, 106, 28, 6)}
      <circle cx="35" cy="72" r="32" fill="url(#ak-trank-${farbe})" opacity=".18" filter="url(#ak-weich)"/>
      <path d="M27 18H43V36Q66 46 64 74A29 29 0 0 1 6 74Q4 46 27 36Z" fill="#0d1420" fill-opacity=".55" stroke="#9fb2c8" stroke-opacity=".5" stroke-width="1.2"/>
      <path d="M10 70Q35 62 60 70A26 26 0 0 1 10 70Z" fill="url(#ak-trank-${farbe})"/>
      <path d="M8 74Q35 66 62 74" stroke="#fff" stroke-opacity=".35" stroke-width="1" fill="none"/>
      <path d="M16 52Q20 44 28 41" stroke="#fff" stroke-opacity=".55" stroke-width="2" fill="none" stroke-linecap="round"/>
      <rect x="26" y="8" width="18" height="12" rx="2" fill="#8a6a42"/><rect x="24" y="17" width="22" height="4" rx="1.5" fill="url(#ak-messing)"/></g>`;
  }

  function astrolab() {
    let striche = "";
    for (let i = 0; i < 72; i++) {
      const a = (i / 72) * Math.PI * 2, l = i % 6 ? 4 : 8;
      striche += `M${f(80 + Math.cos(a) * 64)} ${f(80 + Math.sin(a) * 64)}L${f(80 + Math.cos(a) * (64 - l))} ${f(80 + Math.sin(a) * (64 - l))}`;
    }
    return { w: 160, h: 170, svg: `${schatten(84, 90, 74, 74, 0.6)}
      <circle cx="80" cy="80" r="74" fill="url(#ak-messing)"/>
      <circle cx="80" cy="80" r="66" fill="#3a2810"/>
      <circle cx="80" cy="80" r="64" fill="url(#ak-messing)" opacity=".55"/>
      <path d="${striche}" stroke="#2a1a08" stroke-width="1.2"/>
      <circle cx="80" cy="80" r="50" fill="none" stroke="#2a1a08" stroke-width="1"/>
      <g class="drehen" style="transform-origin:80px 80px">
        <path d="M80 34 86 74 126 80 86 86 80 126 74 86 34 80 74 74Z" fill="none" stroke="#2a1a08" stroke-width="1.4"/>
        <circle cx="80" cy="66" r="26" fill="none" stroke="#2a1a08" stroke-width="1.1"/>
      </g>
      <path d="M80 80 128 52" stroke="#1d1206" stroke-width="3" stroke-linecap="round"/>
      <circle cx="80" cy="80" r="6" fill="url(#ak-messing)" stroke="#2a1a08"/>
      <circle cx="80" cy="4" r="6" fill="none" stroke="url(#ak-messing)" stroke-width="3"/>` };
  }

  // Several props side by side, aligned at the bottom.
  function gruppe(teile, luecke = 10) {
    let x = 0, svg = "";
    const h = Math.max(...teile.map((t) => t.h));
    for (const t of teile) { svg += `<g transform="translate(${f(x)} ${f(h - t.h)})">${t.svg}</g>`; x += t.w + luecke; }
    return { w: x - luecke, h, svg };
  }

  // Fits a prop into a free spot (bottom-aligned, never larger than maxS).
  function setze(teil, platz, maxS = 1.15, unten = 8) {
    if (!platz || platz.w < 60 || platz.h < 60) return "";
    const s = Math.min(platz.w / teil.w, platz.h / teil.h, maxS);
    if (s < 0.3) return "";
    const x = platz.x + (platz.w - teil.w * s) / 2, y = platz.y + platz.h - teil.h * s - unten;
    return `<g transform="translate(${f(x)} ${f(y)}) scale(${s.toFixed(3)})">${teil.svg}</g>`;
  }

  /* ---------- The board ---------- */
  function brett(w, h) {
    const kurz = Math.min(w, h);
    const rand = Math.max(10, Math.min(18, kurz * 0.022));
    const cx = w / 2, cy = h / 2, R = Math.min(w * 0.46, h * 0.44);
    const kreis = (r) => `M${f(cx - r)} ${f(cy)}a${f(r)} ${f(r)} 0 1 0 ${f(2 * r)} 0a${f(r)} ${f(r)} 0 1 0 ${f(-2 * r)} 0`;
    const rille = (d, b = 1.5, o = 1) => `<path d="${d}" fill="none" stroke="#04060a" stroke-opacity="${0.7 * o}" stroke-width="${b + 2.6}" stroke-linecap="round"/><path d="${d}" fill="none" stroke="url(#ak-inlay)" stroke-opacity="${o}" stroke-width="${b}" stroke-linecap="round"/>`;
    // rune band
    const anzahl = Math.floor((2 * Math.PI * (R - 14)) / 24);
    let runen = "";
    for (let i = 0; i < anzahl; i++) {
      const s = 11 / 14;
      runen += `<path d="${RUNEN[(i * 5) % RUNEN.length]}" transform="rotate(${f((i / anzahl) * 360)} ${f(cx)} ${f(cy)}) translate(${f(cx - 5 * s)} ${f(cy - (R - 14) - 7 * s)}) scale(${s.toFixed(3)})" vector-effect="non-scaling-stroke"/>`;
    }
    let speichen = "";
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2;
      speichen += `M${f(cx + Math.cos(a) * R * 0.36)} ${f(cy + Math.sin(a) * R * 0.36)}L${f(cx + Math.cos(a) * (R - 28))} ${f(cy + Math.sin(a) * (R - 28))}`;
    }
    const stern = (() => {
      let d = "";
      for (let i = 0; i < 16; i++) { const r = i % 2 ? R * 0.12 : R * 0.33, a = ((-90 + i * 22.5) * Math.PI) / 180; d += `${i ? "L" : "M"}${f(cx + Math.cos(a) * r)} ${f(cy + Math.sin(a) * r)}`; }
      return d + "Z";
    })();
    // Brass corner plates, mirrored.
    const e = rand * 3.4;
    const platte = `<path d="M0 0H${f(e)}L${f(e - rand * 0.7)} ${f(rand * 0.9)}H${f(rand * 0.9)}V${f(e - rand * 0.7)}L0 ${f(e)}Z" fill="url(#ak-messing)" stroke="#2a1a08" stroke-width="1"/>
      <path d="M${f(rand * 0.5)} ${f(rand * 0.5)}L${f(e * 0.7)} ${f(rand * 0.5)}M${f(rand * 0.5)} ${f(rand * 0.5)}L${f(rand * 0.5)} ${f(e * 0.7)}" stroke="#2a1a08" stroke-width=".8" opacity=".6"/>
      <circle cx="${f(rand * 0.45)}" cy="${f(rand * 0.45)}" r="${f(rand * 0.16)}" fill="#2a1a08"/>
      <circle cx="${f(e * 0.72)}" cy="${f(rand * 0.45)}" r="${f(rand * 0.12)}" fill="#2a1a08"/><circle cx="${f(rand * 0.45)}" cy="${f(e * 0.72)}" r="${f(rand * 0.12)}" fill="#2a1a08"/>`;
    const ecken = [[0, 0, 1, 1], [w, 0, -1, 1], [0, h, 1, -1], [w, h, -1, -1]]
      .map(([x, y, sx, sy]) => `<g transform="translate(${f(x)} ${f(y)}) scale(${sx} ${sy})">${platte}</g>`).join("");
    const i = rand, iw = w - 2 * rand, ih = h - 2 * rand;
    return `
      <rect x="-4" y="6" width="${w + 8}" height="${h}" rx="22" fill="#000" opacity=".7" filter="url(#ak-schatten)"/>
      <rect width="${w}" height="${h}" rx="20" fill="url(#ak-rahmen)" stroke="#0a0604" stroke-width="2"/>
      <rect width="${w}" height="${h}" rx="20" fill="#000" filter="url(#ak-holz)" opacity=".7"/>
      <rect x="${f(rand * 0.45)}" y="${f(rand * 0.45)}" width="${f(w - rand * 0.9)}" height="${f(h - rand * 0.9)}" rx="16" fill="none" stroke="url(#ak-inlay)" stroke-width="1.3" opacity=".75"/>
      <rect x="${f(i)}" y="${f(i)}" width="${f(iw)}" height="${f(ih)}" rx="12" fill="url(#ak-flaeche)" stroke="#05070b" stroke-width="3"/>
      <rect x="${f(i)}" y="${f(i)}" width="${f(iw)}" height="${f(ih)}" rx="12" fill="#000" filter="url(#ak-leder)"/>
      <rect x="${f(i + 7)}" y="${f(i + 7)}" width="${f(iw - 14)}" height="${f(ih - 14)}" rx="8" fill="none" stroke="${GOLD}" stroke-opacity=".28" stroke-width="1"/>
      <rect x="${f(i)}" y="${f(i)}" width="${f(iw)}" height="${f(ih)}" rx="12" fill="none" stroke="#000" stroke-opacity=".5" stroke-width="6" filter="url(#ak-weich)"/>
      <circle cx="${f(cx)}" cy="${f(cy)}" r="${f(R * 1.05)}" fill="url(#ak-kreislicht)"/>
      <g opacity=".75">
        ${rille(kreis(R), 2)}${rille(kreis(R - 28), 1.1)}${rille(kreis(R * 0.36), 1.1)}
        <path d="${speichen}" stroke="${GOLD}" stroke-opacity=".22" stroke-width=".8"/>
        <path d="${stern}" fill="none" stroke="${GOLD}" stroke-opacity=".4" stroke-width="1"/>
        <path d="M${f(i + 18)} ${f(cy)}H${f(cx - R - 6)}M${f(cx + R + 6)} ${f(cy)}H${f(w - i - 18)}" stroke="${GOLD}" stroke-opacity=".45" stroke-width="1"/>
        <path d="M${f(i + 18)} ${f(cy)}l5 -4 5 4 -5 4Z M${f(w - i - 18)} ${f(cy)}l-5 -4 -5 4 5 4Z" fill="${GOLD}" opacity=".6"/>
      </g>
      <g class="drehen" style="transform-origin:${f(cx)}px ${f(cy)}px"><g class="runen-glut" fill="none" stroke="#f1cf86" stroke-width="1" stroke-linecap="round" stroke-linejoin="round" filter="url(#ak-glut)" opacity=".55">${runen}</g></g>
      ${ecken}`;
  }

  function arkan(w, h, W, H, ox, oy, frei) {
    const rnd = zufall(9);
    // Board rectangle: the playing area, kept inside the screen.
    const x0 = Math.max(0, 6 - ox), x1 = Math.min(w, W - ox - 6), y0 = 2, y1 = h - 2;
    let deko = "", lichter = "";
    const p = frei;
    if (p.untenLinks) deko += setze(gruppe([offenesBuch(rnd), kerze(0.85)], -6), p.untenLinks, 1.05);
    if (p.untenRechts) deko += setze(gruppe([kerze(1.1), buecherstapel(), tintenfass()], -10), p.untenRechts, 1.05);
    if (p.links) deko += setze({ w: 260, h: 230, svg: `<g transform="translate(20 0)">${kerze(0.7).svg}</g><g transform="translate(110 14)">${trank("gruen")}${trank("violett", 66)}</g><g transform="translate(4 118)">${schriftrolle(rnd).svg}</g>` }, p.links, 1.1, 14);
    if (p.rechtsOben) deko += setze(gruppe([astrolab(), kerze(0.75)], 4), p.rechtsOben, 1, 14);
    if (p.seite) deko += setze(buecherstapel(), p.seite, 0.9, 6);
    // Warm light where the candles stand (rough, from the free spots).
    for (const k of ["untenLinks", "untenRechts", "rechtsOben"]) if (p[k] && p[k].w > 60) lichter += `<circle cx="${f(p[k].x + p[k].w * 0.5)}" cy="${f(p[k].y + p[k].h * 0.4)}" r="${f(Math.max(p[k].w, p[k].h) * 0.9)}" fill="url(#ak-licht)"/>`;
    return `<defs>${DEFS}</defs>
      <g transform="translate(${f(-ox)} ${f(-oy)})">
        <rect width="${W}" height="${H}" fill="#1b110a"/>
        <rect width="${W}" height="${H}" fill="#000" filter="url(#ak-holz)"/>
        ${Array.from({ length: Math.ceil(H / 150) }, (_, k) => `<path d="M0 ${f(k * 150 + 70)}H${W}" stroke="#0a0603" stroke-width="2" opacity=".45"/><path d="M0 ${f(k * 150 + 72)}H${W}" stroke="#6b4a2c" stroke-width=".6" opacity=".25"/>`).join("")}
        ${lichter}
        <rect width="${W}" height="${H}" fill="url(#ak-vignette)"/>
        ${deko}
      </g>
      <defs><radialGradient id="ak-vignette" cx=".5" cy=".5" r=".75"><stop offset=".55" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".7"/></radialGradient></defs>
      <g transform="translate(${f(x0)} ${f(y0)})">${brett(x1 - x0, y1 - y0)}</g>`;
  }

  Tischflaeche.varianten.arkan = arkan;
})();
