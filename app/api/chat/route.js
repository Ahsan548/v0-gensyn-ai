// app/api/chat/route.js
const fs = require("fs");
const path = require("path");
const DATA_PATH = path.join(process.cwd(), "gensyn_data.json");
const FALLBACK_SOURCE_URL = "/docs/01_gensyn_overview.md.txt"; // public docs path fallback

let cached = null;
function loadData() {
  if (cached) return cached;
  const raw = fs.readFileSync(DATA_PATH, "utf8");
  const obj = JSON.parse(raw);
  // normalize to array: { title, text, url }
  cached = Object.entries(obj).map(([name, text]) => ({
    title: name,
    text: String(text || ""),
    url: "/docs/" + encodeURIComponent(name),
  }));
  return cached;
}

// scoring: count tokens matched
function scoreText(docText, q) {
  q = String(q || "").toLowerCase();
  return q.split(/\s+/).filter(Boolean)
    .reduce((s, tok) => s + (docText.toLowerCase().includes(tok) ? 1 : 0), 0);
}

// clean markdown / headings / double-stars etc.
function cleanText(md) {
  if (!md) return "";
  let s = String(md);
  // remove code blocks and inline code
  s = s.replace(/```[\s\S]*?```/g, " ");
  s = s.replace(/`[^`]*`/g, " ");
  // remove Markdown headings like "# ...", "## ..."
  s = s.replace(/^#{1,6}\s+/gm, "");
  // remove emphasis markers ** __ * _
  s = s.replace(/(\*\*|__|\*|_)/g, "");
  // remove markdown links but keep text: [text](url) -> text
  s = s.replace(/\[([^\]]+)\]\([^)]+\)/g, "$1");
  // collapse multiple spaces/newlines
  s = s.replace(/\s+/g, " ").trim();
  return s;
}

// return first N sentences (rough)
function firstNSentences(text, n = 2) {
  if (!text) return "";
  // split by punctuation that likely ends sentences
  const parts = text.match(/[^\.!\?]+[\.!\?]?/g) || [text];
  const chosen = parts.slice(0, n).map(p => p.trim()).join(" ");
  return chosen.trim();
}

// Build concise answer by choosing top snippets and extracting best sentences
function buildConciseAnswer(topEntries, question) {
  if (!topEntries || topEntries.length === 0) {
    return "No direct matches found in the knowledge base. Try asking differently or more broadly.";
  }

  // clean texts
  const cleaned = topEntries.map(e => ({ ...e, clean: cleanText(e.text) }));

  // prepare short pieces: first 1-2 sentences from each doc
  const pieces = cleaned.map(e => firstNSentences(e.clean, 2)).filter(Boolean);

  // prefer contents from top 2 docs
  const use = pieces.slice(0, 3); // up to 3 sources
  // join them into a short coherent answer
  // if result too long, trim to ~500 chars
  let answer = use.join("\n\n");
  if (answer.length > 700) answer = answer.slice(0, 700).trim() + "…";

  // Prepend short lead sentence answering intent when possible.
  // Try to form a one-line summary by taking the most frequent noun phrases? (simple heuristic)
  const lead = `Short answer (based on ${topEntries.length} doc${topEntries.length>1?'s':''}):`;
  return `${lead}\n\n${answer}`;
}

module.exports = async (req, res) => {
  try {
    if (req.method !== "POST") return res.status(405).json({ error: "Use POST" });
    const { question } = req.body || {};
    if (!question) return res.status(400).json({ error: "question required" });

    const docs = loadData();
    const scored = docs.map(d => ({ ...d, score: scoreText(d.text, question) }));
    const top = scored.filter(d => d.score > 0).sort((a,b)=>b.score-a.score).slice(0,4);

    // Build concise answer
    const answer = buildConciseAnswer(top, question);

    // sources: expose title + public URL + short snippet
    const sources = top.map(t => ({
      title: t.title,
      url: t.url || FALLBACK_SOURCE_URL,
      snippet: (cleanText(t.text) || "").slice(0, 300)
    }));

    // return
    res.json({ answer, sources });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: String(err) });
  }
};
