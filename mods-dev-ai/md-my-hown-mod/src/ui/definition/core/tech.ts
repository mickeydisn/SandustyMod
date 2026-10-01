
import {
    listCurrencyTypes,
    listItems,
    listStructures,
    listTechBranches,
    listTechIds,
} from "../../../catalog.ts";
import { advField, DESC_MAX, idField, NAME_MAX, numField, textField } from "../fields.ts";
import { formatIdList, parseIdList, putCustomOrSelect } from "../values.ts";
import type { Definition, EntryReader, EntryWriter, FieldSpec } from "../types.ts";


const ID_PATTERN = "^[a-z0-9][a-z0-9._-]{0,31}$";
const ID_MSG = "lowercase id (a-z 0-9 . _ -)";



const FIELDS: FieldSpec[] = [
    idField(),
    textField("name", "Name", "Identity", true, { maxLength: NAME_MAX }),
    numField("cost", "Cost", "Research", { required: true, min: 0, max: 999999, def: "100" }),
    {
        key: "currencyType",
        label: "Currency",
        kind: "select",
        section: "Research",
        options: listCurrencyTypes,
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
        options: (f) => listTechIds(f.idSuffix),
        hint: "feeds registerNode(techId, def, { parentId }) — grids this node under a parent",
    },
    {
        key: "requires",
        label: "Requires",
        kind: "multiselect",
        section: "Research",
        options: (f) => listTechIds(f.idSuffix),
        emptyHint: "add another Tech first — a node cannot require itself.",
        hint: "TechDefinition.requires — a node can never require itself",
    },
    textField("description", "Description", "Research", false, {
        maxLength: DESC_MAX,
    }),
    textField("descriptionKey", "Description key (i18n)", "Research", false, {
        placeholder: "mods|example|tech|desc",
        maxLength: 120,
        hint: "used when no plain description is set",
    }),
    {
        
        
        
        key: "unlockStructures",
        label: "Unlocks structures",
        kind: "multiselect",
        section: "Unlocks",
        options: listStructures,
        emptyHint: "add a Structure first — or tick Always unlocked on the structure itself.",
        hint: "researching this node makes these buildable",
    },
    {
        key: "unlockItems",
        label: "Unlocks items",
        kind: "multiselect",
        section: "Unlocks",
        options: listItems,
        emptyHint: "add an Item first — there is nothing this node can grant yet.",
        hint: "items granted when the research completes",
    },
    advField(),
];




function entryToForm(e: Record<string, unknown>, read: EntryReader): void {
    read.put("name", read.str(e.name));
    read.put("description", read.str(e.description));
    read.put("descriptionKey", read.str(e.descriptionKey));
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
    const unlocks = e.unlocks as { structures?: string[]; items?: string[] } | undefined;
    read.put("unlockStructures", read.jsonList(unlocks?.structures));
    read.put("unlockItems", read.jsonList(unlocks?.items));
}


function formToEntry(form: Record<string, string>, w: EntryWriter): void {
    w.setStr("name", w.opt("name"));
    w.setStr("description", w.opt("description"));
    w.setStr("descriptionKey", w.opt("descriptionKey"));
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
    const requires = parseIdList(form.requires);
    if (requires.length > 0) w.setRaw("requires", requires);
    
    
    const unlockStructures = parseIdList(form.unlockStructures);
    const unlockItems = parseIdList(form.unlockItems);
    if (unlockStructures.length > 0 || unlockItems.length > 0) {
        const unlocks: Record<string, string[]> = {};
        if (unlockStructures.length > 0) unlocks.structures = unlockStructures;
        if (unlockItems.length > 0) unlocks.items = unlockItems;
        w.setRaw("unlocks", unlocks);
    }
}




const FORM_COVERED = [
    "name",
    "description",
    "descriptionKey",
    "cost",
    "currencyType",
    "branch",
    "parentId",
    "requires",
    "unlocks",
];

export const techDefinition: Definition = {
    tab: "techs",
    fields: FIELDS,
    formCovered: FORM_COVERED,
    entryToForm,
    formToEntry,
    
    
    
    
    
    
    
};
