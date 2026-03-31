const solver = globalThis.TriangleMazeSolver;

if (!solver) {
  throw new Error("TriangleMazeSolver is required before app.js");
}

const { createGrid, solveOptimalPath, countGlowingNodes } = solver;

const MODES = {
  IDLE: "idle",
  EDITING: "editing",
  SOLVED: "solved"
};

const MODE_LABELS = {
  [MODES.IDLE]: "未生成",
  [MODES.EDITING]: "编辑中",
  [MODES.SOLVED]: "已求解"
};

const TIE_BREAK_LABELS = {
  preferLeft: "平分时优先左侧",
  preferRight: "平分时优先右侧"
};

const CONFIG = {
  rows: {
    min: 1,
    max: 30
  },
  example: {
    rows: 5,
    glowingColsByRow: [
      [1],
      [1],
      [2, 3],
      [1, 2, 4],
      [2, 3, 4]
    ]
  },
  layout: {
    minViewportWidth: 320,
    minHeight: 320,
    paddingXLarge: 72,
    paddingXMedium: 48,
    paddingXSmall: 24,
    paddingYLarge: 56,
    paddingYMedium: 40,
    paddingYSmall: 30,
    baseWidthSmall: 620,
    baseWidthMedium: 720,
    baseWidthLarge: 320,
    minSpacingXLarge: 28,
    minSpacingXMedium: 18,
    minSpacingXSmall: 10,
    maxSpacingXLarge: 68,
    maxSpacingXMedium: 44,
    maxSpacingXSmall: 22,
    minSpacingYLarge: 26,
    minSpacingYMedium: 16,
    minSpacingYSmall: 10,
    maxSpacingYLarge: 58,
    maxSpacingYMedium: 36,
    maxSpacingYSmall: 19,
    nodeRadiusLarge: 8.5,
    nodeRadiusMedium: 6.2,
    nodeRadiusSmall: 3.6,
    hitAreaPaddingLarge: 9,
    hitAreaPaddingSmall: 5,
    minHitRadiusLarge: 16,
    minHitRadiusSmall: 8.5
  },
  copy: {
    initialStatus: "输入行数，或查看示例解。",
    idleSummary: "先生成迷阵或查看示例解。",
    readySummary: "当前可编辑，运行后计算最优路径。"
  }
};

const state = {
  grid: [],
  solution: null,
  mode: MODES.IDLE,
  tieBreak: "preferLeft",
  pendingFocusKey: null
};

const elements = {
  rowsInput: document.getElementById("rowsInput"),
  tieBreakSelect: document.getElementById("tieBreakSelect"),
  generateBtn: document.getElementById("generateBtn"),
  runBtn: document.getElementById("runBtn"),
  exampleBtn: document.getElementById("exampleBtn"),
  clearBtn: document.getElementById("clearBtn"),
  resetBtn: document.getElementById("resetBtn"),
  statusBox: document.getElementById("statusBox"),
  mazeScroll: document.getElementById("mazeScroll"),
  mazeSvg: document.getElementById("mazeSvg"),
  mazePlaceholder: document.getElementById("mazePlaceholder"),
  rowsStat: document.getElementById("rowsStat"),
  glowStat: document.getElementById("glowStat"),
  modeStat: document.getElementById("modeStat"),
  ruleStat: document.getElementById("ruleStat"),
  scoreValue: document.getElementById("scoreValue"),
  rateValue: document.getElementById("rateValue"),
  resultStateValue: document.getElementById("resultStateValue"),
  pathValue: document.getElementById("pathValue"),
  captureValue: document.getElementById("captureValue"),
  ruleValue: document.getElementById("ruleValue"),
  complexityValue: document.getElementById("complexityValue"),
  resultSummary: document.getElementById("resultSummary"),
  algorithmSummary: document.getElementById("algorithmSummary"),
  dpTableValue: document.getElementById("dpTableValue"),
  backtrackValue: document.getElementById("backtrackValue")
};

let resizeFrame = null;

init();

function init() {
  bindEvents();
  elements.tieBreakSelect.value = state.tieBreak;
  setStatus(CONFIG.copy.initialStatus, "info");
  render();
}

function bindEvents() {
  elements.generateBtn.addEventListener("click", handleGenerate);
  elements.runBtn.addEventListener("click", handleRun);
  elements.exampleBtn.addEventListener("click", handleLoadExample);
  elements.clearBtn.addEventListener("click", handleClearGlowing);
  elements.resetBtn.addEventListener("click", resetApp);
  elements.tieBreakSelect.addEventListener("change", handleTieBreakChange);

  elements.rowsInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      handleGenerate();
    }
  });

  elements.rowsInput.addEventListener("input", () => {
    setRowsInputValidity(true);
  });

  elements.mazeSvg.addEventListener("click", (event) => {
    const target = findNodeTarget(event.target);
    if (!target) {
      return;
    }

    toggleNode(
      Number(target.dataset.row),
      Number(target.dataset.col),
      target.dataset.nodeKey
    );
  });

  elements.mazeSvg.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" && event.key !== " ") {
      return;
    }

    const target = findNodeTarget(event.target);
    if (!target) {
      return;
    }

    event.preventDefault();

    toggleNode(
      Number(target.dataset.row),
      Number(target.dataset.col),
      target.dataset.nodeKey
    );
  });

  window.addEventListener("resize", () => {
    if (!state.grid.length || resizeFrame) {
      return;
    }

    resizeFrame = window.requestAnimationFrame(() => {
      resizeFrame = null;
      renderTriangle();
    });
  });
}

function handleGenerate() {
  const validation = validateRowsInput(elements.rowsInput.value);

  if (!validation.valid) {
    setRowsInputValidity(false);
    setStatus(validation.message, "error");
    elements.rowsInput.focus();
    return;
  }

  setRowsInputValidity(true);
  state.grid = createGrid(validation.rows);
  state.solution = null;
  state.mode = MODES.EDITING;
  state.pendingFocusKey = null;
  elements.rowsInput.value = String(validation.rows);

  render();
  setStatus(`已生成 ${validation.rows} 行迷阵。`, "success");
}

function handleRun() {
  if (!state.grid.length) {
    setStatus("请先生成迷阵。", "error");
    return;
  }

  state.solution = solveOptimalPath(state.grid, {
    tieBreak: state.tieBreak
  });
  state.mode = MODES.SOLVED;

  render();
  setStatus("已求解。", "success");
}

function handleLoadExample() {
  state.grid = createGrid(CONFIG.example.rows);
  applyGlowingPattern(state.grid, CONFIG.example.glowingColsByRow);
  state.solution = solveOptimalPath(state.grid, {
    tieBreak: state.tieBreak
  });
  state.mode = MODES.SOLVED;
  state.pendingFocusKey = null;
  elements.rowsInput.value = String(CONFIG.example.rows);
  setRowsInputValidity(true);

  render();
  setStatus("示例解已加载。", "success");
}

function handleClearGlowing() {
  if (!state.grid.length) {
    return;
  }

  state.grid.forEach((rowNodes) => {
    rowNodes.forEach((node) => {
      node.glowing = false;
    });
  });

  state.solution = null;
  state.mode = MODES.EDITING;

  render();
  setStatus("已清空发光点。", "info");
}

function handleTieBreakChange() {
  state.tieBreak = elements.tieBreakSelect.value;

  if (!state.grid.length) {
    render();
    setStatus(`当前规则：${TIE_BREAK_LABELS[state.tieBreak]}。`, "info");
    return;
  }

  if (state.mode === MODES.SOLVED) {
    state.solution = solveOptimalPath(state.grid, {
      tieBreak: state.tieBreak
    });
    render();
    setStatus("已按新规则重新求解。", "success");
    return;
  }

  render();
  setStatus(`当前规则：${TIE_BREAK_LABELS[state.tieBreak]}。`, "info");
}

function resetApp() {
  state.grid = [];
  state.solution = null;
  state.mode = MODES.IDLE;
  state.tieBreak = "preferLeft";
  state.pendingFocusKey = null;
  elements.rowsInput.value = "";
  setRowsInputValidity(true);

  render();
  setStatus("已完全重置。", "info");
}

function toggleNode(row, col, nodeKey) {
  const node = state.grid[row - 1][col - 1];
  node.glowing = !node.glowing;
  state.pendingFocusKey = nodeKey;
  state.solution = null;
  state.mode = MODES.EDITING;

  render();
  setStatus(
    `节点 (${row}, ${col}) 已${node.glowing ? "点亮" : "取消点亮"}。`,
    "info"
  );
}

function validateRowsInput(rawValue) {
  const trimmed = String(rawValue).trim();

  if (!trimmed) {
    return {
      valid: false,
      message: `请输入 ${CONFIG.rows.min} 到 ${CONFIG.rows.max} 之间的正整数。`
    };
  }

  if (!/^\d+$/.test(trimmed)) {
    return {
      valid: false,
      message: `行数必须是 ${CONFIG.rows.min} 到 ${CONFIG.rows.max} 之间的正整数。`
    };
  }

  const rows = Number(trimmed);

  if (rows < CONFIG.rows.min || rows > CONFIG.rows.max) {
    return {
      valid: false,
      message: `行数超出范围，请输入 ${CONFIG.rows.min} 到 ${CONFIG.rows.max} 之间的整数。`
    };
  }

  return {
    valid: true,
    rows
  };
}

function applyGlowingPattern(grid, glowingColsByRow) {
  glowingColsByRow.forEach((cols, rowIndex) => {
    cols.forEach((col) => {
      grid[rowIndex][col - 1].glowing = true;
    });
  });
}

function setRowsInputValidity(isValid) {
  if (isValid) {
    elements.rowsInput.removeAttribute("aria-invalid");
    return;
  }

  elements.rowsInput.setAttribute("aria-invalid", "true");
}

function render() {
  renderControls();
  renderSummary();
  renderTriangle();
  renderResult();
}

function renderControls() {
  const glowCount = state.grid.length ? countGlowingNodes(state.grid) : 0;

  elements.runBtn.disabled = !state.grid.length;
  elements.clearBtn.disabled = !state.grid.length || glowCount === 0;
  elements.resetBtn.disabled = state.mode === MODES.IDLE;
  elements.tieBreakSelect.value = state.tieBreak;
}

function renderSummary() {
  const rows = state.grid.length;
  const glowCount = rows ? countGlowingNodes(state.grid) : 0;

  elements.rowsStat.textContent = rows || "--";
  elements.glowStat.textContent = String(glowCount);
  elements.modeStat.textContent = MODE_LABELS[state.mode];
  elements.ruleStat.textContent = state.tieBreak === "preferLeft" ? "左侧优先" : "右侧优先";
}

function renderTriangle() {
  if (!state.grid.length) {
    elements.mazeSvg.style.display = "none";
    elements.mazeScroll.style.display = "none";
    elements.mazePlaceholder.style.display = "grid";
    elements.mazeSvg.innerHTML = "";
    return;
  }

  const viewportWidth = Math.max(
    elements.mazeScroll.clientWidth - 8,
    CONFIG.layout.minViewportWidth
  );
  const layout = computeLayout(state.grid.length, viewportWidth);
  const path = state.solution ? state.solution.path : [];
  const nodeSet = new Set(path.map((node) => toNodeKey(node.row, node.col)));
  const edgeSet = buildPathEdgeSet(path);
  const edgeMarkup = [];
  const nodeMarkup = [];

  state.grid.forEach((rowNodes, rowIndex) => {
    rowNodes.forEach((node) => {
      const currentPoint = layout.coordinates[rowIndex][node.col - 1];

      if (rowIndex < state.grid.length - 1) {
        const leftChildNode = state.grid[rowIndex + 1][node.col - 1];
        const rightChildNode = state.grid[rowIndex + 1][node.col];
        const leftChildPoint = layout.coordinates[rowIndex + 1][node.col - 1];
        const rightChildPoint = layout.coordinates[rowIndex + 1][node.col];

        edgeMarkup.push(
          createEdgeMarkup(
            currentPoint,
            leftChildPoint,
            edgeSet.has(toEdgeKey(node, leftChildNode))
          )
        );
        edgeMarkup.push(
          createEdgeMarkup(
            currentPoint,
            rightChildPoint,
            edgeSet.has(toEdgeKey(node, rightChildNode))
          )
        );
      }

      nodeMarkup.push(
        createNodeMarkup(
          node,
          currentPoint,
          layout.nodeRadius,
          layout.hitRadius,
          nodeSet.has(toNodeKey(node.row, node.col))
        )
      );
    });
  });

  elements.mazeSvg.setAttribute("viewBox", `0 0 ${layout.width} ${layout.height}`);
  elements.mazeSvg.setAttribute("width", String(layout.width));
  elements.mazeSvg.setAttribute("height", String(layout.height));
  elements.mazeSvg.setAttribute("aria-label", `${state.grid.length} 行三角迷阵 SVG 视图`);
  elements.mazeSvg.innerHTML = `
    <g class="maze-edges">${edgeMarkup.join("")}</g>
    <g class="maze-nodes">${nodeMarkup.join("")}</g>
  `;
  elements.mazeSvg.style.display = "block";
  elements.mazeScroll.style.display = "block";
  elements.mazePlaceholder.style.display = "none";

  restoreNodeFocus();
}

function renderResult() {
  elements.ruleValue.textContent = TIE_BREAK_LABELS[state.tieBreak];
  elements.complexityValue.textContent = "O(n^2)";

  if (state.mode === MODES.IDLE) {
    elements.scoreValue.textContent = "--";
    elements.rateValue.textContent = "--";
    elements.resultStateValue.textContent = MODE_LABELS[MODES.IDLE];
    elements.pathValue.textContent = "运行后显示最优路径。";
    elements.captureValue.textContent = "--";
    elements.resultSummary.textContent = CONFIG.copy.idleSummary;
    renderAlgorithmDetails(null);
    return;
  }

  if (state.mode === MODES.EDITING || !state.solution) {
    const glowCount = countGlowingNodes(state.grid);

    elements.scoreValue.textContent = "--";
    elements.rateValue.textContent = "--";
    elements.resultStateValue.textContent = MODE_LABELS[MODES.EDITING];
    elements.pathValue.textContent = "运行后显示最优路径。";
    elements.captureValue.textContent = `-- / ${glowCount}`;
    elements.resultSummary.textContent = glowCount === 0
      ? "当前没有发光点，运行后会返回默认路径。"
      : `当前共有 ${glowCount} 个发光点，运行后计算最优路径。`;
    renderAlgorithmDetails(null);
    return;
  }

  const { capturedGlowing, totalGlowing, captureRate, path } = state.solution;

  elements.scoreValue.textContent = String(state.solution.score);
  elements.rateValue.textContent = formatPercent(captureRate);
  elements.resultStateValue.textContent = MODE_LABELS[MODES.SOLVED];
  elements.pathValue.textContent = formatPath(path);
  elements.captureValue.textContent = `${capturedGlowing} / ${totalGlowing}`;
  elements.resultSummary.textContent = totalGlowing === 0
    ? "当前没有发光点，已返回默认最优路径。"
    : `已捕获 ${capturedGlowing} / ${totalGlowing} 个发光点。`;

  renderAlgorithmDetails(state.solution);
}

function renderAlgorithmDetails(solution) {
  if (!solution) {
    elements.algorithmSummary.textContent = "运行后显示 DP 与回溯说明。";
    elements.dpTableValue.textContent = "运行后显示 DP 表。";
    elements.backtrackValue.textContent = "运行后显示回溯路径。";
    return;
  }

  elements.algorithmSummary.textContent =
    "dp[r][c] 表示从顶部走到当前节点时最多能收集多少个发光点；当父节点同分时，按当前平分规则选边。";
  elements.dpTableValue.textContent = formatDpTable(solution.dp);
  elements.backtrackValue.textContent =
    `先在最后一行选出最优终点，再按 parent 表逐行回溯，最终得到路径：${formatPath(solution.path)}。`;
}

function setStatus(message, type) {
  elements.statusBox.textContent = message;
  elements.statusBox.dataset.state = type;
}

function restoreNodeFocus() {
  if (!state.pendingFocusKey) {
    return;
  }

  const nodeKey = state.pendingFocusKey;
  state.pendingFocusKey = null;

  window.requestAnimationFrame(() => {
    const target = elements.mazeSvg.querySelector(`[data-node-key="${nodeKey}"]`);

    if (target) {
      target.focus({ preventScroll: true });
    }
  });
}

function findNodeTarget(target) {
  if (!target || typeof target.closest !== "function") {
    return null;
  }

  return target.closest("[data-node='true']");
}

function buildPathEdgeSet(path) {
  const edgeSet = new Set();

  for (let index = 0; index < path.length - 1; index += 1) {
    edgeSet.add(toEdgeKey(path[index], path[index + 1]));
  }

  return edgeSet;
}

function computeLayout(rows, viewportWidth) {
  const isSmall = rows >= 22;
  const isMedium = !isSmall && rows >= 15;
  const paddingX = isSmall
    ? CONFIG.layout.paddingXSmall
    : isMedium
      ? CONFIG.layout.paddingXMedium
      : CONFIG.layout.paddingXLarge;
  const paddingY = isSmall
    ? CONFIG.layout.paddingYSmall
    : isMedium
      ? CONFIG.layout.paddingYMedium
      : CONFIG.layout.paddingYLarge;
  const minSpacingX = isSmall
    ? CONFIG.layout.minSpacingXSmall
    : isMedium
      ? CONFIG.layout.minSpacingXMedium
      : CONFIG.layout.minSpacingXLarge;
  const maxSpacingX = isSmall
    ? CONFIG.layout.maxSpacingXSmall
    : isMedium
      ? CONFIG.layout.maxSpacingXMedium
      : CONFIG.layout.maxSpacingXLarge;
  const minSpacingY = isSmall
    ? CONFIG.layout.minSpacingYSmall
    : isMedium
      ? CONFIG.layout.minSpacingYMedium
      : CONFIG.layout.minSpacingYLarge;
  const maxSpacingY = isSmall
    ? CONFIG.layout.maxSpacingYSmall
    : isMedium
      ? CONFIG.layout.maxSpacingYMedium
      : CONFIG.layout.maxSpacingYLarge;
  const baseWidth = rows <= 10
    ? CONFIG.layout.baseWidthSmall
    : rows <= 20
      ? CONFIG.layout.baseWidthMedium
      : CONFIG.layout.baseWidthLarge;
  const minimumWidth = paddingX * 2 + Math.max(rows - 1, 0) * minSpacingX;
  const width = Math.max(baseWidth, viewportWidth, minimumWidth);
  const spacingX = rows === 1
    ? 0
    : clamp(
      (width - paddingX * 2) / (rows - 1),
      minSpacingX,
      maxSpacingX
    );
  const spacingY = rows === 1
    ? 0
    : clamp(spacingX * 0.88, minSpacingY, maxSpacingY);
  const height = Math.max(
    CONFIG.layout.minHeight,
    paddingY * 2 + (rows - 1) * spacingY
  );
  const nodeRadius = isSmall
    ? CONFIG.layout.nodeRadiusSmall
    : isMedium
      ? CONFIG.layout.nodeRadiusMedium
      : CONFIG.layout.nodeRadiusLarge;
  const hitRadius = Math.max(
    nodeRadius + (isSmall ? CONFIG.layout.hitAreaPaddingSmall : CONFIG.layout.hitAreaPaddingLarge),
    isSmall ? CONFIG.layout.minHitRadiusSmall : CONFIG.layout.minHitRadiusLarge
  );
  const centerX = width / 2;
  const coordinates = [];

  for (let row = 1; row <= rows; row += 1) {
    const rowPoints = [];

    for (let col = 1; col <= row; col += 1) {
      rowPoints.push({
        x: round(centerX + (col - (row + 1) / 2) * spacingX),
        y: round(paddingY + (row - 1) * spacingY)
      });
    }

    coordinates.push(rowPoints);
  }

  return {
    width,
    height,
    nodeRadius,
    hitRadius,
    coordinates
  };
}

function createEdgeMarkup(fromPoint, toPoint, isPath) {
  return `
    <line
      class="maze-edge${isPath ? " path-edge" : ""}"
      x1="${fromPoint.x}"
      y1="${fromPoint.y}"
      x2="${toPoint.x}"
      y2="${toPoint.y}"
    ></line>
  `;
}

function createNodeMarkup(node, point, nodeRadius, hitRadius, isPathNode) {
  const classes = ["maze-node"];
  const nodeKey = toNodeKey(node.row, node.col);
  const compact = nodeRadius <= 4.2;
  const markerOffset = round(nodeRadius * (compact ? 0.72 : 0.85));
  const ringRadius = round(nodeRadius + (compact ? 3.8 : 5.6));
  const focusRadius = round(nodeRadius + (compact ? 5.6 : 8.6));

  if (node.glowing) {
    classes.push("is-glow");
  }

  if (isPathNode) {
    classes.push("is-path");
  }

  if (compact) {
    classes.push("is-compact");
  }

  const statusText = isPathNode
    ? node.glowing
      ? "位于最优路径，且当前为发光点"
      : "位于最优路径"
    : node.glowing
      ? "当前为发光点"
      : "当前为普通点";

  return `
    <g
      class="${classes.join(" ")}"
      data-node="true"
      data-node-key="${nodeKey}"
      data-row="${node.row}"
      data-col="${node.col}"
      tabindex="0"
      role="button"
      aria-pressed="${node.glowing ? "true" : "false"}"
      aria-label="节点 (${node.row}, ${node.col})，${statusText}，按 Enter 或空格切换"
      focusable="true"
    >
      <title>节点 (${node.row}, ${node.col})：${statusText}</title>
      <circle class="node-ring" cx="${point.x}" cy="${point.y}" r="${ringRadius}"></circle>
      <circle class="node-focus" cx="${point.x}" cy="${point.y}" r="${focusRadius}"></circle>
      <circle class="node-core" cx="${point.x}" cy="${point.y}" r="${nodeRadius}"></circle>
      <line
        class="node-marker"
        x1="${round(point.x - markerOffset)}"
        y1="${point.y}"
        x2="${round(point.x + markerOffset)}"
        y2="${point.y}"
      ></line>
      <line
        class="node-marker"
        x1="${point.x}"
        y1="${round(point.y - markerOffset)}"
        x2="${point.x}"
        y2="${round(point.y + markerOffset)}"
      ></line>
      <circle class="node-hit" cx="${point.x}" cy="${point.y}" r="${hitRadius}"></circle>
    </g>
  `;
}

function formatPath(path) {
  return path.map((node) => `(${node.row},${node.col})`).join(" → ");
}

function formatPercent(value) {
  const percent = value * 100;
  const rounded = Number.isInteger(percent) ? percent.toFixed(0) : percent.toFixed(1);

  return `${rounded}%`;
}

function formatDpTable(dp) {
  return dp
    .slice(1)
    .map((row, index) => `第${index + 1}行  ${row.slice(1).join("  ")}`)
    .join("\n");
}

function toNodeKey(row, col) {
  return `${row}-${col}`;
}

function toEdgeKey(fromNode, toNode) {
  return `${fromNode.row}-${fromNode.col}|${toNode.row}-${toNode.col}`;
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function round(value) {
  return Number(value.toFixed(2));
}
