/**
 * Generic main-thread builder — turns an element catalogue into live content:
 * i18n strings, element + discovery registration, contact reactions and an
 * optional research node.
 *
 * Everything is derived from the catalogue entries, so a mod only supplies data.
 * Simulation profiles are driven by `@sandmd/element-profiles/worker`; this
 * module never imports the worker actions, so they stay out of the main bundle.
 *
 * `sandkit.api` is read lazily inside each step (never at module scope) so that
 * merely importing this module cannot fail before the engine is up.
 */
import "@sandmd/sandkit";
import type { TElementType } from "@sandmd/shared";
import type { ElementMain } from "../shared/element.ts";
import { safe } from "../shared/util.ts";
import type { ElementMainConfig, ElementMainResult, TechNodeConfig } from "./types.ts";

/** i18n key the builder registers an element's label under. */
export function elementNameKey(id: string): string {
    return `${id}|name`;
}

/** i18n key the builder registers an element's description under. */
export function elementDescriptionKey(id: string): string {
    return `${id}|description`;
}

function registerI18n<ElType extends string>(
    elements: readonly ElementMain<ElType>[],
    locale: string,
): void {
    const api = sandkit.api;
    for (const { spec } of elements) {
        api.i18n.register(locale, {
            [elementNameKey(spec.id)]: spec.name,
            [elementDescriptionKey(spec.id)]: spec.description,
        });
    }
}

function registerElements<ElType extends string>(
    elements: readonly ElementMain<ElType>[],
    types: Record<string, TElementType>,
): void {
    const api = sandkit.api;
    for (const { spec } of elements) {
        // Elements in catalogue order, then their discoveries.
        const elementTypeId = api.elements.register({
            id: spec.id,
            nameKey: elementNameKey(spec.id),
            descriptionKey: elementDescriptionKey(spec.id),
            colors: { variants: spec.colors },
            density: spec.density,
            metaColor: spec.metaColor,
            matterType: spec.matterType,
        }).elementType;
        types[spec.key] = elementTypeId;
        api.discoveries.addElementByType(elementTypeId);
    }
}

function registerReactions<ElType extends string>(
    elements: readonly ElementMain<ElType>[],
    types: Record<string, TElementType>,
): void {
    const api = sandkit.api;
    for (const { reactions } of elements) {
        for (const r of reactions) {
            api.reactions.registerContact({
                inputA: types[r.inputA],
                inputB: types[r.inputB],
                outputA: r.outputA ? types[r.outputA] : null,
                outputB: r.outputB ? types[r.outputB] : null,
            });
        }
    }
}

/** Register the node's i18n and attach it to the first parent tech present. */
function registerTech(tech: TechNodeConfig, locale: string): boolean {
    const api = sandkit.api;
    api.i18n.register(tech.locale ?? locale, {
        [tech.nameKey]: tech.name,
        [tech.descriptionKey]: tech.description,
    });

    let parentId: number | null = null;
    for (const name of tech.parents ?? []) {
        const id = safe(() => sandkit.enums?.Tech?.[name]);
        if (id != null) {
            parentId = id;
            break;
        }
    }
    if (parentId == null) return false;

    api.tech.registerNode(
        tech.id,
        { nameKey: tech.nameKey, descriptionKey: tech.descriptionKey, cost: tech.cost ?? 0 },
        { parentId },
    );
    return true;
}

/**
 * Register every element, its discovery, its i18n strings and its contact
 * reactions, then optionally a research node.
 *
 * Returns the resolved key → element-type map so the caller can keep its own
 * registry in sync without re-resolving ids.
 */
export function buildElementMain<ElType extends string>(
    config: ElementMainConfig<ElType>,
): ElementMainResult {
    const locale = config.locale ?? "en";
    // Seed with the caller's pre-resolved ids (vanilla keys referenced by
    // reactions); registering the elements overwrites the astro keys.
    const types: Record<string, TElementType> = { ...config.types };

    registerI18n(config.elements, locale);
    registerElements(config.elements, types);
    registerReactions(config.elements, types);
    const techRegistered = config.tech ? registerTech(config.tech, locale) : false;

    return { types, techRegistered };
}
