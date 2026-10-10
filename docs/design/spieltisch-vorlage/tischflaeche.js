/*
 * The table surface as SVG, drawn for the surface's actual size (so circles
 * stay circles on every screen). Three variants to compare in the mockup:
 *   astrolabium – night sky with a slowly turning gold astrolabe
 *   matte       – a playmat with stitched gold border and a centre seal
 *   runen       – the stone floor with gold inlay, a rune circle and the five mana gems
 * Mockup only; the real table would be one React component drawing the chosen variant.
 */
const Tischflaeche = (() => {
  const GOLD = "#d9ac5c";
  // Own rune glyphs (10 × 14), no real script.
  const RUNEN = [
    "M5 0V14M5 4 9 0M5 8 1 4", "M2 0V14M2 0 8 5 2 9", "M1 0V14M9 0V14M1 4 9 10", "M5 0V14M1 3 5 7 9 3",
    "M2 0V14M2 7H8M8 0V14", "M5 0 9 7 5 14 1 7Z", "M1 0 9 14M9 0 1 14", "M5 0V14M1 10 5 6 9 10",
    "M1 2H9M5 2V14M1 14H9", "M2 0V14M2 3 8 0M2 9 8 6", "M5 0V8M1 14 5 8 9 14", "M1 0V14M1 0 8 3 1 7 8 11",
  ];

  // A small seeded random generator: the same sky on every draw.
  function zufall(seed) {
    let a = seed >>> 0;
    return () => { a = (a + 0x6d2b79f5) >>> 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  }
  const f = (n) => n.toFixed(1);

  function striche(cx, cy, r, laenge, anzahl, gross, breite = 1) {
    let d = "";
    for (let i = 0; i < anzahl; i++) {
      const w = (i / anzahl) * Math.PI * 2, l = i % gross === 0 ? laenge * 2 : laenge;
      d += `M${f(cx + Math.cos(w) * r)} ${f(cy + Math.sin(w) * r)}L${f(cx + Math.cos(w) * (r - l))} ${f(cy + Math.sin(w) * (r - l))}`;
    }
    return `<path d="${d}" stroke="${GOLD}" stroke-width="${breite}" fill="none"/>`;
  }

  function runenring(cx, cy, r, groesse, farbe, breite = 1.2) {
    const anzahl = Math.max(12, Math.floor((2 * Math.PI * r) / (groesse * 2.1)));
    let g = "";
    for (let i = 0; i < anzahl; i++) {
      const w = (i / anzahl) * 360;
      const s = groesse / 14;
      g += `<path d="${RUNEN[(i * 7) % RUNEN.length]}" transform="rotate(${f(w)} ${f(cx)} ${f(cy)}) translate(${f(cx - 5 * s)} ${f(cy - r - 7 * s)}) scale(${s.toFixed(3)})" vector-effect="non-scaling-stroke"/>`;
    }
    return `<g fill="none" stroke="${farbe}" stroke-width="${breite}" stroke-linecap="round" stroke-linejoin="round">${g}</g>`;
  }

  function stern(cx, cy, aussen, innen, zacken, drehung = -90) {
    let d = "";
    for (let i = 0; i < zacken * 2; i++) {
      const r = i % 2 ? innen : aussen, w = ((drehung + (i * 180) / zacken) * Math.PI) / 180;
      d += `${i ? "L" : "M"}${f(cx + Math.cos(w) * r)} ${f(cy + Math.sin(w) * r)}`;
    }
    return d + "Z";
  }

  function haelften(w, h) {
    // (drawn in the playing area's own coordinates)
    // A faint tint: the opponent's half warm, yours cool.
    return `<defs><linearGradient id="tf-haelften" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#ff7a4a" stop-opacity="0"/><stop offset=".12" stop-color="#ff7a4a" stop-opacity=".07"/><stop offset=".45" stop-color="#ff7a4a" stop-opacity="0"/>
        <stop offset=".55" stop-color="#4aa3ff" stop-opacity="0"/><stop offset=".88" stop-color="#4aa3ff" stop-opacity=".08"/><stop offset="1" stop-color="#4aa3ff" stop-opacity="0"/></linearGradient></defs>
      <rect width="${w}" height="${h}" fill="url(#tf-haelften)"/>`;
  }

  function astrolabium(w, h, W, H, ox, oy) {
    const cx = w / 2, cy = h / 2, R = Math.min(w * 0.47, h * 0.45), rnd = zufall(42);
    let sterne = "";
    const anzahl = Math.round((W * H) / 2600);
    for (let i = 0; i < anzahl; i++) {
      const x = rnd() * W - ox, y = rnd() * H - oy, hell = rnd();
      const r = hell > 0.97 ? 1.6 : hell > 0.85 ? 1.05 : 0.6;
      sterne += `<circle cx="${f(x)}" cy="${f(y)}" r="${r}" fill="${hell > 0.9 ? "#fff6dc" : "#c9d8ff"}" opacity="${(0.25 + hell * 0.6).toFixed(2)}"${hell > 0.97 ? ' filter="url(#tf-glanz)"' : ""}/>`;
    }
    // Two small constellations in the open corners.
    const bild = (pts) => `<polyline points="${pts.map(([x, y]) => `${f(x)},${f(y)}`).join(" ")}" fill="none" stroke="${GOLD}" stroke-opacity=".28" stroke-width=".8"/>` +
      pts.map(([x, y]) => `<circle cx="${f(x)}" cy="${f(y)}" r="1.8" fill="#fff3cf" filter="url(#tf-glanz)"/>`).join("");
    const k = Math.min(w, h) * 0.09;
    const bilder = bild([[w * 0.06, h * 0.1], [w * 0.06 + k, h * 0.1 + k * 0.4], [w * 0.06 + k * 1.6, h * 0.1 + k * 0.2], [w * 0.06 + k * 2.1, h * 0.1 + k]]) +
      bild([[w * 0.94, h * 0.9], [w * 0.94 - k * 0.7, h * 0.9 - k * 0.8], [w * 0.94 - k * 1.7, h * 0.9 - k * 0.6], [w * 0.94 - k * 2.2, h * 0.9 - k * 1.3], [w * 0.94 - k * 1.5, h * 0.9 - k * 1.7]]);

    const ring = `
      <circle cx="${cx}" cy="${cy}" r="${R}" fill="none" stroke="${GOLD}" stroke-width="2"/>
      <circle cx="${cx}" cy="${cy}" r="${R - 5}" fill="none" stroke="${GOLD}" stroke-width=".7"/>
      ${striche(cx, cy, R - 5, 5, 120, 10, 0.8)}
      <circle cx="${cx}" cy="${cy}" r="${R - 18}" fill="none" stroke="${GOLD}" stroke-width=".7"/>
      <circle cx="${cx}" cy="${cy}" r="${R - 40}" fill="none" stroke="${GOLD}" stroke-width="1.2"/>`;
    const runen = `<g class="drehen" style="transform-origin:${cx}px ${cy}px">${runenring(cx, cy, R - 22, 13, "#e9c47a", 1)}</g>`;
    let speichen = "";
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      speichen += `M${f(cx + Math.cos(a) * R * 0.34)} ${f(cy + Math.sin(a) * R * 0.34)}L${f(cx + Math.cos(a) * (R - 40))} ${f(cy + Math.sin(a) * (R - 40))}`;
    }
    const innen = `<g class="drehen-zurueck" style="transform-origin:${cx}px ${cy}px">
        <circle cx="${cx}" cy="${f(cy - R * 0.14)}" r="${f(R * 0.6)}" fill="none" stroke="${GOLD}" stroke-width="1" stroke-opacity=".6"/>
        <circle cx="${cx}" cy="${f(cy - R * 0.14)}" r="${f(R * 0.6 - 7)}" fill="none" stroke="${GOLD}" stroke-width=".5" stroke-opacity=".5" stroke-dasharray="2 5"/>
        <path d="${stern(cx, cy, R * 0.5, R * 0.13, 8)}" fill="none" stroke="${GOLD}" stroke-opacity=".45" stroke-width=".9"/>
      </g>
      <path d="${speichen}" stroke="${GOLD}" stroke-opacity=".3" stroke-width=".7"/>
      <circle cx="${cx}" cy="${cy}" r="${f(R * 0.34)}" fill="none" stroke="${GOLD}" stroke-opacity=".55" stroke-dasharray="1 4" stroke-width="1.4"/>`;
    const horizont = `<path d="M${f(Math.max(8, cx - R - 60))} ${cy}H${f(Math.min(w - 8, cx + R + 60))}" stroke="url(#tf-horizont)" stroke-width="1"/>`;
    return `<defs>
        <filter id="tf-glanz" x="-200%" y="-200%" width="500%" height="500%"><feGaussianBlur stdDeviation="1.6" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
        <filter id="tf-gold" x="-10%" y="-10%" width="120%" height="120%"><feGaussianBlur stdDeviation="2.2" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
        <linearGradient id="tf-horizont"><stop offset="0" stop-color="${GOLD}" stop-opacity="0"/><stop offset=".5" stop-color="${GOLD}" stop-opacity=".6"/><stop offset="1" stop-color="${GOLD}" stop-opacity="0"/></linearGradient>
        <radialGradient id="tf-kern"><stop offset="0" stop-color="#3d5c9e" stop-opacity=".35"/><stop offset="1" stop-color="#3d5c9e" stop-opacity="0"/></radialGradient>
      </defs>
      ${haelften(w, h)}${sterne}${bilder}
      <circle cx="${cx}" cy="${cy}" r="${f(R * 0.9)}" fill="url(#tf-kern)"/>
      <g opacity=".62" filter="url(#tf-gold)">${ring}${runen}${innen}${horizont}</g>`;
  }

  function matte(w, h) {
    const m = 6, cx = w / 2, cy = h / 2, rS = Math.min(w, h) * 0.2;
    const ecke = Math.min(w, h) * 0.13;
    // One corner ornament in a 100 × 100 box, mirrored to the four corners.
    const ornament = `<g fill="none" stroke="${GOLD}" stroke-linecap="round">
        <path d="M4 100V34Q4 4 34 4H100" stroke-width="2.2"/>
        <path d="M13 100V40Q13 13 40 13H100" stroke-width="1" stroke-opacity=".6"/>
        <path d="M24 60C24 38 38 24 60 24" stroke-width="1.2"/>
        <path d="M30 30C44 30 46 46 35 48C27 49 26 40 33 39" stroke-width="1.4"/>
        <path d="M60 24C68 16 80 18 84 26" stroke-width="1"/><path d="M24 60C16 68 18 80 26 84" stroke-width="1"/>
      </g>
      <g fill="${GOLD}"><path d="M44 13Q56 4 68 13Q56 22 44 13Z" opacity=".8"/><path d="M13 44Q4 56 13 68Q22 56 13 44Z" opacity=".8"/><circle cx="4" cy="4" r="3"/><circle cx="26" cy="84" r="2"/><circle cx="84" cy="26" r="2"/></g>`;
    const s = ecke / 100;
    const ecken = [[m + 4, m + 4, 1, 1], [w - m - 4, m + 4, -1, 1], [m + 4, h - m - 4, 1, -1], [w - m - 4, h - m - 4, -1, -1]]
      .map(([x, y, sx, sy]) => `<g transform="translate(${f(x)} ${f(y)}) scale(${(sx * s).toFixed(3)} ${(sy * s).toFixed(3)})">${ornament}</g>`).join("");
    const halb = (y1, y2) => `<rect x="${f(w * 0.06)}" y="${f(y1)}" width="${f(w * 0.88)}" height="${f(y2 - y1)}" rx="14" fill="none" stroke="${GOLD}" stroke-opacity=".16" stroke-width="1"/>`;
    const text = "OPENMANA · DEINE KARTEN · DEINE GESCHICHTE · ";
    return `<defs>
        <filter id="tf-stoff" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency=".9" numOctaves="2" seed="5"/><feColorMatrix values="0 0 0 0 .55 0 0 0 0 .6 0 0 0 0 .75 0 0 0 .18 0"/><feComposite in2="SourceGraphic" operator="in"/></filter>
        <radialGradient id="tf-matte" cx=".5" cy=".5" r=".75"><stop offset="0" stop-color="#1f2c47"/><stop offset=".7" stop-color="#121a2c"/><stop offset="1" stop-color="#0a0f1a"/></radialGradient>
        <path id="tf-siegelpfad" d="M${f(cx - rS * 0.82)} ${cy}a${f(rS * 0.82)} ${f(rS * 0.82)} 0 1 1 ${f(rS * 1.64)} 0a${f(rS * 0.82)} ${f(rS * 0.82)} 0 1 1 ${f(-rS * 1.64)} 0"/>
      </defs>
      <rect x="${m}" y="${m}" width="${w - 2 * m}" height="${h - 2 * m}" rx="18" fill="url(#tf-matte)" stroke="#05070b" stroke-width="3"/>
      <rect x="${m}" y="${m}" width="${w - 2 * m}" height="${h - 2 * m}" rx="18" fill="#000" filter="url(#tf-stoff)"/>
      ${haelften(w, h)}
      <rect x="${m + 6}" y="${m + 6}" width="${w - 2 * m - 12}" height="${h - 2 * m - 12}" rx="14" fill="none" stroke="${GOLD}" stroke-width="1.6" stroke-opacity=".8"/>
      <rect x="${m + 12}" y="${m + 12}" width="${w - 2 * m - 24}" height="${h - 2 * m - 24}" rx="11" fill="none" stroke="#e9c47a" stroke-width="1.2" stroke-dasharray="5 4" stroke-opacity=".5"/>
      ${ecken}
      ${halb(h * 0.06, cy - rS * 0.35)}${halb(cy + rS * 0.35, h * 0.94)}
      <path d="M${f(w * 0.1)} ${cy}H${f(cx - rS - 8)}M${f(cx + rS + 8)} ${cy}H${f(w * 0.9)}" stroke="${GOLD}" stroke-opacity=".35"/>
      <g opacity=".5">
        <circle cx="${cx}" cy="${cy}" r="${f(rS)}" fill="#0b111d" fill-opacity=".6" stroke="${GOLD}" stroke-width="1.4"/>
        <circle cx="${cx}" cy="${cy}" r="${f(rS * 0.68)}" fill="none" stroke="${GOLD}" stroke-width=".8"/>
        <text font-family="Cinzel Variable, serif" font-size="${f(Math.max(9, rS * 0.13))}" letter-spacing="2" fill="#e9c47a"><textPath href="#tf-siegelpfad">${text.repeat(2)}</textPath></text>
        <use href="#emblem" x="${f(cx - rS * 0.55)}" y="${f(cy - rS * 0.55)}" width="${f(rS * 1.1)}" height="${f(rS * 1.1)}" opacity=".6"/>
      </g>`;
  }

  function runen(w, h) {
    const cx = w / 2, cy = h / 2, R = Math.min(w * 0.47, h * 0.46);
    const rille = (d, b = 1.6) => `<path d="${d}" fill="none" stroke="#04060a" stroke-opacity=".75" stroke-width="${b + 3}" stroke-linecap="round"/><path d="${d}" fill="none" stroke="url(#tf-inlay)" stroke-width="${b}" stroke-linecap="round"/>`;
    const kreis = (r) => `M${f(cx - r)} ${f(cy)}a${f(r)} ${f(r)} 0 1 0 ${f(2 * r)} 0a${f(r)} ${f(r)} 0 1 0 ${f(-2 * r)} 0`;
    // The five mana colours as gems on a pentagon (own shapes, no game symbols).
    const FARBEN = ["#f6edc9", "#4aa3ff", "#a07ad8", "#ff6a4a", "#4fcf74"];
    const punkte = FARBEN.map((_, i) => { const a = ((-90 + i * 72) * Math.PI) / 180; return [cx + Math.cos(a) * R * 0.74, cy + Math.sin(a) * R * 0.74]; });
    const fuenfeck = punkte.map(([x, y], i) => `${i ? "L" : "M"}${f(x)} ${f(y)}`).join("") + "Z";
    const g = Math.max(7, R * 0.045);
    const steine = punkte.map(([x, y], i) => `<g filter="url(#tf-glut)"><path d="M${f(x)} ${f(y - g)}L${f(x + g * 0.75)} ${f(y)}L${f(x)} ${f(y + g)}L${f(x - g * 0.75)} ${f(y)}Z" fill="${FARBEN[i]}" stroke="#2a1d08" stroke-width="1"/></g>
        <path d="M${f(x)} ${f(y - g)}L${f(x + g * 0.75)} ${f(y)}L${f(x)} ${f(y)}Z" fill="#fff" opacity=".35"/>`).join("");
    const ecken = [[0, 0], [w, 0], [0, h], [w, h]];
    const adern = ecken.map(([x, y]) => {
      const a = Math.atan2(y - cy, x - cx), sx = cx + Math.cos(a) * R, sy = cy + Math.sin(a) * R;
      const ex = x + (x ? -14 : 14), ey = y + (y ? -14 : 14);
      return `M${f(sx)} ${f(sy)}Q${f((sx + ex) / 2 + (y ? 30 : -30))} ${f((sy + ey) / 2)} ${f(ex)} ${f(ey)}`;
    });
    return `<defs>
        <linearGradient id="tf-inlay" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#f3d896"/><stop offset=".5" stop-color="#b8873a"/><stop offset="1" stop-color="#e6c06e"/></linearGradient>
        <filter id="tf-glut" x="-100%" y="-100%" width="300%" height="300%"><feGaussianBlur stdDeviation="3" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
        <radialGradient id="tf-mitte"><stop offset="0" stop-color="#6fb6ff" stop-opacity=".18"/><stop offset="1" stop-color="#6fb6ff" stop-opacity="0"/></radialGradient>
      </defs>
      ${haelften(w, h)}
      <rect x="10" y="10" width="${w - 20}" height="${h - 20}" rx="6" fill="none" stroke="#04060a" stroke-opacity=".7" stroke-width="5"/>
      <rect x="10" y="10" width="${w - 20}" height="${h - 20}" rx="6" fill="none" stroke="url(#tf-inlay)" stroke-width="1.2" stroke-opacity=".7"/>
      <circle cx="${cx}" cy="${cy}" r="${f(R)}" fill="url(#tf-mitte)"/>
      <g opacity=".7">
        ${adern.map((d) => rille(d, 1.1)).join("")}
        ${rille(kreis(R), 2.2)}${rille(kreis(R - 26), 1.2)}${rille(kreis(R * 0.3), 1.2)}
        ${rille(fuenfeck, 1.2)}
      </g>
      <g class="runen-glut" filter="url(#tf-glut)" opacity=".8">${runenring(cx, cy, R - 13, 12, "#8fd0ff", 1.1)}</g>
      ${adern.map((d) => `<path class="ader" d="${d}" fill="none" stroke="#9fd8ff" stroke-width="2" stroke-dasharray="40 360" stroke-linecap="round" filter="url(#tf-glut)" opacity=".7"/>`).join("")}
      <g opacity=".9">${steine}</g>`;
  }

  const VARIANTEN = { astrolabium, matte, runen };
  return {
    varianten: VARIANTEN,
    // flaeche: the playing area (both players' strips and battlefields) the variant is laid out on.
    zeichnen(svg, variante, flaeche) {
      const aussen = svg.getBoundingClientRect(), b = flaeche.getBoundingClientRect();
      if (!aussen.width || !b.width) return;
      const ox = b.left - aussen.left, oy = b.top - aussen.top;
      svg.setAttribute("viewBox", `0 0 ${f(aussen.width)} ${f(aussen.height)}`);
      svg.innerHTML = `<g transform="translate(${f(ox)} ${f(oy)})">${VARIANTEN[variante](b.width, b.height, aussen.width, aussen.height, ox, oy)}</g>`;
    },
  };
})();
