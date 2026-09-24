#!/usr/bin/env node
// Lists the Java classes that ended up in the Wasm module and checks that no
// network-play code is among them, from the class-level SBOM native-image
// exports (--enable-sbom=export,class-level):
//
//   <report>/image-classes.txt   every class in the module, sorted
//   <report>/image-classes.json  counts per package root, network check
//
//   node image-classes.mjs <class-level sbom.json> <report-dir>
//
// This is the second check behind build-wasm.sh's reachability gate
// (-H:AbortOnTypeReachable): it looks at the class names in the finished
// image, not at the analysis. Fails if a class of Netty, jupnp (CDDL, see
// docs/research/LICENSES.md), Jetty or the servlet API is in the module.
//
// The SBOM's own attribution of classes to libraries is not used: with the
// engine's fat JAR native-image cannot tell the libraries apart (most classes,
// Forge's among them, stay unattributed, and every library of the class path
// is listed, jupnp included). A license inventory of the shipped components
// needs another way (prompt 27).

import fs from "node:fs";
import path from "node:path";

const [input, reportDir] = process.argv.slice(2);
if (!input || !reportDir) {
  console.error("usage: image-classes.mjs <class-level sbom.json> <report-dir>");
  process.exit(2);
}

/** Package roots of network play: none of their classes may be in the module. */
export const NETWORK_PACKAGES = ["io.netty.", "org.jupnp.", "org.eclipse.jetty.", "javax.servlet."];

const sbom = JSON.parse(fs.readFileSync(input, "utf8"));
const classes = new Set();
const walk = (component) => {
  for (const property of component.properties ?? []) {
    if (property.name === "class") classes.add(property.value);
  }
  for (const child of component.components ?? []) walk(child);
};
(sbom.components ?? []).forEach(walk);
if (classes.size < 1000) {
  console.error(`[openmana-engine] FEHLER: only ${classes.size} classes in ${input}; was it exported with class-level information?`);
  process.exit(1);
}
const sorted = [...classes].sort();
const root = (name) => name.split(".").slice(0, 2).join(".");
const perRoot = {};
for (const name of sorted) perRoot[root(name)] = (perRoot[root(name)] ?? 0) + 1;
const network = sorted.filter((name) => NETWORK_PACKAGES.some((p) => name.startsWith(p)));
const forgeNetworkPlay = sorted.filter((name) => name.startsWith("forge.gamemodes.net."));

fs.writeFileSync(path.join(reportDir, "image-classes.txt"), sorted.join("\n") + "\n");
fs.writeFileSync(
  path.join(reportDir, "image-classes.json"),
  JSON.stringify({ classes: sorted.length, networkPackages: NETWORK_PACKAGES, networkClasses: network, forgeNetworkPlay, perPackageRoot: perRoot }, null, 2) + "\n",
);
if (network.length > 0) {
  console.error(`[openmana-engine] FEHLER: network-play classes are in the module: ${network.slice(0, 20).join(", ")}${network.length > 20 ? " …" : ""}`);
  process.exit(1);
}
console.error(
  `[openmana-engine] Modul: ${sorted.length} Klassen, keine aus ${NETWORK_PACKAGES.map((p) => p.slice(0, -1)).join(", ")}; aus Forges Netzspiel-Paket: ${forgeNetworkPlay.length}`,
);
