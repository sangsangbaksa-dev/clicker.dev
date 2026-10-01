import "@/infrastructure/persistence/clicker-client-bind"
import { ClickerApp } from "@/components/clicker/clicker-app"
import { ClickerClientBootstrap } from "@/app/clicker-client-bootstrap"

export default function Home() {
  return (
    <ClickerClientBootstrap>
      <ClickerApp />
    </ClickerClientBootstrap>
  )
}
