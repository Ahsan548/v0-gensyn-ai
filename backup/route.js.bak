import fs from "fs";
import path from "path";

export async function POST(req) {
  try {
    const body = await req.json();
    const question = body?.question?.trim();

    if (!question) {
      return Response.json({ error: "Question required" }, { status: 400 });
    }

    // Load knowledge base JSON
    const DATA_PATH = path.join(process.cwd(), "gensyn_data.json");
    const raw = fs.readFileSync(DATA_PATH, "utf8");
    const obj = JSON.parse(raw);

    const docs = Object.entries(obj).map(([name, text]) => ({
      title: name,
      text: text || "",
      url: "/docs/" + encodeURIComponent(name),
    }));

    // Score documents
    const scoreText = (docText, q) => {
      q = q.toLowerCase();
      return q
        .split(/\s+/)
        .filter(Boolean)
        .reduce((s, tok) => s + (docText.toLowerCase().includes(tok) ? 1 : 0), 0);
    };

    const makeSnippet = (t, max = 350) => {
      if (!t) return "";
      const s = t.trim().replace(/\s+/g, " ");
      return s.length > max ? s.slice(0, max).trim() + "…" : s;
    };

    const scored = docs
      .map((d) => ({ ...d, score: scoreText(d.text, question) }))
      .filter((d) => d.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 4);

    let answer =
      scored.length === 0
        ? "No direct match found in the docs. Try asking differently."
        : "Answer (based on " +
          scored.length +
          " docs):\n\n" +
          scored
            .map(
              (e, i) =>
                `Source ${i + 1} (${e.title}): ${makeSnippet(e.text, 400)}`
            )
            .join("\n\n");

    const sources = scored.map((t) => ({
      title: t.title,
      url: "/docs/" + encodeURIComponent(t.title),
      snippet: makeSnippet(t.text, 300),
    }));

    return Response.json({ answer, sources });
  } catch (err) {
    console.error("API ERR:", err);
    return Response.json({ error: String(err) }, { status: 500 });
  }
}
