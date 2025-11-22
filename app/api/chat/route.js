// app/api/chat/route.js  (Next.js app-router style)
import fs from "fs";
import path from "path";
import { NextResponse } from "next/server";

const DATA_PATH = path.join(process.cwd(), "gensyn_data.json");
const FALLBACK_SOURCE_URL = "/docs/01_gensyn_overview.md.txt";

function loadData() {
  const raw = fs.readFileSync(DATA_PATH, "utf8");
  const obj = JSON.parse(raw);
  return Object.entries(obj).map(([name, text]) => ({
    title: name,
    text: String(text || ""),
    url: "/docs/" + encodeURIComponent(name),
  }));
}

function scoreText(docText, q) {
  q = String(q || "").toLowerCase();
  return q.split(/\s+/).filter(Boolean)
    .reduce((s, tok) => s + (docText.toLowerCase().includes(tok) ? 1 : 0), 0);
}

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
  return parts.slice(0, n).map(p => p.trim()).join(" ");
}

function buildConciseAnswer(topEntries) {
  if (!topEntries || topEntries.length === 0) {
    return "No direct matches found in the knowledge base. Try asking differently or more broadly.";
  }
  const cleaned = topEntries.map(e => ({ ...e, clean: cleanText(e.text) }));
  const pieces = cleaned.map(e => firstNSentences(e.clean, 2)).filter(Boolean);
  const use = pieces.slice(0, 3);
  let answer = use.join("\n\n");
  if (answer.length > 700) answer = answer.slice(0, 700).trim() + "…";
  const lead = `Short answer (based on ${topEntries.length} doc${topEntries.length>1?'s':''}):`;
  return `${lead}\n\n${answer}`;
}

/** POST handler for app router */
export async function POST(req) {
  try {
    const body = await req.json();
    const question = body?.question;
    if (!question) {
      return NextResponse.json({ error: "question required" }, { status: 400 });
    }

    const docs = loadData();
    const scored = docs.map(d => ({ ...d, score: scoreText(d.text, question) }));
    const top = scored.filter(d => d.score > 0).sort((a,b)=>b.score-a.score).slice(0,4);

    const answer = buildConciseAnswer(top);

    const sources = top.map(t => ({
      title: t.title,
      url: t.url || FALLBACK_SOURCE_URL,
      snippet: (cleanText(t.text) || "").slice(0, 300)
    }));

    return NextResponse.json({ answer, sources });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
