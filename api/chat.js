// api/chat.js (CORS-enabled)
// Replaces existing file. Save & push to repo so Vercel redeploys.

// Fallback image (same path you used earlier; kept as comment/reference)
const FALLBACK_IMAGE = "/mnt/data/cceda25d-6d4b-4212-afc7-59086e7680f2.png";

const fs = require("fs");
const path = require("path");
const DATA_PATH = path.join(process.cwd(), "gensyn_data.json");

function setCorsHeaders(res) {
  // standard permissive CORS for demo; change origin "*" to specific domain in production
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  // allow credentials if you ever need them:
  // res.setHeader("Access-Control-Allow-Credentials", "true");
}

let cached = null;
function loadData() {
  if (cached) return cached;
  const raw = fs.readFileSync(DATA_PATH, "utf8");
  const obj = JSON.parse(raw);
  cached = Object.entries(obj).map(([name, text]) => ({
    title: name,
    text: text || "",
    // public docs path (we copied files to public/docs/)
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

function buildAnswerFromSnippets(topEntries /*, question */) {
  const lead = `Answer (based on ${topEntries.length} doc${topEntries.length>1?'s':''}):`;
  const parts = topEntries.map((e, i) => `Source ${i+1} (${e.title}): ${makeSnippet(e.text, 400)}`);
  return [lead].concat(parts.slice(0,3)).join("\n\n");
}

module.exports = async (req, res) => {
  try {
    // handle CORS preflight
    if (req.method === "OPTIONS") {
      // Vercel/Node serverless: set headers and end
      setCorsHeaders(res);
      return res.status(200).end();
    }

    // always set CORS headers on actual responses too
    setCorsHeaders(res);

    if (req.method !== "POST") {
      return res.status(405).json({ error: "Use POST" });
    }

    const { question } = req.body || {};
    if (!question) return res.status(400).json({ error: "question required" });

    const docs = loadData();
    const scored = docs.map(d => ({ ...d, score: scoreText(d.text, question) }));
    const top = scored.filter(d => d.score > 0).sort((a,b)=>b.score-a.score).slice(0,4);

    let answer;
    if (top.length > 0) {
      answer = buildAnswerFromSnippets(top, question);
    } else {
      answer = "No direct matches found in the knowledge base. Try asking differently or more broadly.";
    }

    const sources = top.map(t => ({
      title: t.title,
      // public docs path on your site (served from public/docs/)
      url: "/docs/" + encodeURIComponent(t.title),
      snippet: makeSnippet(t.text, 300)
    }));

    // final JSON response
    return res.status(200).json({ answer, sources });
  } catch (err) {
    console.error(err);
    setCorsHeaders(res);
    return res.status(500).json({ error: String(err) });
  }
};
