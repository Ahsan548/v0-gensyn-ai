// api/chat.js (FINAL FIXED VERSION)
const fs = require("fs");
const path = require("path");

const DATA_PATH = path.join(process.cwd(), "gensyn_data.json");

// docs folder (public/docs/)
const FALLBACK_SOURCE_URL = "/docs/";

// cache
let cached = null;

function loadData() {
  if (cached) return cached;

  const raw = fs.readFileSync(DATA_PATH, "utf8");
  const obj = JSON.parse(raw);

  cached = Object.entries(obj).map(([name, text]) => ({
    title: name,
    text: text || "",
    url: "/docs/" + encodeURIComponent(name)
  }));

  return cached;
}

function scoreText(docText, q) {
  q = q.toLowerCase();
  return q
    .split(/\s+/)
    .filter(Boolean)
    .reduce((s, tok) => (docText.toLowerCase().includes(tok) ? s + 1 : s), 0);
}

function makeSnippet(text, maxChars = 350) {
  if (!text) return "";
  const s = text.trim().replace(/\s+/g, " ");
  return s.length > maxChars ? s.slice(0, maxChars).trim() + "…" : s;
}

function buildAnswerFromSnippets(topEntries) {
  const lead = `Answer (based on ${topEntries.length} docs):`;
  const parts = topEntries.map(
    (e, i) => `Source ${i + 1} (${e.title}): ${makeSnippet(e.text, 400)}`
  );

  return [lead].concat(parts.slice(0, 3)).join("\n\n");
}

module.exports = async (req, res) => {
  try {
    // CORS fix for browser
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");

    if (req.method === "OPTIONS") {
      return res.status(200).end();
    }

    if (req.method !== "POST") {
      return res.status(405).json({ error: "Use POST" });
    }

    const { question } = req.body || {};
    if (!question) {
      return res.status(400).json({ error: "Question required" });
    }

    const docs = loadData();
    const scored = docs.map((d) => ({
      ...d,
      score: scoreText(d.text, question),
    }));

    const top = scored
      .filter((d) => d.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 4);

    let answer;
    if (top.length > 0) {
      answer = buildAnswerFromSnippets(top);
    } else {
      answer =
        "No direct matches found in the knowledge base. Try asking differently.";
    }

    const sources = top.map((t) => ({
      title: t.title,
      url: t.url || FALLBACK_SOURCE_URL,
      snippet: makeSnippet(t.text, 300),
    }));

    return res.json({ answer, sources });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: String(err) });
  }
};
