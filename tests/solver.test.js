const test = require("node:test");
const assert = require("node:assert/strict");

const {
  createGrid,
  solveOptimalPath,
  backtrackPath,
  countGlowingNodes
} = require("../solver.js");

function pathToText(path) {
  return path.map((node) => `(${node.row},${node.col})`).join(" -> ");
}

test("1 行迷阵返回单点路径", () => {
  const grid = createGrid(1);
  grid[0][0].glowing = true;

  const result = solveOptimalPath(grid);

  assert.equal(result.score, 1);
  assert.equal(result.totalGlowing, 1);
  assert.equal(pathToText(result.path), "(1,1)");
});

test("全部普通点时默认选择左侧优先路径", () => {
  const result = solveOptimalPath(createGrid(4));

  assert.equal(result.score, 0);
  assert.equal(result.captureRate, 0);
  assert.equal(pathToText(result.path), "(1,1) -> (2,1) -> (3,1) -> (4,1)");
});

test("全部发光点时得分等于行数", () => {
  const grid = createGrid(4);

  grid.forEach((rowNodes) => {
    rowNodes.forEach((node) => {
      node.glowing = true;
    });
  });

  const result = solveOptimalPath(grid);

  assert.equal(result.score, 4);
  assert.equal(result.totalGlowing, 10);
  assert.equal(result.capturedGlowing, 4);
});

test("平分路径可切换为右侧优先", () => {
  const result = solveOptimalPath(createGrid(4), { tieBreak: "preferRight" });

  assert.equal(pathToText(result.path), "(1,1) -> (2,2) -> (3,3) -> (4,4)");
});

test("示例数据返回预期路径与得分", () => {
  const grid = createGrid(5);
  const glowingColsByRow = [
    [1],
    [1],
    [2, 3],
    [1, 2, 4],
    [2, 3, 4]
  ];

  glowingColsByRow.forEach((cols, rowIndex) => {
    cols.forEach((col) => {
      grid[rowIndex][col - 1].glowing = true;
    });
  });

  const result = solveOptimalPath(grid);

  assert.equal(result.score, 5);
  assert.equal(result.totalGlowing, 10);
  assert.equal(pathToText(result.path), "(1,1) -> (2,1) -> (3,2) -> (4,2) -> (5,2)");
});

test("countGlowingNodes 统计正确", () => {
  const grid = createGrid(3);
  grid[0][0].glowing = true;
  grid[2][1].glowing = true;

  assert.equal(countGlowingNodes(grid), 2);
});

test("backtrackPath 可按 parent 表还原路径", () => {
  const parent = [
    [],
    [null, null],
    [null, 1, 1],
    [null, 1, 1, 2]
  ];

  const path = backtrackPath(parent, 2);

  assert.equal(pathToText(path), "(1,1) -> (2,1) -> (3,2)");
});

test("非法输入会抛出错误", () => {
  assert.throws(() => createGrid(0), /positive integer/);
  assert.throws(() => createGrid(2.5), /positive integer/);
  assert.throws(() => solveOptimalPath([]), /triangular/);
  assert.throws(
    () => solveOptimalPath([[{ row: 1, col: 1, glowing: false }], []]),
    /triangular/
  );
  assert.throws(
    () => solveOptimalPath(createGrid(3), { tieBreak: "unknown" }),
    /Unsupported tieBreak/
  );
});
