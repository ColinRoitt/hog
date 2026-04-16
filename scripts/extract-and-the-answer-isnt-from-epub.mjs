#!/usr/bin/env node
/**
 * Extract "And The Answer Isn't" question/answer pairs from the House of Games
 * EPUB (Calibre HTML: numbered blockquotes + following "Answer:" paragraph).
 *
 * Usage:
 *   node scripts/extract-and-the-answer-isnt-from-epub.mjs [path/to/book.epub]
 *   node scripts/extract-and-the-answer-isnt-from-epub.mjs --dry-run [path/to/book.epub]
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
const DEFAULT_QUESTIONS = path.join(REPO_ROOT, "server/src/questions/questions.json");

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

function parseOneBlockquoteAnswerPair(sliceFromBlockquote) {
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

  let question = tidyQuestion(stripTags(questionHtml));
  let answer = stripTags(paragraphInner).replace(/^[\s\S]*?Answer:\s*/i, "").trim();

  question = normalizeApostrophes(question);
  answer = normalizeApostrophes(answer);

  if (!/^\d+\./.test(question)) {
    return null;
  }

  const num = Number(question.match(/^(\d+)\./)?.[1]);
  question = question.replace(/^\d+\.\s*/, "").trim();

  if (!Number.isFinite(num) || question.length < 5 || answer.length < 1) {
    return null;
  }

  return {
    pair: { question, answer },
    consumed: blockMatch[0].length,
    questionNumber: num,
  };
}

function extractFourQuestionsAfterTitle(html, titleIndex) {
  const tail = html.slice(titleIndex);
  if (/QUOTATIONS VERSION/i.test(tail.slice(0, 5000))) {
    return [];
  }

  const startSearch = tail.search(
    /<blockquote class="calibre_17"[^>]*>\s*<span class="calibre_1">\s*1\.\s*/i,
  );
  if (startSearch === -1) {
    return [];
  }

  let cursor = startSearch;
  const pairs = [];

  while (pairs.length < 4 && cursor < tail.length) {
    const slice = tail.slice(cursor);
    const parsed = parseOneBlockquoteAnswerPair(slice);
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

function extractFromConcatenatedBook(html) {
  const normalized = normalizeApostrophes(html);
  const titleRe = /<span class="calibre_12">(AND THE ANSWER ISN'T\s*#\s*\d+)[^<]*<\/span>/gi;
  const allPairs = [];
  let titleMatch;

  while ((titleMatch = titleRe.exec(normalized)) !== null) {
    allPairs.push(...extractFourQuestionsAfterTitle(normalized, titleMatch.index));
  }

  return allPairs;
}

function extractFromEpub(epubPath) {
  const concatenated = readEpubAsHtmlConcat(epubPath);
  return extractFromConcatenatedBook(concatenated);
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
  console.error(`Extracted ${extracted.length} Q&A pairs from ${path.basename(epubPath)}`);

  if (dryRun) {
    process.stdout.write(`${JSON.stringify(extracted, null, 2)}\n`);
    return;
  }

  const existing = JSON.parse(fs.readFileSync(DEFAULT_QUESTIONS, "utf8"));
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

  fs.writeFileSync(DEFAULT_QUESTIONS, `${JSON.stringify(existing, null, 2)}\n`);
  console.error(`Merged into ${DEFAULT_QUESTIONS}: added ${added}, total ${existing.length}`);
}

main();
