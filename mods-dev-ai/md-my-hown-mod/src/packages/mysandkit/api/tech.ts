import { g } from "../host.ts";
import { LOG } from "../../../constants.ts";

export const tech = {
    /**
     * Read a registered tech definition.
     *
     * Returns `undefined` for an unknown id.
     */
    getDefinitionById(id: string): Record<string, unknown> | undefined {
        try {
            return g()?.api?.tech?.getDefinitionById?.(id) as
                | Record<string, unknown>
                | undefined;
        } catch (e) {
            console.warn(`${LOG} tech.getDefinitionById failed`, id, e);
            return undefined;
        }
    },

    /** Whether a tech has been researched. */
    isResearchedById(id: string): boolean {
        try {
            return g()?.api?.tech?.isResearchedById?.(id) === true;
        } catch (e) {
            console.warn(`${LOG} tech.isResearchedById failed`, id, e);
            return false;
        }
    },

    /**
     * Whether a tech is currently locked out.
     *
     * Separate from research: a researched tech can still be re-locked.
     */
    isLockedById(id: string): boolean {
        try {
            return g()?.api?.tech?.isLockedById?.(id) === true;
        } catch (e) {
            console.warn(`${LOG} tech.isLockedById failed`, id, e);
            return false;
        }
    },

    /** Force a tech into or out of the locked state. */
    setLockedById(id: string, locked: boolean): boolean {
        try {
            const ns = g()?.api?.tech;
            const fn = ns?.setLockedById;
            if (typeof fn !== "function") return false;
            fn.call(ns, id, locked);
            return true;
        } catch (e) {
            console.warn(`${LOG} tech.setLockedById failed`, id, locked, e);
            return false;
        }
    },

    registerDefinition(id: string, body: Record<string, unknown>): boolean {
        try {
            const ns = g()?.api?.tech;
            const fn = ns?.registerDefinition ?? ns?.addDefinition;
            if (typeof fn !== "function") return false;
            fn.call(ns, id, body);
            return true;
        } catch (e) {
            console.error(`${LOG} tech.registerDefinition failed`, id, e);
            return false;
        }
    },

    /** Host alias of {@link registerDefinition}. */
    addDefinition(id: string, body: Record<string, unknown>): boolean {
        return tech.registerDefinition(id, body);
    },
    registerNode(
        id: string,
        body: Record<string, unknown>,
        opts: Record<string, unknown>,
    ): boolean {
        try {
            const ns = g()?.api?.tech;
            if (typeof ns?.registerNode !== "function") return false;
            ns.registerNode(id, body, opts);
            return true;
        } catch (e) {
            console.warn(`${LOG} tech.registerNode failed`, id, e);
            return false;
        }
    },
    updateDefinition(id: string, partial: Record<string, unknown>): void {
        try {
            g()?.api?.tech?.updateDefinition?.(id, partial);
        } catch (e) {
            console.error(`${LOG} tech.updateDefinition failed`, id, e);
        }
    },

    conservatory: {
        appendUnlock(techId: string, unlocks: Record<string, unknown>): boolean {
            try {
                const ns = g()?.api?.tech?.conservatory;
                if (typeof ns?.appendUnlock !== "function") return false;
                ns.appendUnlock(techId, unlocks);
                return true;
            } catch (e) {
                console.warn(`${LOG} tech.conservatory.appendUnlock failed`, techId, e);
                return false;
            }
        },
    },
};
