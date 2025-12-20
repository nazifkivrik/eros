import { useState } from "react"

type ToastProps = {
  title: string
  description?: string
  variant?: "default" | "destructive"
}

export function useToast() {
  const [toasts] = useState<ToastProps[]>([])

  const toast = (props: ToastProps) => {
    // Simple implementation - just log for now
    console.log("[Toast]", props)

    // You can enhance this later with actual toast UI
    if (props.variant === "destructive") {
      alert(`Error: ${props.title}\n${props.description || ""}`)
    }
  }

  return { toast, toasts }
}
