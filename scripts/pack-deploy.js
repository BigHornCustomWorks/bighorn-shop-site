const fs = require("fs");
const path = require("path");
const skip = new Set(["node_modules", ".next", ".git", "data", "scripts", "public"]);
const files = [];

function walk(dir) {
  for (const name of fs.readdirSync(dir)) {
    if (skip.has(name) || name === ".env.local") continue;
    const p = path.join(dir, name);
    const st = fs.statSync(p);
    if (st.isDirectory()) {
      walk(p);
      continue;
    }
    const posix = path.relative(process.cwd(), p).split(path.sep).join("/");
    files.push({
      file: posix,
      data: fs.readFileSync(p, "utf8"),
      encoding: "utf-8",
    });
  }
}
walk(".");
fs.writeFileSync("scripts/deploy-files.json", JSON.stringify(files));
console.log("wrote", files.length, "files", Buffer.byteLength(JSON.stringify(files)));
