import { useUIStore } from "@/lib/stores/ui.store"

export function useToast() {
  const { addToast } = useUIStore()

  const toast = ({
    title,
    description,
    variant = "default",
  }: {
    title: string
    description?: string
    variant?: "default" | "destructive"
  }) => {
    const message = description ? `${title}: ${description}` : title
    const type = variant === "destructive" ? "error" : "success"
    
    addToast({
      message,
      type,
    })
  }

  return { toast }
}