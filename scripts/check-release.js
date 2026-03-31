const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");

const root = path.resolve(__dirname, "..");
const requiredFiles = [
  "index.html",
  "styles.css",
  "app.js",
  "solver.js",
  "README.md",
  "LICENSE",
  "assets/screenshot-home.png",
  "assets/screenshot-demo.png",
  "assets/favicon.svg",
  "tests/solver.test.js"
];

let failed = false;

for (const relativePath of requiredFiles) {
  const absolutePath = path.join(root, relativePath);

  if (!fs.existsSync(absolutePath)) {
    console.error(`Missing file: ${relativePath}`);
    failed = true;
  }
}

const readme = fs.readFileSync(path.join(root, "README.md"), "utf8");
const indexHtml = fs.readFileSync(path.join(root, "index.html"), "utf8");

for (const imagePath of ["assets/screenshot-home.png", "assets/screenshot-demo.png"]) {
  if (!readme.includes(`](${imagePath})`)) {
    console.error(`README does not reference ${imagePath}`);
    failed = true;
  }
}

for (const snippet of [
  'rel="icon"',
  'meta name="theme-color"',
  'property="og:title"',
  'property="og:description"'
]) {
  if (!indexHtml.includes(snippet)) {
    console.error(`index.html is missing ${snippet}`);
    failed = true;
  }
}

const homeBuffer = fs.readFileSync(path.join(root, "assets/screenshot-home.png"));
const demoBuffer = fs.readFileSync(path.join(root, "assets/screenshot-demo.png"));
const homeHash = crypto.createHash("md5").update(homeBuffer).digest("hex");
const demoHash = crypto.createHash("md5").update(demoBuffer).digest("hex");

if (homeHash === demoHash) {
  console.error("Screenshots are identical. screenshot-home.png and screenshot-demo.png should differ.");
  failed = true;
}

if (homeBuffer.length < 10_000 || demoBuffer.length < 10_000) {
  console.error("Screenshot files look suspiciously small.");
  failed = true;
}

if (!readme.includes("node --test tests/solver.test.js") || !readme.includes("node scripts/smoke-test.js")) {
  console.error("README should document solver tests and smoke tests.");
  failed = true;
}

if (!failed) {
  console.log("Release check passed.");
}

process.exitCode = failed ? 1 : 0;
