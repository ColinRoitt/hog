#!/usr/bin/env node
/**
 * Extract "I'm Terrible at Dating" (year / date guess) questions from the House of Games EPUB.
 * Answers are stored as signed numbers (BC = negative astronomical year).
 *
 * Usage:
 *   node scripts/extract-im-terrible-at-dating-from-epub.mjs [path/to/book.epub]
 *   node scripts/extract-im-terrible-at-dating-from-epub.mjs --dry-run [path/to/book.epub]
 *
 * Default EPUB: first *.epub in the repository root.
 * Requires: unzip(1) on PATH.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { readEpubAsHtmlConcat } from "./lib/epubSpine.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.join(__dirname, "..");
const OUTPUT_JSON = path.join(REPO_ROOT, "server/src/questions/imTerribleAtDatingQuestions.json");

function findDefaultEpub() {
  const entries = fs.readdirSync(REPO_ROOT).filter((name) => name.toLowerCase().endsWith(".epub"));
  if (!entries.length) {
    throw new Error(`No .epub in ${REPO_ROOT}. Pass the path to the EPUB as the first argument.`);
  }
  if (entries.length > 1) {
    console.warn(`Multiple EPUBs found; using ${entries[0]}`);
  }
  return path.join(REPO_ROOT, entries[0]);
}

function stripTags(html) {
  return html
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<\/p>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCharCode(Number.parseInt(hex, 16)))
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeApostrophes(text) {
  return text.replace(/\u2019/g, "'").replace(/\u2018/g, "'");
}

function tidyQuestion(text) {
  return text.replace(/\s+([?.!,])/g, "$1").replace(/\s{2,}/g, " ").trim();
}

function parseYearAnswerFromParagraphInner(paragraphInnerHtml) {
  let text = stripTags(paragraphInnerHtml).replace(/^[\s\S]*?Answer:\s*/i, "").trim();
  text = normalizeApostrophes(text);

  const paren = text.indexOf("(");
  if (paren !== -1) {
    const before = text.slice(0, paren).trim();
    if (/^[\d,.\s-]+/.test(before) || /\d/.test(before)) {
      text = before;
    }
  }

  const isBC = /\bBC\b/i.test(text) || /\bBCE\b/i.test(text);
  const normalizedDigits = text.replace(/,/g, "");
  const numMatch = normalizedDigits.match(/-?[\d.]+/);
  if (!numMatch) {
    return null;
  }

  let value = Number(numMatch[0]);
  if (!Number.isFinite(value)) {
    return null;
  }

  if (isBC && value > 0) {
    value = -value;
  }

  return value;
}

function parseOneBlockquoteYearPair(sliceFromBlockquote) {
  const blockMatch = /^<blockquote class="calibre_17"[^>]*>([\s\S]*?)<\/blockquote>\s*<p class="calibre_"[^>]*>([\s\S]*?)<\/p>/i.exec(
    sliceFromBlockquote,
  );
  if (!blockMatch) {
    return null;
  }

  const [, questionHtml, paragraphInner] = blockMatch;
  if (!/Answer:/i.test(paragraphInner)) {
    return null;
  }

  const questionWithoutNotes = questionHtml.replace(/<sup[\s\S]*?<\/sup>/gi, "").replace(/<small[\s\S]*?<\/small>/gi, "");
  let question = tidyQuestion(stripTags(questionWithoutNotes));
  question = normalizeApostrophes(question).replace(/\s*fn\d+\s*$/i, "").trim();

  if (!/^\d+\./.test(question)) {
    return null;
  }

  const num = Number(question.match(/^(\d+)\./)?.[1]);
  question = question.replace(/^\d+\.\s*/, "").trim();

  const answer = parseYearAnswerFromParagraphInner(paragraphInner);
  if (!Number.isFinite(num) || answer === null || question.length < 3) {
    return null;
  }

  return {
    pair: { question, answer },
    consumed: blockMatch[0].length,
    questionNumber: num,
  };
}

function extractDatingSection(html) {
  const normalized = normalizeApostrophes(html);
  const titleRe = /<span class="calibre_12">I[\u2019']M TERRIBLE AT DATING<\/span>/i;
  const titleMatch = titleRe.exec(normalized);
  if (!titleMatch) {
    return [];
  }

  const tail = normalized.slice(titleMatch.index);
  const startSearch = tail.search(
    /<blockquote class="calibre_17"[^>]*>\s*<span class="calibre_1">\s*1\.\s*/i,
  );
  if (startSearch === -1) {
    return [];
  }

  let cursor = startSearch;
  const pairs = [];

  while (cursor < tail.length) {
    const slice = tail.slice(cursor);
    const parsed = parseOneBlockquoteYearPair(slice);
    if (!parsed) {
      break;
    }

    if (parsed.questionNumber !== pairs.length + 1) {
      break;
    }

    pairs.push(parsed.pair);
    cursor += parsed.consumed;
  }

  return pairs;
}

function extractFromEpub(epubPath) {
  return extractDatingSection(readEpubAsHtmlConcat(epubPath));
}

function dedupeKey(entry) {
  return entry.question.toLowerCase().replace(/\s+/g, " ").trim();
}

function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const paths = args.filter((a) => a !== "--dry-run");
  const epubPath = path.resolve(paths[0] || findDefaultEpub());

  if (!fs.existsSync(epubPath)) {
    console.error(`EPUB not found: ${epubPath}`);
    process.exit(1);
  }

  const extracted = extractFromEpub(epubPath);
  console.error(`Extracted ${extracted.length} dating questions from ${path.basename(epubPath)}`);

  if (dryRun) {
    process.stdout.write(`${JSON.stringify(extracted, null, 2)}\n`);
    return;
  }

  let existing = [];
  if (fs.existsSync(OUTPUT_JSON)) {
    existing = JSON.parse(fs.readFileSync(OUTPUT_JSON, "utf8"));
  }

  const seen = new Set(existing.map(dedupeKey));
  let added = 0;
  for (const entry of extracted) {
    const key = dedupeKey(entry);
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    existing.push(entry);
    added += 1;
  }

  fs.writeFileSync(OUTPUT_JSON, `${JSON.stringify(existing, null, 2)}\n`);
  console.error(`Merged into ${OUTPUT_JSON}: added ${added}, total ${existing.length}`);
}

main();
