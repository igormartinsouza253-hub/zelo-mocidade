import { Routes, Route, Navigate } from "react-router-dom";
import { AppLayout } from "@/components/AppLayout";
import ProtectedRoute from "@/components/ProtectedRoute";

import Dashboard from "@/pages/Dashboard";
import Membros from "@/pages/Membros";
import NovoMembro from "@/pages/NovoMembro";
import DetalhesMembro from "@/pages/DetalhesMembro";
import Reunioes from "@/pages/Reunioes";
import NovaReuniao from "@/pages/NovaReuniao";
import DetalhesReuniao from "@/pages/DetalhesReuniao";
import VisualizarReuniao from "@/pages/VisualizarReuniao";
import HistoricoReunioes from "@/pages/HistoricoReunioes";
import EstatisticasReunioes from "@/pages/EstatisticasReunioes";
import Configuracoes from "@/pages/Configuracoes";
import Calendario from "@/pages/Calendario";
import Auth from "@/pages/Auth";
import MembrosGrupo from "@/pages/MembrosGrupo";
import EditorNota from "@/pages/EditorNota";
import VisualizarMembro from "@/pages/VisualizarMembro";
import NotFound from "@/pages/NotFound";
import Cargos from "@/pages/Cargos";
import Estatisticas from "@/pages/Estatisticas";
import Notas from "@/pages/Notas";
import Busca from "@/pages/Busca";
import Visitas from "@/pages/Visitas";
import NovaVisita from "@/pages/NovaVisita";
import VisualizarVisita from "@/pages/VisualizarVisita";
import GrupoGestor from "@/pages/GrupoGestor";
import Chat from "@/pages/Chat";
import ConfiguracoesGrupoAdmin from "@/pages/ConfiguracoesGrupoAdmin";

function ProtectedLayout({ children }: { children: React.ReactNode }) {
  return (
    <ProtectedRoute>
      <AppLayout>{children}</AppLayout>
    </ProtectedRoute>
  );
}

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/auth" element={<Auth />} />

      <Route
        path="/"
        element={
          <ProtectedLayout>
            <Dashboard />
          </ProtectedLayout>
        }
      />
      {/* rota legada (mobile antigo): mantém compatibilidade */}
      <Route path="/m" element={<Navigate to="/" replace />} />

      <Route path="/membros" element={<ProtectedLayout><Membros /></ProtectedLayout>} />
      <Route path="/membros/novo" element={<ProtectedLayout><NovoMembro /></ProtectedLayout>} />
      <Route path="/membros/visualizar/:id" element={<ProtectedLayout><VisualizarMembro /></ProtectedLayout>} />
      <Route path="/membros/editar/:id" element={<ProtectedLayout><DetalhesMembro /></ProtectedLayout>} />
      <Route path="/membros/grupo/:faixa" element={<ProtectedLayout><MembrosGrupo /></ProtectedLayout>} />

      <Route path="/reunioes" element={<ProtectedLayout><Reunioes /></ProtectedLayout>} />
      <Route path="/reunioes/nova" element={<ProtectedLayout><NovaReuniao /></ProtectedLayout>} />
      <Route path="/reunioes/:id" element={<ProtectedLayout><DetalhesReuniao /></ProtectedLayout>} />
      <Route path="/reunioes/visualizar/:id" element={<ProtectedLayout><VisualizarReuniao /></ProtectedLayout>} />
      <Route path="/reunioes/historico" element={<ProtectedLayout><HistoricoReunioes /></ProtectedLayout>} />
      <Route path="/reunioes/estatisticas" element={<ProtectedLayout><EstatisticasReunioes /></ProtectedLayout>} />

      <Route path="/visitas" element={<ProtectedLayout><Visitas /></ProtectedLayout>} />
      <Route path="/visitas/nova" element={<ProtectedLayout><NovaVisita /></ProtectedLayout>} />
      <Route path="/visitas/:id" element={<ProtectedLayout><VisualizarVisita /></ProtectedLayout>} />

      <Route path="/calendario" element={<ProtectedLayout><Calendario /></ProtectedLayout>} />

      {/* Rota legada: redireciona para a Agenda unificada */}
      <Route path="/aniversariantes" element={<ProtectedLayout><Navigate to="/calendario" replace /></ProtectedLayout>} />

      <Route path="/configuracoes" element={<ProtectedLayout><Configuracoes /></ProtectedLayout>} />
      <Route path="/configuracoes/grupo-admin" element={<ProtectedLayout><ConfiguracoesGrupoAdmin /></ProtectedLayout>} />

      <Route path="/grupo" element={<ProtectedLayout><GrupoGestor /></ProtectedLayout>} />
      <Route path="/chat" element={<ProtectedLayout><Chat /></ProtectedLayout>} />

      <Route path="/notas" element={<ProtectedLayout><Notas /></ProtectedLayout>} />
      <Route path="/notas/nova" element={<ProtectedLayout><EditorNota /></ProtectedLayout>} />
      <Route path="/notas/editar/:id" element={<ProtectedLayout><EditorNota /></ProtectedLayout>} />

      <Route path="/cargos" element={<ProtectedLayout><Cargos /></ProtectedLayout>} />
      <Route path="/estatisticas" element={<ProtectedLayout><Estatisticas /></ProtectedLayout>} />
      <Route path="/busca" element={<ProtectedLayout><Busca /></ProtectedLayout>} />

      {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}
