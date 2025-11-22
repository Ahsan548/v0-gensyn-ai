// app/api/chat/route.js
// v2: better scoring, stopwords, concise professional answers, question-type hints
const fs = require("fs");
const path = require("path");
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

// tiny stopwords for English (trimmed) — improves matching quality
const STOPWORDS = new Set(
  ("a an the and or but if of in on at to for with as is are was were be by from that this these those it its " +
  "what which when where who why how will can could would should may might").split(/\s+/)
);

// normalize, remove punctuation except keep alphanum + hyphen
function tokenize(s) {
  if (!s) return [];
  return String(s)
    .toLowerCase()
    .replace(/[^\w\s-]/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .filter(tok => !STOPWORDS.has(tok) && tok.length > 1);
}

// basic IDF precompute for docs (small, done per-request cheaply)
function buildIdf(docs) {
  const df = Object.create(null);
  const N = docs.length;
  docs.forEach(d => {
    const seen = new Set(tokenize(d.text));
    seen.forEach(t => (df[t] = (df[t] || 0) + 1));
  });
  const idf = Object.create(null);
  Object.keys(df).forEach(t => {
    idf[t] = Math.log(1 + N / df[t]);
  });
  return idf;
}

// TF for a single doc
function buildTfMap(text) {
  const tf = Object.create(null);
  const toks = tokenize(text);
  toks.forEach(t => (tf[t] = (tf[t] || 0) + 1));
  // normalize by max frequency
  const maxf = Math.max(1, ...Object.values(tf));
  Object.keys(tf).forEach(k => (tf[k] = tf[k] / maxf));
  return tf;
}

// Score doc vs query using TF-IDF-ish dot-product
function scoreDocTfIdf(tfMap, idfMap, queryTokens) {
  if (!queryTokens || queryTokens.length === 0) return 0;
  let score = 0;
  queryTokens.forEach(qt => {
    if (tfMap[qt]) score += tfMap[qt] * (idfMap[qt] || 1);
  });
  return score;
}

/* ---------- text cleaning & summarization ---------- */

function cleanText(md) {
  if (!md) return "";
  let s = String(md);
  // remove code blocks & inline code
  s = s.replace(/```[\s\S]*?```/g, " ");
  s = s.replace(/`[^`]*`/g, " ");
  // remove markdown headings
  s = s.replace(/^#{1,6}\s+/gm, "");
  // strip bold/italic markers
  s = s.replace(/(\*\*|__|\*|_)/g, "");
  // links: [text](url) -> text
  s = s.replace(/\[([^\]]+)\]\([^)]+\)/g, "$1");
  // collapse whitespace
  s = s.replace(/\s+/g, " ").trim();
  return s;
}

// naive first N sentences
function firstNSentences(text, n = 2) {
  if (!text) return "";
  // rough split by punctuation
  const parts = text.match(/[^\.!\?]+[\.!\?]?/g) || [text];
  return parts.slice(0, n).map(p => p.trim()).join(" ").trim();
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

  // clean & prepare short snippets
  const cleaned = topEntries.map(e => ({ ...e, clean: cleanText(e.text) }));
  const pieces = cleaned.map(e => firstNSentences(e.clean, 2)).filter(Boolean);

  // prefer top 1-2 docs; join up to 3 snippets
  const use = pieces.slice(0, 3);
  let joined = use.join("\n\n");
  if (joined.length > 700) joined = joined.slice(0, 700).trim() + "…";

  // Lead sentence: try to answer directly for yes/no/time/numeric when possible (very simple heuristics)
  const qType = detectQuestionType(question);
  let lead = "";
  if (qType === "yesno") {
    // attempt to detect likely yes/no from presence of "no" words — fallback neutral
    lead = "Short answer: Likely yes (see sources)"; // keep cautious
  } else if (qType === "time") {
    lead = "Short answer: No specific public mainnet date found in the docs; check official roadmap.";
  } else if (qType === "numeric") {
    lead = "Short answer: See tokenomics section for numbers — here's a summary from docs:";
  } else {
    lead = `Short answer (based on ${topEntries.length} doc${topEntries.length > 1 ? "s" : ""}):`;
  }

  return `${lead}\n\n${joined}`;
}

/* ---------- route handler ---------- */

module.exports = async (req, res) => {
  try {
    // allow only POST
    if (req.method !== "POST") return res.status(405).json({ error: "Use POST" });

    const { question } = req.body || {};
    if (!question || String(question).trim().length === 0) {
      return res.status(400).json({ error: "question required" });
    }

    const docs = loadData();
    if (!docs || docs.length === 0) {
      return res.status(500).json({ error: "knowledge base empty" });
    }

    // build idf map once
    const idf = buildIdf(docs);

    // compute tf maps for docs (cache could be added, but OK for small repo)
    const docTf = docs.map(d => buildTfMap(d.text));

    // tokenize query
    const qTokens = tokenize(question);

    // score all docs with tf-idf and also a fallback simple substring if tf-idf=0
    const scored = docs.map((d, i) => {
      const sTfIdf = scoreDocTfIdf(docTf[i], idf, qTokens);
      // fallback substring count (boost small but helpful)
      const substrHits = qTokens.reduce((acc, t) => acc + (d.text.toLowerCase().includes(t) ? 1 : 0), 0);
      const finalScore = sTfIdf + 0.25 * substrHits;
      return { ...d, score: finalScore };
    });

    const top = scored.filter(x => x.score > 0).sort((a, b) => b.score - a.score).slice(0, 4);

    // Build answer
    const answer = buildConciseAnswer(top, question);

    // map sources (title, url, short snippet)
    const sources = top.map(t => ({
      title: t.title,
      url: t.url || FALLBACK_SOURCE_URL,
      snippet: cleanText(t.text).slice(0, 300),
    }));

    return res.json({ answer, sources });
  } catch (err) {
    console.error("Chat API error:", err && err.stack ? err.stack : err);
    res.status(500).json({ error: String(err) });
  }
};
