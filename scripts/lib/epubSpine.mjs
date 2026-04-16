import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

export function unzipEpubToTemp(epubPath) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "hog-epub-"));
  execFileSync("unzip", ["-q", "-o", epubPath, "-d", dir], { stdio: "inherit" });
  return dir;
}

export function resolvePackageOpf(unzipRoot) {
  const containerPath = path.join(unzipRoot, "META-INF", "container.xml");
  if (fs.existsSync(containerPath)) {
    const xml = fs.readFileSync(containerPath, "utf8");
    const match = xml.match(/full-path="([^"]+)"/);
    if (match) {
      return path.join(unzipRoot, match[1].replace(/^\//, ""));
    }
  }
  const fallback = path.join(unzipRoot, "content.opf");
  if (fs.existsSync(fallback)) {
    return fallback;
  }
  throw new Error(`Could not find OPF package under ${unzipRoot}`);
}

export function readSpineHtmlConcat(opfPath) {
  const opf = fs.readFileSync(opfPath, "utf8");
  const opfDir = path.dirname(opfPath);
  const manifest = new Map();

  const itemTagRe = /<item\b[^>]+>/gi;
  let tagMatch;
  while ((tagMatch = itemTagRe.exec(opf)) !== null) {
    const tag = tagMatch[0];
    const idMatch = /\bid="([^"]+)"/i.exec(tag);
    const hrefMatch = /\bhref="([^"]+)"/i.exec(tag);
    if (idMatch && hrefMatch) {
      manifest.set(idMatch[1], hrefMatch[1]);
    }
  }

  const spineIds = [];
  const spineRe = /<itemref[^>]*\bidref="([^"]+)"/gi;
  let spineMatch;
  while ((spineMatch = spineRe.exec(opf)) !== null) {
    spineIds.push(spineMatch[1]);
  }

  const chunks = [];
  for (const id of spineIds) {
    const href = manifest.get(id);
    if (!href) {
      continue;
    }
    if (!/\.(x?html?|xml)$/i.test(href)) {
      continue;
    }
    const filePath = path.join(opfDir, href);
    if (!fs.existsSync(filePath)) {
      continue;
    }
    chunks.push(fs.readFileSync(filePath, "utf8"));
  }

  return chunks.join("\n");
}

export function readEpubAsHtmlConcat(epubPath) {
  const dir = unzipEpubToTemp(epubPath);
  try {
    const opfPath = resolvePackageOpf(dir);
    return readSpineHtmlConcat(opfPath);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}
