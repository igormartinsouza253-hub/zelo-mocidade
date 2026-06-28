import { Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import logoSource from "@/assets/logo-zelo-transparent.png";

interface ProtectedRouteProps {
  children: React.ReactNode;
}

const ProtectedRoute = ({ children }: ProtectedRouteProps) => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="flex h-24 w-24 items-center justify-center rounded-3xl bg-primary p-4 shadow-[var(--shadow-elevated)]">
            <img src={logoSource} alt="Zelo" className="h-full w-full object-contain" />
          </div>
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
