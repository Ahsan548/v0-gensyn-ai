// app/api/chat/route.js  (App Router, ESM)
import fs from "fs";
import path from "path";
import { NextResponse } from "next/server";

const DATA_PATH = path.join(process.cwd(), "gensyn_data.json");
const FALLBACK_SOURCE_URL = "/docs/01_gensyn_overview.md.txt";

let cachedDocs = null;
function loadData() {
  if (cachedDocs) return cachedDocs;
  const raw = fs.readFileSync(DATA_PATH, "utf8");
  const obj = JSON.parse(raw);
  cachedDocs = Object.entries(obj).map(([name, text]) => ({
    title: name,
    text: String(text || ""),
    url: "/docs/" + encodeURIComponent(name),
  }));
  return cachedDocs;
}

/* ---------- utilities ---------- */

const STOPWORDS = new Set(
  ("a an the and or but if of in on at to for with as is are was were be by from that this these those it its " +
    "what which when where who why how will can could would should may might").split(/\s+/)
);

function tokenize(s) {
  if (!s) return [];
  return String(s)
    .toLowerCase()
    .replace(/[^\w\s-]/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .filter((tok) => !STOPWORDS.has(tok) && tok.length > 1);
}

function buildIdf(docs) {
  const df = Object.create(null);
  const N = docs.length;
  docs.forEach((d) => {
    const seen = new Set(tokenize(d.text));
    seen.forEach((t) => (df[t] = (df[t] || 0) + 1));
  });
  const idf = Object.create(null);
  Object.keys(df).forEach((t) => {
    idf[t] = Math.log(1 + N / df[t]);
  });
  return idf;
}

function buildTfMap(text) {
  const tf = Object.create(null);
  const toks = tokenize(text);
  toks.forEach((t) => (tf[t] = (tf[t] || 0) + 1));
  const maxf = Math.max(1, ...Object.values(tf));
  Object.keys(tf).forEach((k) => (tf[k] = tf[k] / maxf));
  return tf;
}

function scoreDocTfIdf(tfMap, idfMap, queryTokens) {
  if (!queryTokens || queryTokens.length === 0) return 0;
  let score = 0;
  queryTokens.forEach((qt) => {
    if (tfMap[qt]) score += tfMap[qt] * (idfMap[qt] || 1);
  });
  return score;
}

/* ---------- text cleaning & summarization ---------- */

function cleanText(md) {
  if (!md) return "";
  let s = String(md);
  s = s.replace(/```[\s\S]*?```/g, " ");
  s = s.replace(/`[^`]*`/g, " ");
  s = s.replace(/^#{1,6}\s+/gm, "");
  s = s.replace(/(\*\*|__|\*|_)/g, "");
  s = s.replace(/\[([^\]]+)\]\([^)]+\)/g, "$1");
  s = s.replace(/\s+/g, " ").trim();
  return s;
}

function firstNSentences(text, n = 2) {
  if (!text) return "";
  const parts = text.match(/[^\.!\?]+[\.!\?]?/g) || [text];
  return parts.slice(0, n).map((p) => p.trim()).join(" ").trim();
}

/* ---------- question intent detection ---------- */

function detectQuestionType(q) {
  if (!q) return "other";
  const s = q.toLowerCase();
  if (/^(yes|no|is|are|do|does|did|was|were|can|could|should|will)\b/.test(s)) return "yesno";
  if (/\b(when|date|launch|timeline|time)\b/.test(s)) return "time";
  if (/\b(how many|how much|total supply|supply)\b/.test(s)) return "numeric";
  if (/\b(what|who|explain|describe|why|how)\b/.test(s)) return "explain";
  return "other";
}

/* ---------- build concise professional answer ---------- */

function buildConciseAnswer(topEntries, question) {
  if (!topEntries || topEntries.length === 0) {
    return "No direct matches found in the knowledge base. Try rephrasing or asking more broadly.";
  }

  const cleaned = topEntries.map((e) => ({ ...e, clean: cleanText(e.text) }));
  const pieces = cleaned.map((e) => firstNSentences(e.clean, 2)).filter(Boolean);

  const use = pieces.slice(0, 3);
  let joined = use.join("\n\n");
  if (joined.length > 700) joined = joined.slice(0, 700).trim() + "…";

  const qType = detectQuestionType(question);
  let lead = "";
  if (qType === "yesno") {
    lead = "Short answer: Likely yes (see sources)";
  } else if (qType === "time") {
    lead = "Short answer: No specific public mainnet date found in the docs; check official roadmap.";
  } else if (qType === "numeric") {
    lead = "Short answer: See tokenomics section for numbers — here's a summary from docs:";
  } else {
    lead = `Short answer (based on ${topEntries.length} doc${topEntries.length > 1 ? "s" : ""}):`;
  }

  return `${lead}\n\n${joined}`;
}

/* ---------- route handler (App Router style) ---------- */

export async function POST(req) {
  try {
    const body = await req.json();
    const question = body?.question;
    if (!question || String(question).trim().length === 0) {
      return NextResponse.json({ error: "question required" }, { status: 400 });
    }

    const docs = loadData();
    if (!docs || docs.length === 0) {
      return NextResponse.json({ error: "knowledge base empty" }, { status: 500 });
    }

    const idf = buildIdf(docs);
    const docTf = docs.map((d) => buildTfMap(d.text));
    const qTokens = tokenize(question);

    const scored = docs.map((d, i) => {
      const sTfIdf = scoreDocTfIdf(docTf[i], idf, qTokens);
      const substrHits = qTokens.reduce((acc, t) => acc + (d.text.toLowerCase().includes(t) ? 1 : 0), 0);
      const finalScore = sTfIdf + 0.25 * substrHits;
      return { ...d, score: finalScore };
    });

    const top = scored.filter((x) => x.score > 0).sort((a, b) => b.score - a.score).slice(0, 4);

    const answer = buildConciseAnswer(top, question);

    const sources = top.map((t) => ({
      title: t.title,
      url: t.url || FALLBACK_SOURCE_URL,
      snippet: cleanText(t.text).slice(0, 300),
    }));

    return NextResponse.json({ answer, sources });
  } catch (err) {
    console.error("Chat API error:", err && err.stack ? err.stack : err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
