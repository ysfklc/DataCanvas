import { useQuery } from "@tanstack/react-query";
import { useParams } from "wouter";
import { DashboardCanvas } from "@/components/dashboard/dashboard-canvas";
import { Card, CardContent } from "@/components/ui/card";
import { BarChart3, Shield, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Dashboard } from "@shared/schema";

export default function PublicDashboardPage() {
  const params = useParams<{ id: string }>();
  const dashboardId = params.id;

  const { data: dashboard, isLoading, error } = useQuery({
    queryKey: [`/api/public/dashboards/${dashboardId}`],
    enabled: !!dashboardId,
  });

  if (!dashboardId) {
    return <div className="flex-1 flex items-center justify-center">
      <div className="text-center">
        <h2 className="text-2xl font-bold mb-4">Invalid Dashboard Link</h2>
        <p className="text-muted-foreground">The dashboard link appears to be invalid.</p>
      </div>
    </div>;
  }

  if (isLoading) {
    return <div className="flex-1 flex items-center justify-center">
      <Card className="animate-pulse p-8">
        <div className="flex items-center space-x-4">
          <div className="w-8 h-8 bg-muted rounded"></div>
          <div className="h-4 bg-muted rounded w-48"></div>
        </div>
      </Card>
    </div>;
  }

  if (error || !dashboard) {
    return <div className="flex-1 flex items-center justify-center">
      <div className="text-center">
        <Shield className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
        <h2 className="text-2xl font-bold mb-4">Dashboard Not Available</h2>
        <p className="text-muted-foreground mb-4">
          This dashboard is either private or doesn't exist.
        </p>
        <Button onClick={() => window.location.href = '/'} variant="outline">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Go to Login
        </Button>
      </div>
    </div>;
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-background">
      <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="flex items-center justify-between p-4">
          <div className="flex items-center space-x-4">
            <div className="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center">
              <BarChart3 className="text-primary w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-semibold">{(dashboard as Dashboard).name}</h1>
              {(dashboard as Dashboard).description && (
                <p className="text-sm text-muted-foreground">{(dashboard as Dashboard).description}</p>
              )}
            </div>
          </div>
          <div className="flex items-center space-x-2 text-sm text-muted-foreground">
            <Shield className="w-4 h-4" />
            <span>Public Dashboard</span>
          </div>
        </div>
      </header>
      
      <DashboardCanvas 
        dashboard={dashboard as Dashboard}
        onBack={() => {}}
      />
    </div>
  );
}