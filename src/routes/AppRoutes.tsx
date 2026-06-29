import { lazy, Suspense, type ReactNode } from "react";
import { Routes, Route, Navigate } from "react-router-dom";

import { AppLayout } from "@/components/AppLayout";
import ProtectedRoute from "@/components/ProtectedRoute";
import { RouteErrorBoundary } from "@/components/RouteErrorBoundary";
import { PageHeaderProvider } from "@/components/layout/PageHeaderContext";

const Dashboard = lazy(() => import("@/pages/Dashboard"));
const Membros = lazy(() => import("@/pages/Membros"));
const NovoMembro = lazy(() => import("@/pages/NovoMembro"));
const DetalhesMembro = lazy(() => import("@/pages/DetalhesMembro"));
const Reunioes = lazy(() => import("@/pages/Reunioes"));
const NovaReuniao = lazy(() => import("@/pages/NovaReuniao"));
const DetalhesReuniao = lazy(() => import("@/pages/DetalhesReuniao"));
const VisualizarReuniao = lazy(() => import("@/pages/VisualizarReuniao"));
const HistoricoReunioes = lazy(() => import("@/pages/HistoricoReunioes"));
const EstatisticasReunioes = lazy(() => import("@/pages/EstatisticasReunioes"));
const Configuracoes = lazy(() => import("@/pages/Configuracoes"));
const Calendario = lazy(() => import("@/pages/Calendario"));
const Auth = lazy(() => import("@/pages/Auth"));
const MembrosGrupo = lazy(() => import("@/pages/MembrosGrupo"));
const EditorNota = lazy(() => import("@/pages/EditorNota"));
const VisualizarMembro = lazy(() => import("@/pages/VisualizarMembro"));
const NotFound = lazy(() => import("@/pages/NotFound"));
const Cargos = lazy(() => import("@/pages/Cargos"));
const Estatisticas = lazy(() => import("@/pages/Estatisticas"));
const Notas = lazy(() => import("@/pages/Notas"));
const Busca = lazy(() => import("@/pages/Busca"));
const Visitas = lazy(() => import("@/pages/Visitas"));
const NovaVisita = lazy(() => import("@/pages/NovaVisita"));
const VisualizarVisita = lazy(() => import("@/pages/VisualizarVisita"));
const GrupoGestor = lazy(() => import("@/pages/GrupoGestor"));
const ConfiguracoesGrupoAdmin = lazy(() => import("@/pages/ConfiguracoesGrupoAdmin"));
const GrupoConvite = lazy(() => import("@/pages/GrupoConvite"));

function RouteFallback() {
  return (
    <div className="flex min-h-[40vh] items-center justify-center">
      <div className="h-7 w-7 animate-spin rounded-full border-2 border-primary border-t-transparent" />
    </div>
  );
}

function ProtectedLayout({ children }: { children: ReactNode }) {
  return (
    <RouteErrorBoundary>
      <ProtectedRoute>
        <AppLayout>
          <Suspense fallback={<RouteFallback />}>{children}</Suspense>
        </AppLayout>
      </ProtectedRoute>
    </RouteErrorBoundary>
  );
}

function PublicRoute({ children }: { children: ReactNode }) {
  return (
    <RouteErrorBoundary>
      <Suspense fallback={<RouteFallback />}>{children}</Suspense>
    </RouteErrorBoundary>
  );
}

function ProtectedStandalone({ children }: { children: ReactNode }) {
  return (
    <RouteErrorBoundary>
      <ProtectedRoute>
        <PageHeaderProvider>
          <Suspense fallback={<RouteFallback />}>{children}</Suspense>
        </PageHeaderProvider>
      </ProtectedRoute>
    </RouteErrorBoundary>
  );
}

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/auth" element={<PublicRoute><Auth /></PublicRoute>} />
      <Route path="/convite/:token" element={<PublicRoute><GrupoConvite /></PublicRoute>} />

      <Route path="/" element={<ProtectedLayout><Dashboard /></ProtectedLayout>} />
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
      <Route path="/aniversariantes" element={<ProtectedLayout><Navigate to="/calendario" replace /></ProtectedLayout>} />

      <Route path="/configuracoes" element={<ProtectedLayout><Configuracoes /></ProtectedLayout>} />
      <Route path="/configuracoes/grupo-admin" element={<ProtectedLayout><ConfiguracoesGrupoAdmin /></ProtectedLayout>} />
      <Route path="/grupo" element={<ProtectedStandalone><GrupoGestor /></ProtectedStandalone>} />

      <Route path="/notas" element={<ProtectedLayout><Notas /></ProtectedLayout>} />
      <Route path="/notas/nova" element={<ProtectedLayout><EditorNota /></ProtectedLayout>} />
      <Route path="/notas/editar/:id" element={<ProtectedLayout><EditorNota /></ProtectedLayout>} />

      <Route path="/cargos" element={<ProtectedLayout><Cargos /></ProtectedLayout>} />
      <Route path="/estatisticas" element={<ProtectedLayout><Estatisticas /></ProtectedLayout>} />
      <Route path="/busca" element={<ProtectedLayout><Busca /></ProtectedLayout>} />

      <Route path="*" element={<PublicRoute><NotFound /></PublicRoute>} />
    </Routes>
  );
}
