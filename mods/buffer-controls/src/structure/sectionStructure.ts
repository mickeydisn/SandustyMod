export const BUILD_MODE = () => {
  return {
    single: { type: "single" },
    rec: { type: "rectangle" },
    line: { type: "line", directions: ["horizontal", "vertical"] },
  };
};

export const VARIANTS = (typeId: string) => {
  return {
    single: { id: typeId, angles: [0] },
    card: { id: typeId, angles: [0, 90, 180, 270] },
  };
};

export const sectionBuild = {
  single: (typeId: string) => {
    return {
      buildModes: [
        BUILD_MODE().single,
      ],
      variants: [
        VARIANTS(typeId).single,
      ],
    };
  },
  rec: (typeId: string) => {
    return {
      buildModes: [
        BUILD_MODE().rec,
      ],
      variants: [
        VARIANTS(typeId).single,
      ],
    };
  },
};
