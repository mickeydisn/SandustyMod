export function tagWallMap(data, width, height, itemsEmpty, itemsFill, mask) {
  function isFill(idx) {
    return itemsFill.includes(data[idx]);
  }
  function isEmpty(idx) {
    return itemsEmpty.includes(data[idx]);
  }

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;

      if (isEmpty(idx) && (!mask || mask[idx] == 1)) {
        // Check for floor
        if (y + 1 < height && isFill((y + 1) * width + x)) {
          data[idx] = 101; // Floor
        } // Check for roof
        else if (y - 1 >= 0 && isFill((y - 1) * width + x)) {
          data[idx] = 102; // Roof
        } else if (x - 1 >= 0 && isFill(y * width + x - 1)) {
          data[idx] = 103; // Wall
        } else if (x + 1 < height && isFill(y * width + x + 1)) {
          data[idx] = 104; // Wall
        }
      }
    }
  }
}
