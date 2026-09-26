/**
 * The **upgrade category** object definition.
 *
 * A category groups upgrades in the game's upgrade screen. It is the smallest
 * schema in the panel, and almost all of it is bookkeeping: the engine reads
 * `id`, `name` and `nameKey` and nothing else.
 *
 * `requirement` is the awkward one. `registerCategory` stores it verbatim and a
 * grep of the whole repo finds nothing that reads it; no shipped mod sets it
 * either. So it is offered as a tech id — the only shape a mod would plausibly
 * mean by "requirement" — but labelled as a pass-through the engine ignores
 * rather than dressed up as a feature. The raw box beside it is the honest
 * escape hatch for any other shape, and a save preserves it verbatim.
 *
 * Ground truth: `doc/doc-artifacts/doc.api/shared/api.upgrades.md`.
 */
import { listTechIds } from "../../catalog.ts";
import { advField, idField, NAME_MAX, textField } from "./fields.ts";
import { CUSTOM, parseIdList, parseObjectOrUndefined, putCustomOrSelect } from "./values.ts";
import type { Definition, EntryReader, EntryWriter, FieldSpec } from "./types.ts";

// ── The schema ───────────────────────────────────────────────────────────────

const FIELDS: FieldSpec[] = [
    idField(),
    {
        // api.upgrades.registerCategory({ id, name?, nameKey?, requirement? })
        // The engine guard is: if (!t.id || !t.name && !t.nameKey) throw,
        // so at least one of `name` / `nameKey` must be set. This field is not
        // marked `required` on its own — that would reject a category that
        // supplies only a name key. The rule is enforced by the cross-field
        // check in `validate` instead.
        key: "name",
        label: "Display name",
        kind: "text",
        section: "Identity",
        maxLength: NAME_MAX,
        hint: "needed unless a name key is set — the engine throws without one",
    },
    textField("nameKey", "Name key (i18n)", "Identity", false, {
        placeholder: "mods|example|category|name",
        maxLength: 120,
    }),
    {
        key: "requirementTechId",
        label: "Requirement (stored only)",
        kind: "select",
        section: "Identity",
        options: (f) => listTechIds(f.idSuffix),
        emptyHint: "add a Tech first — there is nothing to point at.",
        hint:
            "the engine stores this and never reads it, so nothing happens either way. Set it only if you know your build consumes it.",
    },
    {
        key: "requirementJson",
        label: "Requirement (raw)",
        kind: "json",
        section: "Advanced",
        jsonType: "object",
        wide: true,
        when: (f) => f.requirementTechId === CUSTOM,
        hint: "for a shape other than a tech id — stored verbatim, and equally unread",
    },
    advField(),
];

// ── Round trip ───────────────────────────────────────────────────────────────

/** Stored entry → form strings, for the whole category. */
function entryToForm(e: Record<string, unknown>, read: EntryReader): void {
    read.put("name", read.str(e.name));
    read.put("nameKey", read.str(e.nameKey));
    // The requirement is read with `putCustomOrSelect` and an **empty** option
    // list, so a stored value always lands in the raw box and the select always
    // reads `__custom__`.
    //
    // That looks like a mistake and is not: the engine reads nothing here, so
    // there is no set of "known" values to offer — a tech id is only a guess
    // about what the author meant, and guessing wrong is worse than showing the
    // value itself. The select stays because an author who *does* know their
    // build consumes a tech id can pick one, and the save path prefers it.
    const req = e.requirement;
    if (typeof req === "string") {
        putCustomOrSelect(read.put, req, "requirementTechId", "requirementJson", []);
    } else if (req !== undefined) {
        read.put("requirementTechId", CUSTOM);
        read.put("requirementJson", read.json(req));
    }
}

/** Form strings → stored entry, for the whole category. */
function formToEntry(form: Record<string, string>, w: EntryWriter): void {
    w.setStr("name", w.opt("name"));
    w.setStr("nameKey", w.opt("nameKey"));
    // Mirrors the engine guard: `if (!t.id || !t.name && !t.nameKey) throw`
    const rawReq = parseObjectOrUndefined(form.requirementJson);
    const techReq = w.opt("requirementTechId");
    if (techReq === CUSTOM) {
        if (rawReq) w.setRaw("requirement", rawReq);
    } else if (techReq) {
        w.setStr("requirement", techReq);
    } else if (rawReq) {
        w.setRaw("requirement", rawReq);
    }
}

// ── The definition ───────────────────────────────────────────────────────────

/** Stored keys this form owns — the control names happen to match all of them. */
const FORM_COVERED = ["name", "nameKey", "requirement"];

/**
 * The one cross-field rule a category has.
 *
 * The engine guard is `if (!t.id || !t.name && !t.nameKey) throw`, so a category
 * with neither a display name nor a name key fails at registration — with
 * nothing in the panel pointing at the cause. `name` alone is therefore not
 * marked `required`: a category that supplies only a name key is legal, and
 * marking the field required would reject it.
 */
function validate(form: Record<string, string>, errors: Record<string, string>): void {
    if (errors.name || errors.nameKey) return;
    if (!(form.name ?? "").trim() && !(form.nameKey ?? "").trim()) {
        errors.name = "required unless a name key is set";
    }
}

export const upgradeCategoryDefinition: Definition = {
    tab: "categories",
    fields: FIELDS,
    formCovered: FORM_COVERED,
    entryToForm,
    formToEntry,
    validate,
    // No `panel`: every control is a text box, a dropdown or a JSON area, and
    // the one conditional (`requirementJson`) is a `when`, not a widget.
};
