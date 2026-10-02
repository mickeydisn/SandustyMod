
import {
    listCurrencyTypes,
    listStructures,
    listTechBranches,
    listTechIds,
} from "../../../catalog.ts";
import { UNLOCK_NODE_KIND_OPTS } from "../choices.ts";
import { advField, DESC_MAX, idField, NAME_MAX, numField, textField } from "../fields.ts";
import { parseIdList, putCustomOrSelect } from "../values.ts";
import type { Definition, EntryReader, EntryWriter, FieldSpec } from "../types.ts";




const ID_PATTERN = "^[a-z0-9][a-z0-9._-]{0,31}$";
const ID_MSG = "lowercase id (a-z 0-9 . _ -)";


const buildsTech = (f: Record<string, string>) => f.kind === "tech" && f.useExistingTech !== "true";

const FIELDS: FieldSpec[] = [
    idField(),
    textField("name", "Name", "Identity", true, { maxLength: NAME_MAX }),
    {
        
        
        key: "kind",
        label: "Kind",
        kind: "select",
        section: "Identity",
        required: true,
        def: "always",
        options: UNLOCK_NODE_KIND_OPTS,
        hint: "a tech node is a real research step in the game's tech tree",
    },
    
    
    
    textField("description", "Description", "Identity", false, { maxLength: DESC_MAX }),
    {
        
        
        
        
        key: "useExistingTech",
        label: "Reuse an engine tech",
        kind: "bool",
        section: "Node",
        def: "false",
        hint: "off: this node builds its own tech. on: it borrows one already in the tree.",
    },
    {
        key: "techId",
        label: "Engine tech to reuse",
        kind: "select",
        section: "Node",
        when: (f) => f.kind === "tech" && f.useExistingTech === "true",
        options: (f) => listTechIds(f.idSuffix),
        emptyHint: "add a Tech first — there is nothing to borrow.",
        hint: "several nodes can sit behind the same research step",
    },
    numField("cost", "Cost", "Research", {
        min: 0,
        max: 999999,
        def: "100",
        when: buildsTech,
    }),
    {
        key: "currencyType",
        label: "Currency",
        kind: "select",
        section: "Research",
        options: listCurrencyTypes,
        when: buildsTech,
        hint: "TechDefinition.currencyType — a free string in the engine",
    },
    {
        key: "currencyTypeCustom",
        label: "Currency id",
        kind: "text",
        section: "Research",
        when: (f) => f.currencyType === "__custom__",
        placeholder: "coins",
        maxLength: 32,
        pattern: ID_PATTERN,
        patternMsg: ID_MSG,
    },
    {
        key: "branch",
        label: "Branch",
        kind: "select",
        section: "Research",
        options: listTechBranches,
        when: buildsTech,
        hint: "TechDefinition.branch — usually copied from the parent node",
    },
    {
        key: "branchCustom",
        label: "Branch id",
        kind: "text",
        section: "Research",
        when: (f) => f.branch === "__custom__",
        placeholder: "industry",
        maxLength: 32,
        pattern: ID_PATTERN,
        patternMsg: ID_MSG,
    },
    {
        key: "parentId",
        label: "Parent node",
        kind: "select",
        section: "Research",
        when: buildsTech,
        options: (f) => listTechIds(f.idSuffix),
        emptyHint: "add another Tech first — a node cannot be its own parent.",
        hint: "without one the tech is never placed in the grid and cannot be bought",
    },
    {
        key: "requires",
        label: "Requires",
        kind: "multiselect",
        section: "Research",
        when: buildsTech,
        options: (f) => listTechIds(f.idSuffix),
        emptyHint: "add another Tech first — a node cannot require itself.",
        hint: "other research that must be done first",
    },
    {
        
        
        
        
        
        
        
        
        
        
        key: "gatesStructures",
        label: "Structures it unlocks",
        kind: "multiselect",
        section: "Unlocks",
        options: listStructures,
        emptyHint: "no structure points at this node yet.",
        hint:
            "derived — set it on each structure, not here. Shown so you can see what rides on this node.",
    },
    advField(),
];




function entryToForm(e: Record<string, unknown>, read: EntryReader): void {
    read.put("name", read.str(e.name));
    read.put("description", read.str(e.description));
    read.put("kind", read.str(e.kind));
    
    
    
    
    const techId = read.str(e.techId);
    if (techId) {
        read.put("useExistingTech", "true");
        read.put("techId", techId);
    } else {
        read.put("useExistingTech", "false");
    }
    
    
    
    if (read.str(e.kind) === "tech" && !techId) {
        read.put("cost", read.num(e.cost));
        
        
        putCustomOrSelect(
            read.put,
            read.str(e.currencyType),
            "currencyType",
            "currencyTypeCustom",
            listCurrencyTypes(),
        );
        putCustomOrSelect(
            read.put,
            read.str(e.branch),
            "branch",
            "branchCustom",
            listTechBranches(),
        );
        read.put("parentId", read.str(e.parentId));
        read.put("requires", read.jsonList(e.requires));
    }
    
    
}


function formToEntry(form: Record<string, string>, w: EntryWriter): void {
    w.setStr("name", w.opt("name"));
    w.setStr("description", w.opt("description"));
    w.setStr("kind", w.opt("kind"));
    
    
    
    
    
    
    
    
    
    
    
    const borrowing = w.opt("kind") === "tech" && w.optBool("useExistingTech") === true;
    if (borrowing) {
        w.setStr("techId", w.opt("techId"));
    } else if (w.opt("kind") === "tech") {
        w.setNum("cost", w.optNum("cost"));
        w.setStr(
            "currencyType",
            w.opt("currencyType") === "__custom__"
                ? w.opt("currencyTypeCustom")
                : w.opt("currencyType"),
        );
        w.setStr(
            "branch",
            w.opt("branch") === "__custom__" ? w.opt("branchCustom") : w.opt("branch"),
        );
        w.setStr("parentId", w.opt("parentId"));
        const requires = parseIdList(form.requires ?? "");
        if (requires.length > 0) w.setRaw("requires", requires);
    }
    
    
}




const FORM_COVERED = [
    "name",
    "description",
    "kind",
    "techId",
    "cost",
    "currencyType",
    "branch",
    "parentId",
    "requires",
];

export const unlockNodeDefinition: Definition = {
    tab: "unlockNodes",
    fields: FIELDS,
    formCovered: FORM_COVERED,
    entryToForm,
    formToEntry,
    
    
    
    
    
    
};
