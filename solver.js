(function attachTriangleMazeSolver(root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
    return;
  }

  root.TriangleMazeSolver = factory();
}(typeof globalThis !== "undefined" ? globalThis : this, function createSolverModule() {
  const TIE_BREAK = {
    LEFT: "preferLeft",
    RIGHT: "preferRight"
  };

  function createGrid(rows) {
    assertPositiveInteger(rows, "rows");

    return Array.from({ length: rows }, (_, rowIndex) => {
      const row = rowIndex + 1;

      return Array.from({ length: row }, (_, colIndex) => ({
        row,
        col: colIndex + 1,
        glowing: false
      }));
    });
  }

  function countGlowingNodes(grid) {
    validateGrid(grid);

    let count = 0;

    for (const rowNodes of grid) {
      for (const node of rowNodes) {
        if (Boolean(node.glowing)) {
          count += 1;
        }
      }
    }

    return count;
  }

  function solveOptimalPath(grid, options = {}) {
    validateGrid(grid);

    const tieBreak = normalizeTieBreak(options.tieBreak);
    const rows = grid.length;
    const value = Array.from({ length: rows + 1 }, () => []);
    const dp = Array.from({ length: rows + 1 }, () => []);
    const parent = Array.from({ length: rows + 1 }, () => []);

    for (let row = 1; row <= rows; row += 1) {
      for (let col = 1; col <= row; col += 1) {
        value[row][col] = grid[row - 1][col - 1].glowing ? 1 : 0;
      }
    }

    dp[1][1] = value[1][1];
    parent[1][1] = null;

    for (let row = 2; row <= rows; row += 1) {
      for (let col = 1; col <= row; col += 1) {
        if (col === 1) {
          dp[row][col] = dp[row - 1][col] + value[row][col];
          parent[row][col] = col;
          continue;
        }

        if (col === row) {
          dp[row][col] = dp[row - 1][col - 1] + value[row][col];
          parent[row][col] = col - 1;
          continue;
        }

        const leftScore = dp[row - 1][col - 1];
        const rightScore = dp[row - 1][col];
        const chooseLeft = leftScore > rightScore
          || (leftScore === rightScore && tieBreak === TIE_BREAK.LEFT);

        if (chooseLeft) {
          dp[row][col] = leftScore + value[row][col];
          parent[row][col] = col - 1;
        } else {
          dp[row][col] = rightScore + value[row][col];
          parent[row][col] = col;
        }
      }
    }

    let endCol = 1;
    let bestScore = dp[rows][1];

    for (let col = 2; col <= rows; col += 1) {
      const score = dp[rows][col];
      const chooseCurrent = score > bestScore
        || (score === bestScore && tieBreak === TIE_BREAK.RIGHT);

      if (chooseCurrent) {
        bestScore = score;
        endCol = col;
      }
    }

    const path = backtrackPath(parent, endCol);
    const totalGlowing = countGlowingNodes(grid);
    const capturedGlowing = bestScore;
    const captureRate = totalGlowing === 0 ? 0 : capturedGlowing / totalGlowing;

    return {
      rows,
      tieBreak,
      score: bestScore,
      endCol,
      path,
      dp,
      parent,
      value,
      totalGlowing,
      capturedGlowing,
      captureRate
    };
  }

  function backtrackPath(parent, endCol) {
    if (!Array.isArray(parent) || parent.length < 2) {
      throw new TypeError("parent must be a 1-indexed triangular table.");
    }

    assertPositiveInteger(endCol, "endCol");

    const path = [];
    const rows = parent.length - 1;
    let currentCol = endCol;

    for (let row = rows; row >= 1; row -= 1) {
      if (!Number.isInteger(currentCol) || currentCol < 1 || currentCol > row) {
        throw new TypeError("parent table does not contain a valid backtracking path.");
      }

      path.push({ row, col: currentCol });
      currentCol = parent[row][currentCol];
    }

    return path.reverse();
  }

  function normalizeTieBreak(value) {
    if (value === undefined) {
      return TIE_BREAK.LEFT;
    }

    if (value !== TIE_BREAK.LEFT && value !== TIE_BREAK.RIGHT) {
      throw new TypeError(`Unsupported tieBreak rule: ${value}`);
    }

    return value;
  }

  function validateGrid(grid) {
    if (!Array.isArray(grid) || grid.length === 0) {
      throw new TypeError("grid must be a non-empty triangular array.");
    }

    grid.forEach((rowNodes, rowIndex) => {
      if (!Array.isArray(rowNodes) || rowNodes.length !== rowIndex + 1) {
        throw new TypeError("grid must be triangular: row n must contain n nodes.");
      }

      rowNodes.forEach((node) => {
        if (!node || typeof node !== "object") {
          throw new TypeError("grid nodes must be objects.");
        }
      });
    });
  }

  function assertPositiveInteger(value, name) {
    if (!Number.isInteger(value) || value < 1) {
      throw new TypeError(`${name} must be a positive integer.`);
    }
  }

  return {
    createGrid,
    solveOptimalPath,
    backtrackPath,
    countGlowingNodes
  };
}));
