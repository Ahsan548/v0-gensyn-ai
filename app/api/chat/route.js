// app/api/chat/route.js
// v3: sentence-level extraction + sentence scoring for concise professional answers

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

/* small stopword set */
const STOPWORDS = new Set(
  ("a an the and or but if of in on at to for with as is are was were be by from that this these those it its what which when where who why how will can could would should may might").split(/\s+/)
);

/* tokenize (keeps alnum + hyphen) */
function tokenize(s) {
  if (!s) return [];
  return String(s)
    .toLowerCase()
    .replace(/[^\w\s-]/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .filter(tok => tok.length > 1 && !STOPWORDS.has(tok));
}

/* build idf map */
function buildIdf(docs) {
  const df = Object.create(null);
  const N = docs.length;
  docs.forEach(d => {
    const seen = new Set(tokenize(d.text));
    seen.forEach(t => (df[t] = (df[t] || 0) + 1));
  });
  const idf = Object.create(null);
  Object.keys(df).forEach(t => { idf[t] = Math.log(1 + N / df[t]); });
  return idf;
}

/* build tf map (normalized) */
function buildTfMap(text) {
  const tf = Object.create(null);
  const toks = tokenize(text);
  toks.forEach(t => (tf[t] = (tf[t] || 0) + 1));
  const maxf = Math.max(1, ...Object.values(tf));
  Object.keys(tf).forEach(k => (tf[k] = tf[k] / maxf));
  return tf;
}

/* score doc vs query using tf-idf-like dot product */
function scoreDocTfIdf(tfMap, idfMap, queryTokens) {
  if (!queryTokens || queryTokens.length === 0) return 0;
  let score = 0;
  queryTokens.forEach(qt => {
    if (tfMap[qt]) score += tfMap[qt] * (idfMap[qt] || 1);
  });
  return score;
}

/* ---- text cleaning ---- */
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

/* split into sentences (naive but OK for docs) */
function sentencesFrom(text) {
  if (!text) return [];
  const s = cleanText(text);
  const arr = s.match(/[^\.!\?]+[\.!\?]?/g) || [s];
  return arr.map(p => p.trim()).filter(Boolean);
}

/* score a sentence vs query tokens (simple overlap weighted by idf) */
function scoreSentence(sent, qTokens, idfMap) {
  if (!sent || !qTokens || qTokens.length === 0) return 0;
  const toks = tokenize(sent);
  if (toks.length === 0) return 0;
  let score = 0;
  const seen = new Set(toks);
  qTokens.forEach(qt => {
    if (seen.has(qt)) {
      score += (idfMap[qt] || 1);
    }
  });
  // small length penalty for very long sentences
  const lenPenalty = Math.min(1, 200 / Math.max(50, sent.length));
  return score * lenPenalty;
}

/* pick top N sentences from top entries */
function pickBestSentences(topEntries, qTokens, idfMap, maxSentences = 2) {
  const scoredSentences = [];
  topEntries.forEach((entry, docIndex) => {
    const sents = sentencesFrom(entry.text);
    sents.forEach((s, i) => {
      const sc = scoreSentence(s, qTokens, idfMap);
      if (sc > 0) scoredSentences.push({ text: s, score: sc, docTitle: entry.title, docIdx: docIndex });
    });
  });
  // sort by score desc, unique by sentence text
  scoredSentences.sort((a, b) => b.score - a.score);
  const chosen = [];
  const seen = new Set();
  for (const s of scoredSentences) {
    const key = s.text.slice(0, 200);
    if (!seen.has(key)) {
      chosen.push(s);
      seen.add(key);
    }
    if (chosen.length >= maxSentences) break;
  }
  return chosen;
}

/* detect question type (help lead) */
function detectQuestionType(q) {
  if (!q) return "other";
  const s = q.toLowerCase();
  if (/^(yes|no|is|are|do|does|did|was|were|can|could|should|will)\b/.test(s)) return "yesno";
  if (/\b(when|date|launch|timeline|time)\b/.test(s)) return "time";
  if (/\b(how many|how much|total supply|supply|amount|number)\b/.test(s)) return "numeric";
  if (/\b(what|who|explain|describe|why|how)\b/.test(s)) return "explain";
  return "other";
}

/* build concise professional answer using best sentences */
function buildConciseAnswerV3(topEntries, question, qTokens, idfMap) {
  if (!topEntries || topEntries.length === 0) {
    return "No direct matches found in the knowledge base. Try rephrasing or asking more broadly.";
  }

  const picked = pickBestSentences(topEntries, qTokens, idfMap, 2);

  // if nothing picked, fallback: first sentence(s) of top doc
  if (picked.length === 0) {
    const first = sentencesFrom(topEntries[0].text).slice(0, 2).join(" ");
    return `Short answer (based on ${topEntries.length} doc${topEntries.length>1?"s":""}):\n\n${first}`;
  }

  // make lead using simple question-type heuristics
  const qType = detectQuestionType(question);
  let lead = `Short answer (based on ${topEntries.length} doc${topEntries.length>1?"s":""}):`;
  if (qType === "time") lead = "Short answer: No specific public date found in the docs; summary:";
  if (qType === "numeric") lead = "Short answer: See tokenomics (summary below):";
  if (qType === "yesno") lead = "Short answer: Likely yes — summary from docs:";

  // create final answer by joining best sentences, but keep short
  const joined = picked.map(p => p.text).join(" ");
  let answer = `${lead}\n\n${joined}`;
  if (answer.length > 900) answer = answer.slice(0, 900).trim() + "…";
  return answer;
}

/* ----------------- handler ----------------- */

module.exports = async (req, res) => {
  try {
    if (req.method !== "POST") return res.status(405).json({ error: "Use POST" });
    const { question } = req.body || {};
    if (!question || String(question).trim().length === 0) return res.status(400).json({ error: "question required" });

    const docs = loadData();
    if (!docs || docs.length === 0) return res.status(500).json({ error: "knowledge base empty" });

    const idf = buildIdf(docs);
    const docTf = docs.map(d => buildTfMap(d.text));
    const qTokens = tokenize(question);

    // score docs
    const scored = docs.map((d, i) => {
      const sTfIdf = scoreDocTfIdf(docTf[i], idf, qTokens);
      const substrHits = qTokens.reduce((acc, t) => acc + (d.text.toLowerCase().includes(t) ? 1 : 0), 0);
      const finalScore = sTfIdf + 0.25 * substrHits;
      return { ...d, score: finalScore };
    });

    const top = scored.filter(s => s.score > 0).sort((a, b) => b.score - a.score).slice(0, 6);
    const topForAnswer = top.slice(0, 3); // prefer top 1-3 docs for sentence picking

    const answer = buildConciseAnswerV3(topForAnswer, question, qTokens, idf);

    const sources = top.map(t => ({
      title: t.title,
      url: t.url || FALLBACK_SOURCE_URL,
      snippet: cleanText(t.text).slice(0, 300)
    }));

    return res.json({ answer, sources });
  } catch (err) {
    console.error("Chat API error:", err && err.stack ? err.stack : err);
    res.status(500).json({ error: String(err) });
  }
};
