import { iconsList } from "./isonList.js";

export const iconsURL = iconsList.map((iconsInfo) => {
  // Simple Icons slugs are lowercase alphanumerics; drop spaces and stray
  // punctuation (e.g. "O'Reilly" -> "oreilly").
  const name = iconsInfo.title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
  return `https://cdn.simpleicons.org/${name}/000000`;
  // return `https://raw.githubusercontent.com/simple-icons/simple-icons/refs/heads/develop/icons/${name}.svg`;
});

export const randomIcons = () => {
  // Select a random icon name from the list
  const randomIconName = iconsURL[Math.floor(Math.random() * iconsURL.length)];
  return randomIconName;
};

// Function to draw a random icon
export function drawRandomIcon(ctx, x, y, iconSize = 32) {
  // Select a random icon name from the list
  const randomIconName = randomIcons();
  console.log(randomIconName);
  // Create an image element for the icon
  const iconImg = new Image();
  iconImg.crossOrigin = "anonymous";
  iconImg.src = randomIconName;

  iconImg.onload = () => {
    // Create an offscreen canvas to control scaling and pixel manipulation
    const offCanvas = document.createElement("canvas");
    offCanvas.width = iconSize;
    offCanvas.height = iconSize;
    const offCtx = offCanvas.getContext("2d", { willReadFrequently: true });
    offCtx.imageSmoothingEnabled = false;

    // Draw and scale the image to fit iconSize
    offCtx.drawImage(iconImg, 0, 0, iconSize, iconSize);

    const imageData = offCtx.getImageData(0, 0, iconSize, iconSize);

    const data = imageData.data;
    for (let i = 0; i < data.length; i += 4) {
      const alpha = data[i + 3];
      if (alpha > 0) {
        data[i] = 255; // Red
        data[i + 1] = 0; // Green
        data[i + 2] = 255; // Blue
        data[i + 3] = 255; // Full opacity
      }
    }
    offCtx.putImageData(imageData, 0, 0);

    // Set random rotation angle
    const angle = Math.random() * 2 * Math.PI;

    // Save the current context state
    ctx.save();
    ctx.translate(x + iconSize / 2, y + iconSize / 2);
    ctx.rotate(angle);
    ctx.drawImage(offCanvas, -iconSize / 2, -iconSize / 2);
    ctx.restore();
  };
}

const imageForced = [
  "ulule",
  "apple",
  "linux",
  "almalinux",
  "deno",
  "platformio",
  "awsorganizations",
  "keeweb",
  "bitwig",
  "gotomeeting",
  "pivotaltracker",
  "huggingface",
  "fossilscm",
  "notepadplusplus",
  "gitconnected",
  "bitrise",
  "rocket",
  "honeybadger",
];

export async function loadSvgMaskToBuffer(size = 64, id = null) {
  let randomIconUrl = randomIcons();

  if (id && id < imageForced.length) {
    randomIconUrl = `https://cdn.simpleicons.org/${imageForced[id]}/000000`;
  }

  // Load the image, retrying with fresh random icons on failures (bad slugs
  // or CORS on the 404 page) so a single missing icon never aborts generation.
  let img = null;
  for (let attempt = 0; attempt < 10 && !img; attempt++) {
    const url = attempt === 0 ? randomIconUrl : randomIcons();
    img = await new Promise((resolve) => {
      const i = new Image();
      i.crossOrigin = "anonymous";
      i.onload = () => resolve(i);
      i.onerror = () => resolve(null);
      i.src = url;
    });
  }

  if (!img) {
    // Nothing could be loaded; return an empty (all transparent) mask so the
    // map still generates, just without this icon.
    console.warn("[loadSvgMaskToBuffer] No icon could be loaded, using empty mask.");
    return new Array(size * size).fill(0);
  }

  // Create canvas context
  const canvas = typeof OffscreenCanvas !== "undefined"
    ? new OffscreenCanvas(size, size)
    : (() => {
      const c = document.createElement("canvas");
      c.width = size;
      c.height = size;
      return c;
    })();
  const ctx = canvas.getContext("2d", { willReadFrequently: true });

  // Disable smoothing
  ctx.imageSmoothingEnabled = false;

  // Draw image into the canvas
  ctx.clearRect(0, 0, size, size);
  ctx.drawImage(img, 0, 0, size, size);

  // Extract pixel data
  const { data } = ctx.getImageData(0, 0, size, size);
  const mask = [];

  // Convert alpha to mask (0 or 1, or you can keep float values)
  for (let i = 0; i < data.length; i += 4) {
    const alpha = data[i + 3] / 255; // normalized alpha
    mask.push(alpha > 0 ? 1 : 0);
  }

  return mask;
}
