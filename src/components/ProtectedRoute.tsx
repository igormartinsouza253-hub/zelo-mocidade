import { Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { ZeloLogo } from "@/components/ZeloLogo";

interface ProtectedRouteProps {
  children: React.ReactNode;
}

const ProtectedRoute = ({ children }: ProtectedRouteProps) => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <ZeloLogo className="h-24 w-24 rounded-3xl p-4 shadow-[var(--shadow-elevated)]" />
          <div className="h-1.5 w-24 overflow-hidden rounded-full bg-primary/15">
            <div className="h-full w-1/2 animate-[loading-bar_1.1s_ease-in-out_infinite] rounded-full bg-primary" />
          </div>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  return <>{children}</>;
};

export default ProtectedRoute;
