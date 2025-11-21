// api/chat.js (updated — creates a short natural answer from top snippets)
const fs = require("fs");
const path = require("path");
const DATA_PATH = path.join(process.cwd(), "gensyn_data.json");
const FALLBACK_SOURCE_URL = "/mnt/data/cceda25d-6d4b-4212-afc7-59086e7680f2.png";

let cached = null;
function loadData() {
  if (cached) return cached;
  const raw = fs.readFileSync(DATA_PATH, "utf8");
  const obj = JSON.parse(raw);
  cached = Object.entries(obj).map(([name, text]) => ({
    title: name,
    text: text || "",
    // public docs path (we copied files to public/docs/) — fallback to session image
    url: "/docs/" + encodeURIComponent(name)
  }));
  return cached;
}

function scoreText(docText, q) {
  q = q.toLowerCase();
  return q.split(/\s+/).filter(Boolean)
    .reduce((s, tok) => s + (docText.toLowerCase().includes(tok) ? 1 : 0), 0);
}

function makeSnippet(text, maxChars = 350) {
  if (!text) return "";
  const s = text.trim().replace(/\s+/g, " ");
  return s.length > maxChars ? s.slice(0, maxChars).trim() + "…" : s;
}

function buildAnswerFromSnippets(topEntries, question) {
  // join small snippets and prepend a lead sentence
  const lead = `Answer (based on ${topEntries.length} doc${topEntries.length>1?'s':''}):`;
  const parts = topEntries.map((e, i) => `Source ${i+1} (${e.title}): ${makeSnippet(e.text, 400)}`);
  // simple fallback: if snippets are short, join them; otherwise summarise by joining first 2
  return [lead].concat(parts.slice(0,3)).join("\n\n");
}

module.exports = async (req, res) => {
  try {
    if (req.method !== "POST") return res.status(405).json({ error: "Use POST" });
    const { question } = req.body || {};
    if (!question) return res.status(400).json({ error: "question required" });

    const docs = loadData();
    const scored = docs.map(d => ({ ...d, score: scoreText(d.text, question) }));
    const top = scored.filter(d => d.score > 0).sort((a,b)=>b.score-a.score).slice(0,4);

    // If we found matches, build a readable answer from snippets
    let answer;
    if (top.length > 0) {
      answer = buildAnswerFromSnippets(top, question);
    } else {
      answer = "No direct matches found in the knowledge base. Try asking differently or more broadly.";
    }

    // ensure each returned source has a usable url: if /docs/<file> exists publicly, that's used.
    const sources = top.map(t => {
      // At runtime deployed on Vercel the /docs/<name> will be served if file exists in public/docs.
      const publicUrl = "/docs/" + encodeURIComponent(t.title);
      // We'll still include a fallback absolute session path so your tooling can map it if needed:
      return {
        title: t.title,
        url: publicUrl || FALLBACK_SOURCE_URL,
        snippet: makeSnippet(t.text, 300)
      };
    });

    res.json({ answer, sources });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: String(err) });
  }
};
