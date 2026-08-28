const fs = require("fs");
const path = require("path");
const skip = new Set(["node_modules", ".next", ".git", "data", "scripts"]);
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
    const ext = path.extname(name).toLowerCase();
    const binary = [".png", ".jpg", ".jpeg", ".webp"].includes(ext);
    if (binary && st.size > 400000) continue;
    if (st.size > 1500000) continue;
    files.push({ file: posix, encoding: binary ? "base64" : "utf-8", bytes: st.size });
  }
}
walk(".");
console.log(files.map((f) => `${f.encoding} ${f.bytes} ${f.file}`).join("\n"));
console.log("COUNT", files.length, "TOTAL", files.reduce((n, f) => n + f.bytes, 0));
