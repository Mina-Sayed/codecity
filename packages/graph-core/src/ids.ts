import { createHash } from "node:crypto";

function digest(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex").slice(0, 20);
}

export function normalizeGraphPath(value: string): string {
  const slashNormalized = value.replaceAll("\\", "/");
  const output: string[] = [];

  for (const part of slashNormalized.split("/")) {
    if (part === "" || part === ".") continue;
    if (part === "..") {
      if (output.length > 0 && output.at(-1) !== "..") {
        output.pop();
      } else {
        output.push(part);
      }
      continue;
    }
    output.push(part);
  }

  return output.join("/");
}

export function makeNodeId(kind: string, relativePath: string, symbol = ""): string {
  const path = normalizeGraphPath(relativePath);
  return `${kind}:${digest(`${kind}\0${path}\0${symbol}`)}`;
}

export function makeEdgeId(kind: string, source: string, target: string): string {
  return `${kind}:${digest(`${kind}\0${source}\0${target}`)}`;
}

export function makeFindingId(ruleId: string, nodeIds: readonly string[]): string {
  const canonicalNodes = [...nodeIds].sort().join("\0");
  return `finding:${digest(`${ruleId}\0${canonicalNodes}`)}`;
}
