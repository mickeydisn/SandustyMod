const keyCheck = {};
const keyBind = {
  up: ["ArrowUp", "z"],
  down: ["ArrowDown", "s"],
  left: ["ArrowLeft", "q"],
  right: ["ArrowRight", "d"],
};

// Update player position based on input
const playerKey = () => {
  return {
    up: keyBind.up.map((k) => keyCheck[k]).includes(true),
    down: keyBind.down.map((k) => keyCheck[k]).includes(true),
    left: keyBind.left.map((k) => keyCheck[k]).includes(true),
    right: keyBind.right.map((k) => keyCheck[k]).includes(true),
  };
};
// Main thread (e.g., main.ts)
const initKeyBoard = (callback) => {
  // Listen to keyboard input
  window.addEventListener("keydown", (event) => {
    keyCheck[event.key] = true;
    callback(playerKey());
  });

  window.addEventListener("keyup", (event) => {
    keyCheck[event.key] = false;
  });
};
