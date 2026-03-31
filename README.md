# triangle-light-maze-solver

一个纯静态、可离线运行的三角迷阵动态规划路径求解可视化工具。你可以生成三角点阵、手动标记发光点，并查看经过最多发光点的最优路径。

## 截图

| 首页 | 示例结果 |
| --- | --- |
| ![首页截图](assets/screenshot-home.png) | ![示例结果截图](assets/screenshot-demo.png) |

## 核心功能

- 原生 HTML / CSS / JavaScript，无依赖、无构建流程
- 双击 `index.html` 直接运行，支持离线使用
- 1 到 30 行三角迷阵生成与编辑
- 点击节点切换发光状态，支持鼠标与键盘操作
- 动态规划求解最优路径并高亮结果
- 支持 tie-break 规则切换：左侧优先 / 右侧优先
- 展示最优得分、最优路径、捕获率、捕获数与时间复杂度
- 内置示例、清空发光点、完全重置
- 可展开查看算法详情、DP 表与回溯说明

## 算法原理

项目使用“动态规划 + 回溯”求解。

- `dp[r][c]`：从顶部走到节点 `(r, c)` 时最多能捕获多少个发光点
- `parent[r][c]`：当前最优状态来自上一行的哪一列
- 先用 DP 计算最后一行的最优终点，再通过 `parent` 反向回溯完整路径

### Tie-break 规则

当两条候选路径同分时：

- `preferLeft`：优先选择左侧父节点或更靠左的终点
- `preferRight`：优先选择右侧父节点或更靠右的终点

### 复杂度

- 时间复杂度：`O(n^2)`
- 空间复杂度：`O(n^2)`

## 使用说明

1. 输入迷阵行数，点击“生成迷阵”
2. 点击节点设置发光点
3. 选择平分规则
4. 点击“运行求解”查看最优路径
5. 如需快速体验，可直接点击“查看示例解”

辅助操作：

- “清空发光点”只清空节点状态，保留当前迷阵结构
- “完全重置”清空迷阵、结果和输入

## 本地运行

下载整个文件夹后，直接双击 `index.html` 即可使用。

如果需要用本地静态服务器预览，也可以执行：

```bash
python3 -m http.server 8000
```

然后访问 `http://localhost:8000`。

## 测试方式

算法单元测试：

```bash
node --test tests/solver.test.js
```

轻量 smoke test：

```bash
node scripts/smoke-test.js
```

如果需要检查截图与 README 等发布资源是否一致：

```bash
node scripts/check-release.js
```

## 项目结构

```text
triangle-light-maze-solver/
├── assets/
│   ├── favicon.svg
│   ├── screenshot-home.png
│   └── screenshot-demo.png
├── index.html
├── styles.css
├── solver.js
├── app.js
├── scripts/
│   ├── capture-screenshots.js
│   ├── check-release.js
│   └── smoke-test.js
├── tests/
│   └── solver.test.js
├── README.md
└── LICENSE
```

## License

本项目使用 MIT License，详见 [LICENSE](LICENSE)。
