"use client"

import { MessageSquare } from "lucide-react"
import { SuggestedQuestions } from "@/components/suggested-questions"

interface EmptyStateProps {
  onQuestionClick: (question: string) => void
}

export function EmptyState({ onQuestionClick }: EmptyStateProps) {
  return (
    <div className="max-w-4xl mx-auto flex flex-col items-center justify-center py-12 text-center">
      <div className="w-20 h-20 rounded-2xl bg-primary/10 flex items-center justify-center mb-6">
        <MessageSquare className="h-10 w-10 text-primary" />
      </div>
      <h3 className="text-2xl font-bold mb-2 text-balance">Welcome to Gensyn Assistant</h3>
      <p className="text-muted-foreground mb-8 max-w-md text-pretty">
        Ask me anything about Gensyn's technology, tokenomics, governance, or how to participate in the testnet.
      </p>
      <SuggestedQuestions onQuestionClick={onQuestionClick} />
    </div>
  )
}
