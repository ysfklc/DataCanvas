import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BarChart3, Calendar, User, ArrowLeft, ExternalLink } from "lucide-react";
import { Link } from "wouter";
import type { Dashboard } from "@shared/schema";

export default function PublicDashboardsPage() {
  const { data: dashboards = [], isLoading, error } = useQuery({
    queryKey: ["/api/public/dashboards"],
  });

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <BarChart3 className="w-16 h-16 text-muted-foreground mx-auto mb-4 animate-pulse" />
          <h2 className="text-xl font-semibold mb-2">Loading dashboards...</h2>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <BarChart3 className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
          <h2 className="text-2xl font-bold mb-4">Error Loading Dashboards</h2>
          <p className="text-muted-foreground mb-4">
            Unable to load public dashboards. Please try again later.
          </p>
          <Button onClick={() => window.location.reload()} variant="outline">
            Try Again
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
                <BarChart3 className="text-primary w-6 h-6" />
              </div>
              <div>
                <h1 className="text-2xl font-bold">Public Dashboards</h1>
                <p className="text-muted-foreground">Explore publicly available data visualizations</p>
              </div>
            </div>
            <Link href="/login">
              <Button variant="outline" size="sm">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Login
              </Button>
            </Link>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        {dashboards.length === 0 ? (
          <div className="text-center py-16">
            <BarChart3 className="w-24 h-24 text-muted-foreground mx-auto mb-6" />
            <h2 className="text-2xl font-bold mb-4">No Public Dashboards</h2>
            <p className="text-muted-foreground max-w-md mx-auto">
              There are currently no public dashboards available to view. 
              Check back later or contact an administrator to make dashboards public.
            </p>
          </div>
        ) : (
          <>
            <div className="mb-8">
              <h2 className="text-xl font-semibold mb-2">
                Available Dashboards ({(dashboards as Dashboard[]).length})
              </h2>
              <p className="text-muted-foreground">
                Click on any dashboard to explore its data visualizations
              </p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {(dashboards as Dashboard[]).map((dashboard: Dashboard) => (
                <Link key={dashboard.id} href={`/public/dashboard/${dashboard.id}`}>
                  <Card className="h-full hover:shadow-md transition-shadow cursor-pointer group">
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <CardTitle className="text-lg mb-2 group-hover:text-primary transition-colors line-clamp-2">
                            {dashboard.name}
                          </CardTitle>
                          {dashboard.description && (
                            <p className="text-sm text-muted-foreground line-clamp-3">
                              {dashboard.description}
                            </p>
                          )}
                        </div>
                        <ExternalLink className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors flex-shrink-0 ml-2 mt-1" />
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <div className="flex items-center space-x-4">
                          <div className="flex items-center space-x-1">
                            <User className="w-3 h-3" />
                            <span>Public</span>
                          </div>
                          <div className="flex items-center space-x-1">
                            <Calendar className="w-3 h-3" />
                            <span>
                              {new Date(dashboard.updatedAt).toLocaleDateString()}
                            </span>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          </>
        )}
      </main>
    </div>
  );
}