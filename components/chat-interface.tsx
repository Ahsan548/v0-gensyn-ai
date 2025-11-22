// C:\projects\gensyn-bot\components\chat-interface.tsx
// chaltey code — improved handleSendMessage with robust timeout, placeholder replace, and safer error handling

"use client"

import { useState } from "react"
import { NavigationSidebar } from "@/components/navigation-sidebar"
import { ChatArea } from "@/components/chat-area"
import { ContextualPane } from "@/components/contextual-pane"
import { MessageComposer } from "@/components/message-composer"
import { Menu, X } from "lucide-react"
import { Button } from "@/components/ui/button"

export interface Message {
  id: string
  type: "user" | "bot"
  content: string
  timestamp: Date
  sources?: Array<{ title: string; url: string }>
}

export function ChatInterface() {
  const [messages, setMessages] = useState<Message[]>([])
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const [selectedSection, setSelectedSection] = useState("Overview")

  // small helper: safe id (use crypto if available)
  const makeId = () =>
    (typeof crypto !== "undefined" && (crypto as any).randomUUID)
      ? (crypto as any).randomUUID()
      : Date.now().toString()

  // truncate long answers for UI to avoid huge renders (frontend safety)
  const truncateAnswer = (text: string, max = 250) =>
    text && text.length > max ? text.slice(0, max).trim() + "…" : text

  const handleSendMessage = async (content: string) => {
    console.log("[v0] Sending message:", content)

    const userMessage: Message = {
      id: makeId(),
      type: "user",
      content,
      timestamp: new Date(),
    }
    // add user message first
    setMessages(prev => [...prev, userMessage])

    // create a single stable placeholder id for this request
    const pendingId = makeId()
    const botPlaceholder: Message = {
      id: pendingId,
      type: "bot",
      content: "Thinking...", // UI can detect this exact text for spinner if needed
      timestamp: new Date(),
    }

    // append placeholder
    setMessages(prev => [...prev, botPlaceholder])

    // AbortController timeout (safety)
    const controller = new AbortController()
    const timeoutMs = 20_000
    const timeout = setTimeout(() => controller.abort(), timeoutMs)

    try {
      const r = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: content }),
        signal: controller.signal,
      })

      clearTimeout(timeout)

      if (!r.ok) {
        // try to parse JSON error if present
        let errText = `${r.status} ${r.statusText}`
        try {
          const errJson = await r.json()
          if (errJson && errJson.error) errText = errJson.error
        } catch (e) {
          // ignore parse error
        }
        throw new Error(`API ${errText}`)
      }

      // parse JSON safely
      let json: any = null
      try {
        json = await r.json()
      } catch (e) {
        throw new Error("Invalid JSON from API")
      }

      const answerRaw = String(json.answer || "").trim()
      const answer = answerRaw ? truncateAnswer(answerRaw, 1200) : "No answer available."

      const botMessage: Message = {
        id: makeId(),
        type: "bot",
        content: answer,
        timestamp: new Date(),
        sources: (json.sources || []).map((s: any) => ({ title: s.title, url: s.url })),
      }

      // replace placeholder if present; otherwise append
      setMessages(prev => {
        let replaced = false
        const next = prev.map(m => {
          if (m.id === pendingId) {
            replaced = true
            return botMessage
          }
          return m
        })
        if (!replaced) next.push(botMessage)
        return next
      })
    } catch (err: any) {
      clearTimeout(timeout)
      console.error("Chat API error:", err)

      // Replace placeholder with friendly error message
      setMessages(prev =>
        prev.map(m =>
          m.id === pendingId
            ? {
                ...m,
                content:
                  // give user short friendly text; full error in console only
                  err && err.name === "AbortError"
                    ? "Request timed out — try again."
                    : "Server error — try again",
              }
            : m
        )
      )
    }
  }

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      {/* Mobile Navigation Toggle */}
      <div className="lg:hidden fixed top-4 left-4 z-50">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setMobileNavOpen(!mobileNavOpen)}
          className="bg-card/80 backdrop-blur"
        >
          {mobileNavOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </Button>
      </div>

      {/* Left Navigation Sidebar */}
      <NavigationSidebar
        isOpen={mobileNavOpen}
        onClose={() => setMobileNavOpen(false)}
        selectedSection={selectedSection}
        onSectionChange={setSelectedSection}
      />

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col min-w-0">
        <ChatArea messages={messages} onSend={handleSendMessage} />
        <MessageComposer onSend={handleSendMessage} />
      </div>

      {/* Right Contextual Pane */}
      <ContextualPane />
    </div>
  )
}
