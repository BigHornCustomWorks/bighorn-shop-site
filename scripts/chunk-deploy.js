const fs = require("fs");
const files = JSON.parse(fs.readFileSync("scripts/deploy-files.json", "utf8")).filter(
  (f) => f.file !== "package-lock.json" && f.file !== "README.md" && f.file !== ".env.example",
);
const size = 4;
fs.mkdirSync("scripts/chunks", { recursive: true });
let n = 0;
for (let i = 0; i < files.length; i += size) {
  const slice = files.slice(i, i + size).map(({ file, data }) => ({ file, data }));
  fs.writeFileSync(`scripts/chunks/${String(n).padStart(2, "0")}.json`, JSON.stringify(slice, null, 2));
  n += 1;
}
console.log("chunks", n, "files", files.length);
