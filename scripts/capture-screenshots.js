const fs = require("node:fs");
const path = require("node:path");
const http = require("node:http");
const { spawn } = require("node:child_process");
const crypto = require("node:crypto");

const root = path.resolve(__dirname, "..");
const chromePath = findChromeExecutable();

async function main() {
  const server = await startStaticServer(root);
  const chrome = await startChrome();

  try {
    await captureHome(server.origin, chrome.port);
    await captureDemo(server.origin, chrome.port);

    const homeHash = md5(path.join(root, "assets/screenshot-home.png"));
    const demoHash = md5(path.join(root, "assets/screenshot-demo.png"));

    if (homeHash === demoHash) {
      throw new Error("截图生成失败：首页截图与示例截图完全相同。");
    }

    console.log("Screenshots updated:");
    console.log(" - assets/screenshot-home.png");
    console.log(" - assets/screenshot-demo.png");
  } finally {
    await chrome.close();
    await server.close();
  }
}

async function captureHome(origin, port) {
  const page = await openPage(port, `${origin}/index.html`);

  await page.send("Page.enable");
  await page.send("Runtime.enable");
  await delay(1400);
  await saveScreenshot(page, path.join(root, "assets/screenshot-home.png"));
  page.ws.close();
}

async function captureDemo(origin, port) {
  const page = await openPage(port, `${origin}/index.html`);

  await page.send("Page.enable");
  await page.send("Runtime.enable");
  await delay(1400);
  await click(page, "#exampleBtn");
  await waitForValue(page, 'document.getElementById("resultStateValue").textContent.trim()', "已求解");
  await saveScreenshot(page, path.join(root, "assets/screenshot-demo.png"));
  page.ws.close();
}

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
  const port = 9622 + Math.floor(Math.random() * 200);
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

async function saveScreenshot(page, outputPath) {
  const { data } = await page.send("Page.captureScreenshot", {
    format: "png",
    fromSurface: true
  });

  fs.writeFileSync(outputPath, Buffer.from(data, "base64"));
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

async function waitForValue(page, expression, expectedValue) {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const result = await page.send("Runtime.evaluate", {
      expression,
      returnByValue: true
    });

    if (result.result.value === expectedValue) {
      return;
    }

    await delay(150);
  }

  throw new Error(`Timed out waiting for value: ${expectedValue}`);
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

function md5(filePath) {
  return crypto.createHash("md5").update(fs.readFileSync(filePath)).digest("hex");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
