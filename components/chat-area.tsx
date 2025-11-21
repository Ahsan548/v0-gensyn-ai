"use client"

import { useEffect, useRef } from "react"
import type { Message } from "@/components/chat-interface"
import { MessageBubble } from "@/components/message-bubble"
import { SuggestedQuestions } from "@/components/suggested-questions"
import { EmptyState } from "@/components/empty-state"

interface ChatAreaProps {
  messages: Message[]
  onSend: (message: string) => void
}

export function ChatArea({ messages, onSend }: ChatAreaProps) {
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages])

  return (
    <div className="flex-1 overflow-hidden">
      <div ref={scrollRef} className="h-full overflow-y-auto px-4 lg:px-8 py-6 space-y-6">
        {/* Header */}
        <div className="max-w-4xl mx-auto">
          <h2 className="text-2xl lg:text-3xl font-bold mb-2 text-balance">Gensyn.bot</h2>
          <p className="text-muted-foreground text-pretty">
            Your AI assistant for Gensyn documentation, tokenomics, and testnet information
          </p>
        </div>

        {messages.length === 0 ? (
          <EmptyState onQuestionClick={onSend} />
        ) : (
          <div className="max-w-4xl mx-auto space-y-6">
            {messages.map((message, index) => (
              <div key={message.id}>
                <MessageBubble message={message} />
                {message.type === "bot" && index === 1 && (
                  <div className="mt-4">
                    <SuggestedQuestions onQuestionClick={onSend} />
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
