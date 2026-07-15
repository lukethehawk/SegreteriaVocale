const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const dist = path.join(root, "dist");

function copyRecursive(source, target) {
    const stats = fs.statSync(source);

    if (stats.isDirectory()) {
        fs.mkdirSync(target, { recursive: true });
        for (const entry of fs.readdirSync(source)) {
            copyRecursive(path.join(source, entry), path.join(target, entry));
        }
        return;
    }

    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.copyFileSync(source, target);
}

fs.rmSync(dist, { recursive: true, force: true });
fs.mkdirSync(dist, { recursive: true });

for (const entry of ["index.html", "src", "LICENSE", "README.md"]) {
    const source = path.join(root, entry);
    if (fs.existsSync(source)) {
        copyRecursive(source, path.join(dist, entry));
    }
}

console.log(`Static build written to ${path.relative(root, dist)}`);
