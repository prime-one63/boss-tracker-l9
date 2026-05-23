const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const isDev = process.argv.includes("--dev");

const files = [
  { src: "js/firebase.js", dest: "js/firebase.min.js" },
  { src: "js/bosslist.js", dest: "js/bosslist.min.js" },
  { src: "js/dashboard.js", dest: "js/dashboard.min.js" },
];

for (const { src, dest } of files) {
  console.log(`Minifying ${src} -> ${dest}`);

  // Read source
  let code = fs.readFileSync(src, "utf8");

  if (isDev) {
    // Dev: just copy (no minification) for faster iteration
    fs.writeFileSync(dest, code, "utf8");
    console.log(`  (dev mode - copied unminified)`);
    continue;
  }

  try {
    const result = execSync(
      `npx terser "${src}" --compress --mangle --output "${dest}" --module`,
      { encoding: "utf8", cwd: __dirname }
    );
    console.log(`  OK`);
  } catch (err) {
    console.error(`  Error: ${err.message}`);
    process.exit(1);
  }
}

// Update import path in minified dashboard.js to point to minified bosslist.js
let dashboardMin = fs.readFileSync("js/dashboard.min.js", "utf8");
dashboardMin = dashboardMin.replace("./bosslist.js", "./bosslist.min.js");
fs.writeFileSync("js/dashboard.min.js", dashboardMin, "utf8");
console.log("Updated import path in dashboard.min.js -> bosslist.min.js");

// Update HTML to load minified files
const htmlPath = "index.html";
let html = fs.readFileSync(htmlPath, "utf8");
const alreadyMinified = html.includes("dashboard.min.js");

if (!alreadyMinified || isDev) {
  html = html.replace("js/dashboard.js", "js/dashboard.min.js");
  fs.writeFileSync(htmlPath, html, "utf8");
  console.log("Updated index.html to load dashboard.min.js");
}

console.log("Build complete.");
