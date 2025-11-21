import fs from "fs";
import path from "path";

const DATA_PATH = path.join(process.cwd(), "gensyn_data.json");

function loadData() {
  const raw = fs.readFileSync(DATA_PATH, "utf8");
  const obj = JSON.parse(raw);
  return Object.entries(obj).map(([name, text]) => ({
    title: name,
    text: text || "",
    url: "/docs/" + encodeURIComponent(name),
  }));
}

function scoreText(docText, q) {
  q = q.toLowerCase();
  return q.split(/\s+/).reduce(
    (s, tok) => s + (docText.toLowerCase().includes(tok) ? 1 : 0),
    0
  );
}

function snippet(text, max = 350) {
  if (!text) return "";
  const clean = text.trim().replace(/\s+/g, " ");
  return clean.length > max ? clean.slice(0, max) + "…" : clean;
}

export async function POST(req) {
  const body = await req.json();
  const question = body?.question;

  if (!question) {
    return Response.json({ error: "question required" }, { status: 400 });
  }

  const docs = loadData();
  const scored = docs
    .map((d) => ({ ...d, score: scoreText(d.text, question) }))
    .filter((d) => d.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 4);

  let answer;

  if (scored.length > 0) {
    const parts = scored.map(
      (e, i) => `Source ${i + 1} (${e.title}): ${snippet(e.text, 400)}`
    );
    answer = `Answer (based on ${scored.length} docs):\n\n` + parts.join("\n\n");
  } else {
    answer =
      "No matching information found. Try rephrasing your question or asking something broader.";
  }

  const sources = scored.map((s) => ({
    title: s.title,
    url: "/docs/" + encodeURIComponent(s.title),
    snippet: snippet(s.text, 250),
  }));

  return Response.json({ answer, sources });
}
