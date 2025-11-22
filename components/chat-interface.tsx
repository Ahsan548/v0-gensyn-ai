const handleSendMessage = async (content: string) => {
  console.log("[v0] Sending message:", content);

  const userMessage: Message = {
    id: Date.now().toString(),
    type: "user",
    content,
    timestamp: new Date(),
  };
  setMessages(prev => [...prev, userMessage]);

  // Add a temporary "bot typing" placeholder
  const pendingId = (Date.now()+1).toString();
  const botPlaceholder: Message = {
    id: pendingId,
    type: "bot",
    content: "Thinking...",
    timestamp: new Date(),
  };
  setMessages(prev => [...prev, botPlaceholder]);

  try {
    const r = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question: content }),
    });

    if (!r.ok) throw new Error(`API ${r.status} ${r.statusText}`);
    const json = await r.json();
    const botMessage: Message = {
      id: (Date.now()+2).toString(),
      type: "bot",
      content: json.answer || "No answer.",
      timestamp: new Date(),
      sources: (json.sources || []).map((s: any) => ({ title: s.title, url: s.url })),
    };

    // replace last placeholder with real answer
    setMessages(prev => prev.map(m => (m.id === pendingId ? botMessage : m)));
  } catch (err: any) {
    console.error("Chat API error:", err);
    setMessages(prev => prev.map(m => (m.id === pendingId ? {
      ...m,
      content: "Server error — try again",
      // optionally attach error detail in console only
    } : m)));
  }
};
