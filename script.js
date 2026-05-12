const board = document.querySelector("#board");
const message = document.querySelector("#message");
const dragGhost = document.querySelector("#dragGhost");
const releaseBtn = document.querySelector("#releaseBtn");
const holdBtn = document.querySelector("#holdBtn");
const clearBtn = document.querySelector("#clearBtn");
const modeToggle = document.querySelector("#modeToggle");
const weightTool = document.querySelector("#weightTool");
const springTool = document.querySelector("#springTool");
const successOverlay = document.querySelector("#successOverlay");
const weightControls = document.querySelector("#weightControls");
const removeOneWeightBtn = document.querySelector("#removeOneWeightBtn");
const removeAllWeightsBtn = document.querySelector("#removeAllWeightsBtn");
const springControls = document.querySelector("#springControls");
const forceInput = document.querySelector("#forceInput");
const forceDownBtn = document.querySelector("#forceDownBtn");
const forceUpBtn = document.querySelector("#forceUpBtn");
const rotateSpringBtn = document.querySelector("#rotateSpringBtn");
const removeSpringBtn = document.querySelector("#removeSpringBtn");

const GRID_SIZE = 11;
const CENTER = Math.floor(GRID_SIZE / 2);
const MAX_WEIGHTS_PER_HOLE = 3;
const SPRING_MIN = 0;
const SPRING_MAX = 10;
const SPRING_STEP = 0.1;
const BALANCE_TOLERANCE = 0.0001;

const directionLabels = ["右向き", "下向き", "左向き", "上向き"];
const directionVectors = [
  { fx: 1, fy: 0 },
  { fx: 0, fy: -1 },
  { fx: -1, fy: 0 },
  { fx: 0, fy: 1 },
];

const state = {
  mode: "bar",
  weights: new Map(),
  springs: [],
  selectedWeightKey: null,
  selectedSpringId: null,
  nextSpringId: 1,
  drag: null,
};

function holeKey(row, col) {
  return `${row},${col}`;
}

function isCenter(row, col) {
  return row === CENTER && col === CENTER;
}

function holeToPercent(index) {
  return 4.5 + index * 9.1;
}

function clampForce(value) {
  const number = Number.isFinite(value) ? value : 0;
  return Math.min(SPRING_MAX, Math.max(SPRING_MIN, Math.round(number * 10) / 10));
}

function setHolding(text = "手で保持中。配置を変えたら、もう一度手を放して確かめます。") {
  board.classList.remove("is-clockwise", "is-counter");
  hideSuccessOverlay();
  message.className = "message is-holding";
  message.textContent = text;
}

function hideSuccessOverlay() {
  successOverlay.classList.remove("is-visible");
  successOverlay.setAttribute("aria-hidden", "true");
}

function createBoard() {
  board.innerHTML = "";
  board.classList.toggle("is-bar", state.mode === "bar");

  const rowStart = state.mode === "bar" ? CENTER : 0;
  const rowEnd = state.mode === "bar" ? CENTER + 1 : GRID_SIZE;

  for (let row = rowStart; row < rowEnd; row += 1) {
    for (let col = 0; col < GRID_SIZE; col += 1) {
      const hole = document.createElement("div");
      hole.className = isCenter(row, col) ? "hole is-center" : "hole";
      hole.dataset.row = row;
      hole.dataset.col = col;
      hole.style.left = `${holeToPercent(col)}%`;
      hole.style.top = `${holeToPercent(row)}%`;
      board.append(hole);
    }
  }

  renderPlacedForces();
}

function renderPlacedForces() {
  board.querySelectorAll(".weight-stack, .spring-force").forEach((element) => element.remove());

  state.weights.forEach((count, key) => {
    const [row, col] = key.split(",").map(Number);
    const stack = document.createElement("div");
    stack.className = key === state.selectedWeightKey ? "weight-stack is-selected" : "weight-stack";
    stack.dataset.kind = "placed-weight";
    stack.dataset.row = row;
    stack.dataset.col = col;
    stack.style.setProperty("--x", `${holeToPercent(col)}%`);
    stack.style.setProperty("--y", `${holeToPercent(row)}%`);
    stack.innerHTML = '<div class="peg"></div><div class="rope"></div>';

    for (let index = 0; index < count; index += 1) {
      const ball = document.createElement("div");
      ball.className = "weight-ball";
      stack.append(ball);
    }

    attachDragStart(stack, "placed-weight");
    stack.addEventListener("click", () => {
      selectWeight(row, col);
    });
    board.append(stack);
  });

  state.springs.forEach((spring) => {
    const springNode = document.createElement("div");
    springNode.className = spring.id === state.selectedSpringId ? "spring-force is-selected" : "spring-force";
    springNode.dataset.kind = "placed-spring";
    springNode.dataset.id = spring.id;
    springNode.style.setProperty("--x", `${holeToPercent(spring.col)}%`);
    springNode.style.setProperty("--y", `${holeToPercent(spring.row)}%`);
    springNode.style.setProperty("--angle", `${spring.direction * 90}deg`);
    springNode.innerHTML = `
      <svg class="spring-body" viewBox="0 0 230 74" aria-hidden="true">
        <path class="meter-hook meter-hook-left" d="M5 37 C-10 20 4 4 22 9 C34 12 31 28 20 27" />
        <path class="meter-neck" d="M24 37 H42" />
        <rect class="meter-cap" x="38" y="27" width="14" height="20" rx="4" />
        <rect class="meter-body" x="50" y="8" width="122" height="58" rx="18" />
        <path class="meter-ridge" d="M62 11 H160 M62 63 H160" />
        <text class="meter-title" x="76" y="20">NEWTON METER</text>
        <text class="meter-code" x="136" y="20">GN-1</text>
        <rect class="meter-screen" x="83" y="24" width="58" height="26" rx="4" />
        <path class="meter-digits" d="M94 31 H103 M99 31 V44 M110 31 H119 M115 31 V44 M126 31 H135 M131 31 V44" />
        <circle class="meter-button" cx="68" cy="37" r="8" />
        <circle class="meter-button" cx="154" cy="37" r="8" />
        <path class="meter-label" d="M86 18 H132" />
        <text class="meter-unit" x="142" y="48">N</text>
        <path class="meter-neck" d="M172 37 H188" />
        <path class="meter-hook meter-hook-right" d="M188 37 C210 5 235 17 221 44 C212 61 190 64 188 46" />
      </svg>
      <div class="spring-value">${spring.force.toFixed(1)}N</div>
    `;

    springNode.addEventListener("click", () => {
      selectSpring(spring.id);
    });
    attachDragStart(springNode, "placed-spring");
    board.append(springNode);
  });

  updateSpringEditor();
  updateWeightEditor();
}

function attachDragStart(element, source) {
  element.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    const data = { source };

    if (source === "placed-weight") {
      data.row = Number(element.dataset.row);
      data.col = Number(element.dataset.col);
      state.selectedWeightKey = holeKey(data.row, data.col);
      state.selectedSpringId = null;
      updateWeightEditor();
      updateSpringEditor();
    }

    if (source === "placed-spring") {
      data.id = Number(element.dataset.id);
      state.selectedSpringId = data.id;
      state.selectedWeightKey = null;
      updateSpringEditor();
      updateWeightEditor();
    }

    startDrag(event, data);
  });
}

function startDrag(event, data) {
  board.classList.remove("is-clockwise", "is-counter");
  hideSuccessOverlay();
  if (!message.classList.contains("is-holding")) {
    message.className = "message is-holding";
    message.textContent = "手で保持中。配置を変えて、もう一度試せます。";
  }

  state.drag = {
    pointerId: event.pointerId,
    ...data,
  };

  const ghostKind = data.source.includes("spring") ? "spring" : "weight";
  dragGhost.className = `drag-ghost is-visible is-${ghostKind}`;
  moveGhost(event.clientX, event.clientY);
  event.currentTarget.setPointerCapture?.(event.pointerId);
}

function moveGhost(x, y) {
  dragGhost.style.transform = `translate(${x}px, ${y}px) translate(-50%, -50%)`;
}

function finishDrag(event) {
  if (!state.drag) {
    return;
  }

  const target = getNearestHole(event.clientX, event.clientY);
  const drag = state.drag;
  state.drag = null;
  dragGhost.className = "drag-ghost";

  if (!target) {
    renderPlacedForces();
    return;
  }

  if (drag.source === "tool-weight") {
    addWeight(target.row, target.col);
  } else if (drag.source === "placed-weight") {
    moveWeight(drag.row, drag.col, target.row, target.col);
  } else if (drag.source === "tool-spring") {
    addSpring(target.row, target.col);
  } else if (drag.source === "placed-spring") {
    moveSpring(drag.id, target.row, target.col);
  }
}

function getNearestHole(clientX, clientY) {
  const rect = board.getBoundingClientRect();
  if (
    clientX < rect.left ||
    clientX > rect.right ||
    clientY < rect.top ||
    clientY > rect.bottom
  ) {
    return null;
  }

  const xPercent = ((clientX - rect.left) / rect.width) * 100;
  const yPercent = ((clientY - rect.top) / rect.height) * 100;
  const col = Math.round((xPercent - 4.5) / 9.1);
  const row = state.mode === "bar" ? CENTER : Math.round((yPercent - 4.5) / 9.1);

  if (
    row < 0 ||
    row >= GRID_SIZE ||
    col < 0 ||
    col >= GRID_SIZE ||
    (state.mode === "bar" && Math.abs(yPercent - 50) > 16) ||
    isCenter(row, col)
  ) {
    showPlacementMessage("中心のねじ穴には配置できません。別の穴を選んでください。");
    return null;
  }

  const centerX = holeToPercent(col);
  const centerY = holeToPercent(row);
  const distance = Math.hypot(xPercent - centerX, yPercent - centerY);
  return distance <= 5.2 ? { row, col } : null;
}

function showPlacementMessage(text) {
  message.className = "message is-holding";
  message.textContent = text;
}

function addWeight(row, col) {
  const key = holeKey(row, col);
  const current = state.weights.get(key) || 0;

  if (current >= MAX_WEIGHTS_PER_HOLE) {
    showPlacementMessage("同じ穴に連ねられるおもりは3個までです。");
    renderPlacedForces();
    return;
  }

  state.weights.set(key, current + 1);
  state.selectedWeightKey = key;
  state.selectedSpringId = null;
  setHolding("おもりを1個追加しました。");
  renderPlacedForces();
}

function moveWeight(fromRow, fromCol, toRow, toCol) {
  const fromKey = holeKey(fromRow, fromCol);
  const toKey = holeKey(toRow, toCol);

  if (fromKey === toKey) {
    renderPlacedForces();
    return;
  }

  const movingCount = state.weights.get(fromKey) || 0;
  const targetCount = state.weights.get(toKey) || 0;

  if (!movingCount) {
    renderPlacedForces();
    return;
  }

  if (targetCount + movingCount > MAX_WEIGHTS_PER_HOLE) {
    showPlacementMessage("移動先は3個を超えてしまいます。別の穴を選んでください。");
    renderPlacedForces();
    return;
  }

  state.weights.delete(fromKey);
  state.weights.set(toKey, targetCount + movingCount);
  state.selectedWeightKey = toKey;
  state.selectedSpringId = null;
  setHolding("おもりを移動しました。");
  renderPlacedForces();
}

function addSpring(row, col) {
  const spring = {
    id: state.nextSpringId,
    row,
    col,
    force: 1,
    direction: 3,
  };
  state.nextSpringId += 1;
  state.springs.push(spring);
  state.selectedSpringId = spring.id;
  state.selectedWeightKey = null;
  setHolding("ばねばかりを追加しました。力の大きさや向きを調整できます。");
  renderPlacedForces();
}

function moveSpring(id, row, col) {
  const spring = findSelectedSpring(id);
  if (!spring) {
    renderPlacedForces();
    return;
  }

  spring.row = row;
  spring.col = col;
  state.selectedSpringId = id;
  state.selectedWeightKey = null;
  setHolding("ばねばかりを移動しました。");
  renderPlacedForces();
}

function selectSpring(id) {
  state.selectedSpringId = id;
  state.selectedWeightKey = null;
  renderPlacedForces();
}

function selectWeight(row, col) {
  const key = holeKey(row, col);
  if (!state.weights.has(key)) {
    return;
  }

  state.selectedWeightKey = key;
  state.selectedSpringId = null;
  renderPlacedForces();
}

function updateWeightEditor() {
  const key = state.selectedWeightKey;
  const count = key ? state.weights.get(key) : 0;

  if (!key || !count) {
    state.selectedWeightKey = null;
    weightControls.hidden = true;
    return;
  }

  weightControls.hidden = false;
}

function removeOneSelectedWeight() {
  const key = state.selectedWeightKey;
  const count = key ? state.weights.get(key) : 0;
  if (!key || !count) {
    return;
  }

  if (count <= 1) {
    state.weights.delete(key);
    state.selectedWeightKey = null;
  } else {
    state.weights.set(key, count - 1);
  }

  setHolding("選択したおもりを1個外しました。");
  renderPlacedForces();
}

function removeAllSelectedWeights() {
  const key = state.selectedWeightKey;
  if (!key || !state.weights.has(key)) {
    return;
  }

  state.weights.delete(key);
  state.selectedWeightKey = null;
  setHolding("選択した穴のおもりを全部外しました。");
  renderPlacedForces();
}

function findSelectedSpring(id = state.selectedSpringId) {
  return state.springs.find((spring) => spring.id === id);
}

function updateSpringEditor() {
  const spring = findSelectedSpring();

  if (!spring) {
    springControls.hidden = true;
    return;
  }

  springControls.hidden = false;
  forceInput.value = spring.force.toFixed(1);
}

function updateSelectedSpringForce(value) {
  const spring = findSelectedSpring();
  if (!spring) {
    return;
  }

  spring.force = clampForce(value);
  setHolding("ばねばかりの力を変更しました。");
  renderPlacedForces();
}

function rotateSelectedSpring() {
  const spring = findSelectedSpring();
  if (!spring) {
    return;
  }

  spring.direction = (spring.direction + 1) % directionLabels.length;
  setHolding("ばねばかりの向きを90度回転しました。");
  renderPlacedForces();
}

function removeSelectedSpring() {
  const spring = findSelectedSpring();
  if (!spring) {
    return;
  }

  state.springs = state.springs.filter((item) => item.id !== spring.id);
  state.selectedSpringId = state.springs[0]?.id || null;
  setHolding("ばねばかりを外しました。");
  renderPlacedForces();
}

function calculateMoment() {
  let moment = 0;

  state.weights.forEach((count, key) => {
    const [row, col] = key.split(",").map(Number);
    const x = col - CENTER;
    const forceY = -count;
    moment += x * forceY;
  });

  state.springs.forEach((spring) => {
    const x = spring.col - CENTER;
    const y = CENTER - spring.row;
    const vector = directionVectors[spring.direction];
    const forceX = vector.fx * spring.force;
    const forceY = vector.fy * spring.force;
    moment += x * forceY - y * forceX;
  });

  return moment;
}

function releaseBoard() {
  const moment = calculateMoment();
  board.classList.remove("is-clockwise", "is-counter");

  if (Math.abs(moment) <= BALANCE_TOLERANCE) {
    message.className = "message is-success";
    message.textContent = "つり合い成功！ボードは回転せずに止まっています。";
    successOverlay.classList.remove("is-visible");
    successOverlay.setAttribute("aria-hidden", "false");
    requestAnimationFrame(() => {
      successOverlay.classList.add("is-visible");
    });
    return;
  }

  hideSuccessOverlay();
  const className = moment < 0 ? "is-clockwise" : "is-counter";
  const label = moment < 0 ? "時計回り" : "反時計回り";
  requestAnimationFrame(() => {
    board.classList.add(className);
  });
  message.className = "message is-moving";
  message.textContent = `力のモーメントがつり合っていないため、ボードは${label}に回転しました。`;
}

function clearAll() {
  state.weights.clear();
  state.springs = [];
  state.selectedWeightKey = null;
  state.selectedSpringId = null;
  state.nextSpringId = 1;
  setHolding("すべて外しました。新しい配置で調べられます。");
  renderPlacedForces();
}

function setMode(mode) {
  if (state.mode === mode) {
    return;
  }

  state.mode = mode;

  if (mode === "bar") {
    state.weights.forEach((count, key) => {
      const [row] = key.split(",").map(Number);
      if (row !== CENTER) {
        state.weights.delete(key);
      }
    });
    state.springs = state.springs.filter((spring) => spring.row === CENTER);

    if (state.selectedWeightKey) {
      const [row] = state.selectedWeightKey.split(",").map(Number);
      if (row !== CENTER || !state.weights.has(state.selectedWeightKey)) {
        state.selectedWeightKey = null;
      }
    }

    if (!findSelectedSpring()) {
      state.selectedSpringId = state.springs[0]?.id || null;
    }
  }

  createBoard();
  setHolding(mode === "bar" ? "棒モードに切り替えました。" : "板モードに切り替えました。");
  renderPlacedForces();
}

function registerToolDrag(button, source) {
  button.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    startDrag(event, { source });
  });
}

document.addEventListener("pointermove", (event) => {
  if (!state.drag) {
    return;
  }
  moveGhost(event.clientX, event.clientY);
});

document.addEventListener("pointerup", finishDrag);
document.addEventListener("pointercancel", finishDrag);

registerToolDrag(weightTool, "tool-weight");
registerToolDrag(springTool, "tool-spring");

releaseBtn.addEventListener("click", releaseBoard);
holdBtn.addEventListener("click", () => {
  setHolding("手で保持中。配置や力を変えて、もう一度試せます。");
});
clearBtn.addEventListener("click", clearAll);
modeToggle.addEventListener("change", () => {
  setMode(modeToggle.checked ? "bar" : "board");
});
removeOneWeightBtn.addEventListener("click", removeOneSelectedWeight);
removeAllWeightsBtn.addEventListener("click", removeAllSelectedWeights);

forceInput.addEventListener("change", () => {
  updateSelectedSpringForce(Number(forceInput.value));
});

forceInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    forceInput.blur();
  }
});

forceDownBtn.addEventListener("click", () => {
  const spring = findSelectedSpring();
  if (spring) {
    updateSelectedSpringForce(spring.force - SPRING_STEP);
  }
});

forceUpBtn.addEventListener("click", () => {
  const spring = findSelectedSpring();
  if (spring) {
    updateSelectedSpringForce(spring.force + SPRING_STEP);
  }
});

rotateSpringBtn.addEventListener("click", rotateSelectedSpring);
removeSpringBtn.addEventListener("click", removeSelectedSpring);

createBoard();
