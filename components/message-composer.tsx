"use client"

import { useState, type KeyboardEvent } from "react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Send } from "lucide-react"

interface MessageComposerProps {
  onSend: (message: string) => void
}

export function MessageComposer({ onSend }: MessageComposerProps) {
  const [message, setMessage] = useState("")

  const handleSend = () => {
    if (message.trim()) {
      onSend(message.trim())
      setMessage("")
    }
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <div className="border-t border-border bg-card/50 backdrop-blur">
      <div className="max-w-4xl mx-auto p-4">
        <div className="flex gap-2 items-end">
          <div className="flex-1">
            <Textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask about Gensyn..."
              className="min-h-[60px] max-h-[200px] resize-none bg-background"
              aria-label="Message input"
            />
          </div>
          <Button onClick={handleSend} disabled={!message.trim()} size="lg" className="h-[60px] px-6">
            <Send className="h-5 w-5" />
            <span className="sr-only">Send message</span>
          </Button>
        </div>
      </div>
    </div>
  )
}
