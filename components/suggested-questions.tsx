"use client"

import { Button } from "@/components/ui/button"

const questions = [
  "How do I run a Gensyn node?",
  "What are the token allocations?",
  "Explain the proof of learning system",
  "When is the mainnet launch?",
]

interface SuggestedQuestionsProps {
  onQuestionClick: (question: string) => void
}

export function SuggestedQuestions({ onQuestionClick }: SuggestedQuestionsProps) {
  const handleClick = (question: string) => {
    console.log("[v0] Suggested question clicked:", question)
    onQuestionClick(question)
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">Suggested questions:</p>
      <div className="flex flex-wrap gap-2">
        {questions.map((question, index) => (
          <Button
            key={index}
            variant="outline"
            size="sm"
            onClick={() => handleClick(question)}
            className="glass-panel hover:bg-sidebar-accent/50 hover:border-primary/50 transition-all bg-transparent"
          >
            {question}
          </Button>
        ))}
      </div>
    </div>
  )
}
