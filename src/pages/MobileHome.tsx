import Dashboard from "@/pages/Dashboard";

export default function MobileHome() {
  // A rota /m é a Home dedicada do mobile.
  // Não depende do breakpoint para evitar “flip” para desktop em previews/iframes.
  return <Dashboard />;
}
