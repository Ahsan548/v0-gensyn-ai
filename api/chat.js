// api/chat.js
const fs = require("fs");
const path = require("path");
const DATA_PATH = path.join(process.cwd(), "gensyn_data.json");

// Temporary source link (we will map to public files later)
const FALLBACK_SOURCE_URL = "/mnt/data/cceda25d-6d4b-4212-afc7-59086e7680f2.png";

let cached = null;
function loadData() {
  if (cached) return cached;
  const raw = fs.readFileSync(DATA_PATH, "utf8");
  const obj = JSON.parse(raw);
  cached = Object.entries(obj).map(([name, text]) => ({
    title: name,
    text: text || "",
    url: FALLBACK_SOURCE_URL
  }));
  return cached;
}

function scoreText(docText, q) {
  q = q.toLowerCase();
  return q.split(/\s+/).filter(Boolean)
    .reduce((s, tok) => s + (docText.toLowerCase().includes(tok) ? 1 : 0), 0);
}

module.exports = async (req, res) => {
  try {
    if (req.method !== "POST") return res.status(405).json({ error: "Use POST" });
    const { question } = req.body || {};
    if (!question) return res.status(400).json({ error: "question required" });

    const docs = loadData();
    const scored = docs.map(d => ({ ...d, score: scoreText(d.text, question) }));
    const top = scored.filter(d => d.score > 0).sort((a,b)=>b.score-a.score).slice(0,4);

    const answer = top.length
      ? `Found ${top.length} matching docs: ${top.map(t=>t.title).join(", ")}.`
      : "No matching docs found in local index. Try a broader question.";

    res.json({
      answer,
      sources: top.map(t => ({ title: t.title, url: t.url, snippet: t.text.slice(0,300) }))
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: String(err) });
  }
};
