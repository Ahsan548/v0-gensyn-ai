"use client"

import { Activity, Users, Zap } from "lucide-react"

export function ContextualPane() {
  return (
    <aside className="hidden xl:flex w-80 border-l border-border bg-card/30 backdrop-blur flex-col p-6 gap-6">
      <div>
        <h3 className="font-semibold mb-4 text-foreground">Network Health</h3>

        <div className="space-y-4">
          <div className="glass-panel rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Activity className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium">Network Status</span>
              </div>
              <span className="text-xs text-green-500 font-medium">Healthy</span>
            </div>
            <p className="text-xs text-muted-foreground">All systems operational</p>
          </div>

          <div className="glass-panel rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium">Active Nodes</span>
              </div>
              <span className="text-xs font-bold text-foreground">1,247</span>
            </div>
            <p className="text-xs text-muted-foreground">+12% from last week</p>
          </div>

          <div className="glass-panel rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Zap className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium">Compute Power</span>
              </div>
              <span className="text-xs font-bold text-foreground">847 TFLOPS</span>
            </div>
            <p className="text-xs text-muted-foreground">Total available compute</p>
          </div>
        </div>
      </div>

      <div>
        <h3 className="font-semibold mb-4 text-foreground">Quick Links</h3>
        <div className="space-y-2">
          {[
            { title: "Documentation", url: "#" },
            { title: "Testnet Guide", url: "#" },
            { title: "Discord Community", url: "#" },
            { title: "GitHub Repository", url: "#" },
          ].map((link, index) => (
            <a
              key={index}
              href={link.url}
              className="block px-3 py-2 rounded-lg hover:bg-sidebar-accent transition-colors text-sm text-foreground"
            >
              {link.title}
            </a>
          ))}
        </div>
      </div>
    </aside>
  )
}
