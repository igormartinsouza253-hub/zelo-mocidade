import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import { AppRoutes } from "@/routes/AppRoutes";
import { useThemeColorMeta } from "@/hooks/useThemeColorMeta";
import { ActiveGroupProvider } from "@/hooks/useActiveGroup";
import { OfflineProvider } from "@/hooks/useOfflineMode";
import { OfflineSynchronizer } from "@/components/OfflineSynchronizer";

const queryClient = new QueryClient();

const App = () => {
  useThemeColorMeta();

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider attribute="class" defaultTheme="light" enableSystem>
        <Toaster />
        <Sonner />
        <OfflineProvider>
          <BrowserRouter>
            <ActiveGroupProvider>
              <OfflineSynchronizer />
              <AppRoutes />
            </ActiveGroupProvider>
          </BrowserRouter>
        </OfflineProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
};

export default App;
