import "@sandmd/sandkit";

export type CatalogueSpriteEntry = {
    /** Logical id used in catalogue */
    id: string;
    /** Relative file under assetDir */
    filePath: string;
};

export async function loadSpriteMap(
    modId: string,
    entries: CatalogueSpriteEntry[],
    idPrefix?: string,
): Promise<Record<string, string>> {
    const ids: Record<string, string> = {};
    let next = 0;

    const worker = async () => {
        while (next < entries.length) {
            const entry = entries[next++]!;
            const spriteId = `${modId}:${idPrefix ?? ""}${entry.id}`;
            try {
                await sandkit.api.sprites.loadFromMod(spriteId, `${entry.filePath}`);
                ids[entry.id] = spriteId;
            } catch (e) {
                console.error(`${modId}: Unknow Asset:  ${entry.filePath}`);
                console.error("Thrown value:", e);
            }
        }
    };
    await Promise.all(Array.from({ length: Math.min(16, entries.length) }, () => worker()));
    return ids;
}

export async function loadFromFileMap(
    modId: string,
    filePathMap: Record<string, string>,
    idPrefix?: string,
): Promise<Record<string, string>> {
    const entries = Object.entries(filePathMap).map(([key, filePath]) => ({ id: key, filePath }));
    return await loadSpriteMap(modId, entries, idPrefix);
}

export async function loadSizedAsset(
    modId: string,
    id: string,
    filePath: string,
): Promise<string> {
    const spriteId = `${modId}:${id}`;
    await sandkit.api.sprites.loadFromMod(spriteId, `${filePath}`);
    return spriteId;
}
