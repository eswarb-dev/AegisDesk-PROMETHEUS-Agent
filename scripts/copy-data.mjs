import { cp, mkdir } from "node:fs/promises";
import path from "node:path";

const source = path.resolve("src/data");
const target = path.resolve("dist/src/data");

await mkdir(target, { recursive: true });
await cp(source, target, { recursive: true });
