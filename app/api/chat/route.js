// app/api/chat/route.js  (Next.js App Router, CORS + answer builder)
import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

const DATA_PATH = path.join(process.cwd(), "gensyn_data.json");

function loadData() {
  const raw = fs.readFileSync(DATA_PATH, "utf8");
  const obj = JSON.parse(raw);
  return Object.entries(obj).map(([name, text]) => ({
    title: name,
    text: text || "",
    url: "/docs/" + encodeURIComponent(name)
  }));
}

function scoreText(docText, q) {
  q = q.toLowerCase();
  return q
    .split(/\s+/)
    .filter(Boolean)
    .reduce((s, tok) => s + (docText.toLowerCase().includes(tok) ? 1 : 0), 0);
}

function makeSnippet(text, maxChars = 350) {
  if (!text) return "";
  const s = text.trim().replace(/\s+/g, " ");
  return s.length > maxChars ? s.slice(0, maxChars).trim() + "…" : s;
}

function buildAnswer(topEntries) {
  const lead = `Answer (based on ${topEntries.length} docs):`;
  const parts = topEntries.map(
    (e, i) => `Source ${i + 1} (${e.title}): ${makeSnippet(e.text, 400)}`
  );
  return [lead].concat(parts.slice(0, 3)).join("\n\n");
}

export async function POST(req) {
  try {
    const body = await req.json();
    const question = body.question;

    if (!question)
      return NextResponse.json({ error: "question required" }, { status: 400 });

    const docs = loadData();
    const scored = docs
      .map((d) => ({ ...d, score: scoreText(d.text, question) }))
      .filter((d) => d.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 4);

    const answer =
      scored.length > 0
        ? buildAnswer(scored)
        : "No matches found. Try different wording.";

    return NextResponse.json(
      {
        answer,
        sources: scored.map((t) => ({
          title: t.title,
          url: t.url,
          snippet: makeSnippet(t.text, 200)
        }))
      },
      {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Headers": "Content-Type"
        }
      }
    );
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
