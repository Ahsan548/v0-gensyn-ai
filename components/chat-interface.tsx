const handleSendMessage = async (content: string) => {
  console.log("[v0] Sending message:", content);

  const userMessage: Message = {
    id: (typeof crypto !== "undefined" && (crypto as any).randomUUID) ? (crypto as any).randomUUID() : Date.now().toString(),
    type: "user",
    content,
    timestamp: new Date(),
  };
  setMessages(prev => [...prev, userMessage]);

  // Create a stable pending id for the bot placeholder
  const pendingId = (typeof crypto !== "undefined" && (crypto as any).randomUUID) ? (crypto as any).randomUUID() : (Date.now()+1).toString();
  const botPlaceholder: Message = {
    id: pendingId,
    type: "bot",
    content: "Thinking...",
    timestamp: new Date(),
  };
  setMessages(prev => [...prev, botPlaceholder]);

  // timeout via AbortController (e.g. 20s)
  const controller = new AbortController();
  const timeoutMs = 20_000;
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const r = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question: content }),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!r.ok) {
      // try to grab error message from JSON
      let errText = `${r.status} ${r.statusText}`;
      try {
        const errJson = await r.json();
        if (errJson && errJson.error) errText = errJson.error;
      } catch (e) { /* ignore */ }
      throw new Error(`API ${errText}`);
    }

    const json = await r.json();

    const botMessage: Message = {
      id: (typeof crypto !== "undefined" && (crypto as any).randomUUID) ? (crypto as any).randomUUID() : (Date.now()+2).toString(),
      type: "bot",
      content: String(json.answer || "No answer."),
      timestamp: new Date(),
      sources: (json.sources || []).map((s: any) => ({ title: s.title, url: s.url })),
    };

    // Replace placeholder if present, otherwise append
    setMessages(prev => {
      let replaced = false;
      const next = prev.map(m => {
        if (m.id === pendingId) {
          replaced = true;
          return botMessage;
        }
        return m;
      });
      if (!replaced) next.push(botMessage);
      return next;
    });
  } catch (err: any) {
    clearTimeout(timeout);
    console.error("Chat API error:", err);

    // Replace placeholder with friendly error text
    setMessages(prev => prev.map(m => {
      if (m.id === pendingId) {
        return {
          ...m,
          content: "Server error — try again",
        };
      }
      return m;
    }));
  }
};
