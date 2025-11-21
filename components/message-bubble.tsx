"use client"

import type { Message } from "@/components/chat-interface"
import { cn } from "@/lib/utils"
import { format } from "date-fns"
import { ThumbsUp, ThumbsDown, ExternalLink } from "lucide-react"
import { Button } from "@/components/ui/button"

interface MessageBubbleProps {
  message: Message
}

export function MessageBubble({ message }: MessageBubbleProps) {
  const isUser = message.type === "user"

  return (
    <div className={cn("flex flex-col gap-2", isUser ? "items-end" : "items-start")}>
      {/* Message Content */}
      <div
        className={cn(
          "max-w-[85%] lg:max-w-[75%] rounded-xl px-4 py-3 leading-relaxed",
          isUser
            ? "bg-transparent border-2 border-primary text-foreground"
            : "glass-panel bot-bubble-glow text-foreground",
        )}
      >
        <p className="text-pretty">{message.content}</p>
      </div>

      {/* Timestamp */}
      <span className="text-xs text-muted-foreground px-2">{format(message.timestamp, "HH:mm")}</span>

      {/* Bot-specific elements */}
      {!isUser && (
        <div className="space-y-3 w-full max-w-[85%] lg:max-w-[75%]">
          {/* Source Citations */}
          {message.sources && message.sources.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground px-2">Sources:</p>
              <div className="space-y-2">
                {message.sources.map((source, index) => (
                  <a
                    key={index}
                    href={source.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-between gap-2 glass-panel rounded-lg px-3 py-2 hover:bg-sidebar-accent/50 transition-colors group"
                  >
                    <span className="text-sm text-foreground truncate">{source.title}</span>
                    <ExternalLink className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors flex-shrink-0" />
                  </a>
                ))}
              </div>
            </div>
          )}

          {/* Feedback Buttons */}
          <div className="flex items-center gap-2 px-2">
            <Button variant="ghost" size="sm" className="h-7 px-2 hover:text-primary">
              <ThumbsUp className="h-3.5 w-3.5" />
            </Button>
            <Button variant="ghost" size="sm" className="h-7 px-2 hover:text-destructive">
              <ThumbsDown className="h-3.5 w-3.5" />
            </Button>
            <Button variant="ghost" size="sm" className="h-7 px-2 text-xs hover:text-primary">
              Improve answer
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
