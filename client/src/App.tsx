import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/hooks/use-auth";
import { Sidebar } from "@/components/layout/sidebar";
import { useState } from "react";
import DashboardPage from "@/pages/dashboard";
import DataSourcesPage from "@/pages/data-sources";
import UsersPage from "@/pages/users";
import SettingsPage from "@/pages/settings";
import LoginPage from "@/pages/login";
import PasswordResetRequestPage from "@/pages/password-reset-request";
import PasswordResetPage from "@/pages/password-reset";
import NotFound from "@/pages/not-found";
import PublicDashboardPage from "@/pages/public-dashboard";
import PublicDashboardsPage from "@/pages/public-dashboards";

function AppLayout({ children }: { children: React.ReactNode }) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const { isAuthenticated } = useAuth();

  const handleSidebarToggle = () => {
    setIsSidebarOpen(!isSidebarOpen);
  };

  const handleSidebarClose = () => {
    setIsSidebarOpen(false);
  };

  if (!isAuthenticated) {
    return <LoginPage />;
  }

  return (
    <div className="flex h-screen bg-background">
      <Sidebar isOpen={isSidebarOpen} onClose={handleSidebarClose} />
      <main className="flex-1 flex flex-col overflow-hidden">
        {children}
      </main>
    </div>
  );
}

function ProtectedRouter() {
  return (
    <Switch>
      <Route path="/" component={DashboardPage} />
      <Route path="/data-sources" component={DataSourcesPage} />
      <Route path="/users" component={UsersPage} />
      <Route path="/settings" component={SettingsPage} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TooltipProvider>
          <Switch>
            <Route path="/login" component={LoginPage} />
            <Route path="/password-reset-request" component={PasswordResetRequestPage} />
            <Route path="/password-reset" component={PasswordResetPage} />
            <Route path="/public/dashboards" component={PublicDashboardsPage} />
            <Route path="/public/dashboard/:id" component={PublicDashboardPage} />
            <Route>
              <AppLayout>
                <ProtectedRouter />
              </AppLayout>
            </Route>
          </Switch>
          <Toaster />
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
