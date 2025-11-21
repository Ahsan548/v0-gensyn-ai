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

  const handleSendMessage = (content: string) => {
    console.log("[v0] Sending message:", content)

    const userMessage: Message = {
      id: Date.now().toString(),
      type: "user",
      content,
      timestamp: new Date(),
    }

    setMessages((prev) => [...prev, userMessage])

    // Simulate bot response
    setTimeout(() => {
      const botMessage: Message = {
        id: (Date.now() + 1).toString(),
        type: "bot",
        content: getBotResponse(content, selectedSection),
        timestamp: new Date(),
        sources: [
          { title: "Gensyn Documentation", url: "https://docs.gensyn.ai" },
          { title: "Testnet Guide", url: "https://gensyn.ai/testnet" },
        ],
      }
      setMessages((prev) => [...prev, botMessage])
    }, 1000)
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

function getBotResponse(question: string, section: string): string {
  const responses: Record<string, string> = {
    Overview: `Gensyn is a deep learning compute protocol that enables permissionless access to GPU compute for AI training. The network connects compute providers with those who need computational resources for machine learning tasks.`,
    Tokenomics: `The Gensyn token economics are designed to incentivize compute providers and maintain network security. Token allocations include compute rewards, staking incentives, and ecosystem development funds.`,
    Technology: `Gensyn uses a novel probabilistic proof of learning system to verify that compute has been performed correctly. This allows for trustless verification of machine learning computation on distributed hardware.`,
    Governance: `Gensyn governance is community-driven, with token holders able to vote on protocol upgrades, parameter changes, and ecosystem initiatives. Proposals follow a structured timeline with discussion and voting periods.`,
    Roadmap: `The current roadmap includes testnet expansion, mainnet preparation, and additional feature releases. Check the official documentation for the latest milestone updates and timelines.`,
  }

  return (
    responses[section] ||
    `I can help you with questions about Gensyn's ${section.toLowerCase()}. What would you like to know specifically?`
  )
}
