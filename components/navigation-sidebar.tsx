"use client"

import { cn } from "@/lib/utils"
import { BookOpen, Coins, Cpu, Vote, Map, X } from "lucide-react"
import { Button } from "@/components/ui/button"

const sections = [
  { name: "Overview", icon: BookOpen },
  { name: "Tokenomics", icon: Coins },
  { name: "Technology", icon: Cpu },
  { name: "Governance", icon: Vote },
  { name: "Roadmap", icon: Map },
]

interface NavigationSidebarProps {
  isOpen: boolean
  onClose: () => void
  selectedSection: string
  onSectionChange: (section: string) => void
}

export function NavigationSidebar({ isOpen, onClose, selectedSection, onSectionChange }: NavigationSidebarProps) {
  return (
    <>
      {/* Overlay for mobile */}
      {isOpen && <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 lg:hidden" onClick={onClose} />}

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed lg:relative inset-y-0 left-0 z-40 w-64 bg-sidebar border-r border-sidebar-border flex flex-col transition-transform duration-300",
          isOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0",
        )}
      >
        {/* Logo */}
        <div className="p-6 border-b border-sidebar-border">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
                <span className="text-primary-foreground font-bold text-lg">G</span>
              </div>
              <h1 className="text-xl font-bold text-sidebar-foreground">Gensyn.bot</h1>
            </div>
            <Button variant="ghost" size="icon" onClick={onClose} className="lg:hidden">
              <X className="h-5 w-5" />
            </Button>
          </div>
        </div>

        {/* Navigation Sections */}
        <nav className="flex-1 p-4 space-y-2">
          {sections.map((section) => {
            const Icon = section.icon
            const isActive = selectedSection === section.name

            return (
              <button
                key={section.name}
                onClick={() => {
                  onSectionChange(section.name)
                  onClose()
                }}
                className={cn(
                  "w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all text-left",
                  "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                  isActive ? "bg-primary text-primary-foreground font-medium" : "text-sidebar-foreground",
                )}
              >
                <Icon className="h-5 w-5" />
                <span>{section.name}</span>
              </button>
            )
          })}
        </nav>

        {/* Footer */}
        <div className="p-4 border-t border-sidebar-border">
          <div className="glass-panel rounded-lg p-3 text-sm text-sidebar-foreground/70">
            <p className="font-medium mb-1">Network Status</p>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              <span className="text-xs">Testnet Active</span>
            </div>
          </div>
        </div>
      </aside>
    </>
  )
}
