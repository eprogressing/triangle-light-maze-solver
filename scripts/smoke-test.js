const fs = require("node:fs");
const path = require("node:path");
const http = require("node:http");
const { spawn } = require("node:child_process");
const test = require("node:test");
const assert = require("node:assert/strict");

const root = path.resolve(__dirname, "..");
const chromePath = findChromeExecutable();

test("UI smoke test", async () => {
  const server = await startStaticServer(root);
  const chrome = await startChrome();

  try {
    const page = await openPage(chrome.port, `${server.origin}/index.html`);

    await page.send("Page.enable");
    await page.send("Runtime.enable");
    await delay(1200);

    await setValue(page, "#rowsInput", "4");
    await click(page, "#generateBtn");
    await delay(300);

    const nodeCount = await evaluateValue(page, 'document.querySelectorAll("[data-node=\\"true\\"]").length');
    assert.equal(nodeCount, 10);

    await clickSvgNode(page, "3-2");
    await delay(150);

    const glowCount = await evaluateValue(page, 'document.getElementById("glowStat").textContent.trim()');
    assert.equal(glowCount, "1");

    await click(page, "#runBtn");
    await delay(300);

    const solvedState = await evaluateValue(page, 'document.getElementById("resultStateValue").textContent.trim()');
    const solvedPath = await evaluateValue(page, 'document.getElementById("pathValue").textContent.trim()');

    assert.equal(solvedState, "已求解");
    assert.match(solvedPath, /^\(1,1\) →/);

    await click(page, "#clearBtn");
    await delay(200);
    await setSelect(page, "#tieBreakSelect", "preferLeft");
    await click(page, "#runBtn");
    await delay(250);
    const leftPath = await evaluateValue(page, 'document.getElementById("pathValue").textContent.trim()');

    await setSelect(page, "#tieBreakSelect", "preferRight");
    await delay(250);
    const rightPath = await evaluateValue(page, 'document.getElementById("pathValue").textContent.trim()');

    assert.notEqual(leftPath, rightPath);
    assert.match(leftPath, /\(4,1\)$/);
    assert.match(rightPath, /\(4,4\)$/);

    page.ws.close();
  } finally {
    await chrome.close();
    await server.close();
  }
});

function findChromeExecutable() {
  const candidates = [
    process.env.CHROME_PATH,
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Chromium.app/Contents/MacOS/Chromium"
  ].filter(Boolean);

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  throw new Error("Chrome executable not found. Set CHROME_PATH if needed.");
}

function startStaticServer(baseDir) {
  const server = http.createServer((request, response) => {
    const url = new URL(request.url, "http://127.0.0.1");
    let relativePath = decodeURIComponent(url.pathname);

    if (relativePath === "/") {
      relativePath = "/index.html";
    }

    const filePath = path.join(baseDir, relativePath);

    if (!filePath.startsWith(baseDir) || !fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
      response.statusCode = 404;
      response.end("Not Found");
      return;
    }

    response.setHeader("Content-Type", getContentType(filePath));
    fs.createReadStream(filePath).pipe(response);
  });

  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      resolve({
        origin: `http://127.0.0.1:${address.port}`,
        close: () => new Promise((done, fail) => server.close((error) => error ? fail(error) : done()))
      });
    });
  });
}

function startChrome() {
  const port = 9222 + Math.floor(Math.random() * 400);
  const child = spawn(chromePath, [
    "--headless=new",
    "--disable-gpu",
    "--no-sandbox",
    "--window-size=1440,1180",
    `--remote-debugging-port=${port}`,
    "about:blank"
  ], {
    stdio: "ignore"
  });

  return waitForChrome(port).then(() => ({
    port,
    close: () => {
      child.kill("SIGTERM");
      return Promise.resolve();
    }
  }));
}

async function waitForChrome(port) {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/json/version`);

      if (response.ok) {
        return;
      }
    } catch (error) {
      // Retry.
    }

    await delay(150);
  }

  throw new Error("Chrome remote debugging endpoint did not start.");
}

async function openPage(port, url) {
  const response = await fetch(`http://127.0.0.1:${port}/json/new?${encodeURIComponent(url)}`, {
    method: "PUT"
  });

  if (!response.ok) {
    throw new Error(`Failed to open page: ${response.status}`);
  }

  const target = await response.json();
  return attachToTarget(target.webSocketDebuggerUrl);
}

async function attachToTarget(wsUrl) {
  const ws = new WebSocket(wsUrl);
  const pending = new Map();
  let id = 0;

  ws.addEventListener("message", (event) => {
    const message = JSON.parse(event.data);

    if (!message.id) {
      return;
    }

    const handler = pending.get(message.id);

    if (!handler) {
      return;
    }

    pending.delete(message.id);

    if (message.error) {
      handler.reject(new Error(message.error.message));
      return;
    }

    handler.resolve(message.result || {});
  });

  await new Promise((resolve, reject) => {
    ws.addEventListener("open", resolve, { once: true });
    ws.addEventListener("error", reject, { once: true });
  });

  return {
    ws,
    send(method, params = {}) {
      return new Promise((resolve, reject) => {
        const messageId = ++id;
        pending.set(messageId, { resolve, reject });
        ws.send(JSON.stringify({ id: messageId, method, params }));
      });
    }
  };
}

function evaluateValue(page, expression) {
  return page.send("Runtime.evaluate", {
    expression,
    returnByValue: true
  }).then((result) => result.result.value);
}

function click(page, selector) {
  return page.send("Runtime.evaluate", {
    expression: `
      (() => {
        const node = document.querySelector(${JSON.stringify(selector)});
        if (!node) {
          throw new Error("Missing selector: ${selector}");
        }
        const rect = node.getBoundingClientRect();
        return [rect.left + rect.width / 2, rect.top + rect.height / 2];
      })()
    `,
    returnByValue: true
  }).then(({ result }) => {
    const point = result.value;
    if (!Array.isArray(point) || point.length !== 2) {
      throw new Error(`Unable to resolve selector click point: ${selector}`);
    }
    return page.send("Input.dispatchMouseEvent", {
      type: "mousePressed",
      x: point[0],
      y: point[1],
      button: "left",
      clickCount: 1
    }).then(() => page.send("Input.dispatchMouseEvent", {
      type: "mouseReleased",
      x: point[0],
      y: point[1],
      button: "left",
      clickCount: 1
    }));
  });
}

function clickSvgNode(page, nodeKey) {
  return page.send("Runtime.evaluate", {
    expression: `
      (() => {
        const circle = document.querySelector(${JSON.stringify(`[data-node-key="${nodeKey}"] .node-core`)});
        const svg = document.getElementById("mazeSvg");
        if (!circle || !svg) {
          throw new Error("Missing SVG node: ${nodeKey}");
        }
        const rect = svg.getBoundingClientRect();
        const viewBox = svg.viewBox.baseVal;
        const cx = Number(circle.getAttribute("cx"));
        const cy = Number(circle.getAttribute("cy"));
        return [
          rect.left + (cx / viewBox.width) * rect.width,
          rect.top + (cy / viewBox.height) * rect.height
        ];
      })()
    `,
    returnByValue: true
  }).then(({ result }) => {
    const point = result.value;
    if (!Array.isArray(point) || point.length !== 2) {
      throw new Error(`Unable to resolve SVG node click point: ${nodeKey}`);
    }
    return page.send("Input.dispatchMouseEvent", {
      type: "mousePressed",
      x: point[0],
      y: point[1],
      button: "left",
      clickCount: 1
    }).then(() => page.send("Input.dispatchMouseEvent", {
      type: "mouseReleased",
      x: point[0],
      y: point[1],
      button: "left",
      clickCount: 1
    }));
  });
}

function setValue(page, selector, value) {
  return page.send("Runtime.evaluate", {
    expression: `
      (() => {
        const input = document.querySelector(${JSON.stringify(selector)});
        if (!input) {
          throw new Error("Missing selector: ${selector}");
        }
        input.value = ${JSON.stringify(value)};
        input.dispatchEvent(new Event("input", { bubbles: true }));
        input.dispatchEvent(new Event("change", { bubbles: true }));
      })()
    `
  });
}

function setSelect(page, selector, value) {
  return page.send("Runtime.evaluate", {
    expression: `
      (() => {
        const select = document.querySelector(${JSON.stringify(selector)});
        if (!select) {
          throw new Error("Missing selector: ${selector}");
        }
        select.value = ${JSON.stringify(value)};
        select.dispatchEvent(new Event("change", { bubbles: true }));
      })()
    `
  });
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getContentType(filePath) {
  const ext = path.extname(filePath);
  const map = {
    ".html": "text/html; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".png": "image/png",
    ".svg": "image/svg+xml"
  };

  return map[ext] || "application/octet-stream";
}
