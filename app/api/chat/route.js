// ===== replace buildConciseAnswer with this (sentence-level scoring) =====
function sentenceScore(sentence, qTokens, idf) {
  const toks = tokenize(sentence);
  if (toks.length === 0) return 0;
  // score = sum(idf[token]) for tokens that appear, normalized by length
  let s = 0;
  const seen = new Set(toks);
  qTokens.forEach(qt => {
    if (seen.has(qt)) s += (idf[qt] || 1);
  });
  return s / Math.sqrt(toks.length); // penalize very long sentences a bit
}

function buildConciseAnswer(topEntries, question) {
  if (!topEntries || topEntries.length === 0) {
    return "No direct matches found in the knowledge base. Try rephrasing or asking more broadly.";
  }

  const qTokens = tokenize(question);
  // gather candidate sentences with scores
  let candidates = [];
  topEntries.slice(0, 3).forEach((e, idx) => {
    const clean = cleanText(e.text);
    const sentences = (clean.match(/[^\.!\?]+[\.!\?]?/g) || [clean]).map(s => s.trim()).filter(Boolean);
    sentences.forEach((sent, si) => {
      const sc = sentenceScore(sent, qTokens, buildIdf([e])); // small idf using single doc ok
      candidates.push({ sent, score: sc, srcTitle: e.title, docIndex: idx, order: si });
    });
  });

  // sort candidates by score desc then shorter first
  candidates.sort((a, b) => b.score - a.score || a.sent.length - b.sent.length);

  // pick top 3 highest scoring sentences (dedupe similar sentences)
  const chosen = [];
  const seenText = new Set();
  for (const c of candidates) {
    const key = c.sent.slice(0, 120).toLowerCase();
    if (seenText.has(key)) continue;
    chosen.push(c);
    seenText.add(key);
    if (chosen.length >= 3) break;
  }

  // fallback: if no good sentence found, use first 1-2 sentences from top doc
  if (chosen.length === 0) {
    const topClean = cleanText(topEntries[0].text);
    const fallbackSent = (topClean.match(/[^\.!\?]+[\.!\?]?/g) || []).slice(0,2).join(" ").trim();
    return `Short answer (based on ${topEntries.length} doc${topEntries.length>1?'s':''}):\n\n${fallbackSent}`;
  }

  // Try to make lead sentence based on question type (simple)
  const qType = detectQuestionType(question);
  let lead = "";
  if (qType === "time") lead = "Short answer: No specific public date found; summary from docs:";
  else if (qType === "yesno") lead = "Short answer: Likely yes (based on docs) — details:";
  else if (qType === "numeric") lead = "Short answer: Numbers are in tokenomics; summarized below:";
  else lead = `Short answer (based on ${topEntries.length} doc${topEntries.length>1?'s':''}):`;

  // join chosen sentences into a concise paragraph
  const answerBody = chosen.map(c => c.sent).join(" ");
  const truncated = answerBody.length > 800 ? answerBody.slice(0,800).trim() + "…" : answerBody;

  return `${lead}\n\n${truncated}`;
}
