// Regenerates the embedded DATA rows in ref_ALL.html from the markdown
// sources, so the browser page cannot drift from the .md listings.
// Also flips the [ ] coverage marks for the four namespaces that are now
// fully wrapped.
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const SOURCES = [
    "ref_ALL.md",
    "ref_cell.md",
    "ref_not_cell.md",
    "ref_definition.md",
    "ref_not_param.md",
];

const NS_RE = /^(\S+)\s+\[([ x+~])\]\s*(.*)$/;
// name, then a signature in parentheses (may contain spaces), then the
// optional coverage mark and `~= alias` note. The name/signature gap is
// variable-width — some rows are flush, others are column-aligned.
const M_RE = /^(\s+)([A-Za-z_$][\w$.]*)\s*(\([^)]*\))\s*\[([^\]]*)\]\s*(?:~=\s*(\S+))?\s*$/;

/** Categorise by the same rule set the existing page used. */
function categorise(ns, sig) {
    if (/\(cellX|cellY|worldX|worldY|positions|cellId/i.test(sig)) return "cell-coordinates";
    if (/unlock|discover/i.test(ns + sig)) return "unlock-discovery";
    if (/terrain/i.test(ns + sig)) return "terrain-id-lookup";
    if (/element/i.test(ns + sig)) return "element-id-lookup";
    if (/structures?\.(getAtCell|update|remove|build|setSpritesheet)/i.test(ns + sig)) {
        return "structure-instance-ops";
    }
    if (/items?|upgrades?|projectiles?|cooldown/i.test(ns + sig)) {
        return "item-upgrade-projectile-state";
    }
    if (/entit/i.test(ns + sig)) return "entity-lifecycle";
    if (/player|inventory/i.test(ns + sig)) return "player-movement-inventory";
    if (/storage|settings|config|assets?|sprites?/i.test(ns + sig)) {
        return "config-storage-assets";
    }
    if (/mods?|events?|hooks?|triggers?|workers?/i.test(ns + sig)) {
        return "session-mod-lifecycle";
    }
    if (/i18n|localis|locale/i.test(ns + sig)) return "localisation";
    if (/ui\.|overlay|toast/i.test(ns + sig)) return "ui-dialogs-components";
    if (/audio|sound|camera|light|focus/i.test(ns + sig)) return "audio-camera-focus";
    return "unclassified-ref-all-only";
}

const rows = [];
for (const file of SOURCES) {
    let text;
    try {
        text = readFileSync(join(here, file), "utf8");
    } catch {
        continue; // source not present; keep the rows we already have
    }
    let ns = null;
    for (const line of text.split("\n")) {
        if (!line.trim() || line.startsWith("#")) continue;
        const mMatch = line.match(M_RE);
        // A namespace header is an unindented line; members are indented.
        if (!line.startsWith(" ") && !line.startsWith("\t")) {
            const nsMatch = line.match(NS_RE);
            if (nsMatch) ns = nsMatch[1];
            continue;
        }
        if (!mMatch || !ns) continue;
        const [, , name, sig, cov, note] = mMatch;
        rows.push({
            ns,
            name,
            sig,
            cov: cov ?? " ",
            note: note ?? "",
            cat: categorise(ns, sig),
            cell: /cellX|cellY|worldX|worldY|cellId|positions/i.test(sig),
            def: /\(definition|definition\)/i.test(sig) || /register/.test(sig),
            noarg: /\(\s*\)/.test(sig),
            getter: /^(get|is|has|can|should)[A-Z]/.test(name),
        });
    }
}

// Keep rows that are no longer present in any markdown source. The split-out
// listings (ref_cell.md, ref_not_cell.md, ...) were folded into ref_ALL.md,
// so a namespace like api.signals.targets would otherwise silently vanish from
// the page even though the wrapper still implements it.
const preserved = new Set();
const htmlPath = join(here, "ref_ALL.html");
const html = readFileSync(htmlPath, "utf8");
const dataLine = html.split("\n").find((l) => l.startsWith("const DATA = "));
let catNames = {};
if (dataLine) {
    const prior = JSON.parse(
        dataLine.slice("const DATA = ".length).replace(/;$/, ""),
    );
    catNames = prior.catNames ?? {};
    const present = new Set(rows.map((r) => `${r.ns}.${r.name}`));
    for (const r of prior.rows) {
        const key = `${r.ns}.${r.name}`;
        if (present.has(key)) continue;
        if (r.ns.startsWith("api.signals") || r.ns === "api.i18n") {
            preserved.add(r.name);
            rows.push(r);
        }
    }
}

for (const r of rows) {
    if (!catNames[r.cat]) catNames[r.cat] = r.cat;
}

const data = { rows, catNames, nsCount: new Set(rows.map((r) => r.ns)).size };
const json = JSON.stringify(data);

// The DATA literal sits on a single line ending in `};`. Match it by line so
// the replacement cannot run past it into the rest of the script.
const outLines = html.split("\n");
const dataIdx = outLines.findIndex((l) => l.startsWith("const DATA = "));
if (dataIdx === -1) {
    console.error("could not locate the DATA literal in ref_ALL.html");
    process.exit(1);
}
outLines[dataIdx] = `const DATA = ${json};`;
writeFileSync(htmlPath, outLines.join("\n"));
console.log(
    `regenerated: ${rows.length} rows across ${data.nsCount} namespaces`,
);
