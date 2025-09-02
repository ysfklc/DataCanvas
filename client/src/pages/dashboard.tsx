import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { TopBar } from "@/components/layout/top-bar";
import { DashboardCanvas } from "@/components/dashboard/dashboard-canvas";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { BarChart3, Users, Server, Edit, Trash2, Globe, Lock } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import type { Dashboard } from "@shared/schema";

export default function DashboardPage() {
  const [selectedDashboard, setSelectedDashboard] = useState<Dashboard | null>(null);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingDashboard, setEditingDashboard] = useState<Dashboard | null>(null);
  const [dashboardName, setDashboardName] = useState("");
  const [dashboardDescription, setDashboardDescription] = useState("");
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: dashboards = [], isLoading } = useQuery({
    queryKey: ["/api/dashboards"],
  });

  const createDashboardMutation = useMutation({
    mutationFn: (data: { name: string; description?: string }) =>
      apiRequest("POST", "/api/dashboards", data),
    onSuccess: () => {
      toast({
        title: "Dashboard created",
        description: "Your dashboard has been created successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboards"] });
      setIsCreateDialogOpen(false);
      setDashboardName("");
      setDashboardDescription("");
    },
    onError: () => {
      toast({
        title: "Failed to create dashboard",
        description: "Please try again.",
        variant: "destructive",
      });
    },
  });

  const updateDashboardMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: { name: string; description?: string; isPublic?: boolean } }) =>
      apiRequest("PUT", `/api/dashboards/${id}`, data),
    onSuccess: () => {
      toast({
        title: "Dashboard updated",
        description: "Your dashboard has been updated successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboards"] });
      setIsEditDialogOpen(false);
      setEditingDashboard(null);
      setDashboardName("");
      setDashboardDescription("");
    },
    onError: () => {
      toast({
        title: "Failed to update dashboard",
        description: "Please try again.",
        variant: "destructive",
      });
    },
  });

  const deleteDashboardMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/dashboards/${id}`),
    onSuccess: () => {
      toast({
        title: "Dashboard deleted",
        description: "Your dashboard has been deleted successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboards"] });
    },
    onError: () => {
      toast({
        title: "Failed to delete dashboard",
        description: "Please try again.",
        variant: "destructive",
      });
    },
  });

  const togglePublicMutation = useMutation({
    mutationFn: ({ id, isPublic }: { id: string; isPublic: boolean }) =>
      apiRequest("PUT", `/api/dashboards/${id}`, { isPublic }),
    onSuccess: () => {
      toast({
        title: "Dashboard visibility updated",
        description: "Dashboard visibility has been changed successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboards"] });
    },
    onError: () => {
      toast({
        title: "Failed to update dashboard",
        description: "Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleCreateDashboard = () => {
    setIsCreateDialogOpen(true);
  };

  const handleOpenDashboard = (dashboard: Dashboard) => {
    setSelectedDashboard(dashboard);
  };

  const handleBackToDashboards = () => {
    setSelectedDashboard(null);
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!dashboardName.trim()) {
      toast({
        title: "Validation error",
        description: "Dashboard name is required.",
        variant: "destructive",
      });
      return;
    }
    createDashboardMutation.mutate({
      name: dashboardName.trim(),
      description: dashboardDescription.trim() || undefined,
    });
  };

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingDashboard || !dashboardName.trim()) {
      toast({
        title: "Validation error",
        description: "Dashboard name is required.",
        variant: "destructive",
      });
      return;
    }
    updateDashboardMutation.mutate({
      id: editingDashboard.id,
      data: {
        name: dashboardName.trim(),
        description: dashboardDescription.trim() || undefined,
      },
    });
  };

  const handleEditDashboard = (dashboard: Dashboard) => {
    setEditingDashboard(dashboard);
    setDashboardName(dashboard.name);
    setDashboardDescription(dashboard.description || "");
    setIsEditDialogOpen(true);
  };

  const handleDeleteDashboard = async (dashboard: Dashboard) => {
    const confirmed = confirm(
      `Are you sure you want to delete "${dashboard.name}"? This action cannot be undone.`
    );
    if (confirmed) {
      deleteDashboardMutation.mutate(dashboard.id);
    }
  };

  const handleTogglePublic = (dashboard: Dashboard) => {
    togglePublicMutation.mutate({
      id: dashboard.id,
      isPublic: !dashboard.isPublic,
    });
  };

  if (selectedDashboard) {
    return (
      <div className="flex-1 flex flex-col overflow-hidden">
        <TopBar 
          title={`${selectedDashboard.name} - Edit Mode`}
          onSidebarToggle={() => {}}
          showCreateButton={true}
          onCreateClick={() => {}}
          createButtonText="Add Card"
        />
        <DashboardCanvas 
          dashboard={selectedDashboard}
          onBack={handleBackToDashboards}
        />
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <TopBar 
        title="Dashboard Overview"
        onSidebarToggle={() => {}}
        showCreateButton={true}
        onCreateClick={handleCreateDashboard}
        createButtonText="New Dashboard"
      />
      
      <div className="flex-1 overflow-auto p-6">
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {[...Array(6)].map((_, i) => (
              <Card key={i} className="animate-pulse">
                <CardContent className="p-6">
                  <div className="h-4 bg-muted rounded w-3/4 mb-2"></div>
                  <div className="h-3 bg-muted rounded w-1/2"></div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (dashboards as Dashboard[]).length === 0 ? (
          <div className="text-center py-12">
            <BarChart3 className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium text-foreground mb-2">No dashboards yet</h3>
            <p className="text-muted-foreground mb-4">Create your first dashboard to get started</p>
            <Button onClick={handleCreateDashboard} data-testid="button-create-first-dashboard">
              Create Dashboard
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {(dashboards as Dashboard[]).map((dashboard: Dashboard) => (
              <Card 
                key={dashboard.id} 
                className="hover:shadow-lg transition-shadow cursor-pointer"
                onClick={() => handleOpenDashboard(dashboard)}
                data-testid={`card-dashboard-${dashboard.id}`}
              >
                <CardContent className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center">
                      <BarChart3 className="text-primary w-6 h-6" />
                    </div>
                    <div className="flex space-x-2">
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="text-muted-foreground hover:text-foreground p-1"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleEditDashboard(dashboard);
                        }}
                        data-testid={`button-edit-dashboard-${dashboard.id}`}
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="text-muted-foreground hover:text-destructive p-1"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteDashboard(dashboard);
                        }}
                        data-testid={`button-delete-dashboard-${dashboard.id}`}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                  <h3 className="text-lg font-semibold text-foreground mb-2" data-testid={`text-dashboard-name-${dashboard.id}`}>
                    {dashboard.name}
                  </h3>
                  <p className="text-muted-foreground text-sm mb-4" data-testid={`text-dashboard-description-${dashboard.id}`}>
                    {dashboard.description || "No description"}
                  </p>
                  <div className="flex items-center justify-between text-sm mb-3">
                    <span className="text-muted-foreground">0 cards</span>
                    <span className="text-muted-foreground">
                      {new Date(dashboard.updatedAt).toLocaleDateString()}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      {dashboard.isPublic ? (
                        <div className="flex items-center text-xs text-chart-2">
                          <Globe className="w-3 h-3 mr-1" />
                          Public
                        </div>
                      ) : (
                        <div className="flex items-center text-xs text-muted-foreground">
                          <Lock className="w-3 h-3 mr-1" />
                          Private
                        </div>
                      )}
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-xs text-muted-foreground hover:text-foreground p-1 h-6"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleTogglePublic(dashboard);
                      }}
                      data-testid={`button-toggle-public-${dashboard.id}`}
                    >
                      {dashboard.isPublic ? "Make Private" : "Make Public"}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Create New Dashboard</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleFormSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="dashboardName">Dashboard Name</Label>
              <Input 
                id="dashboardName" 
                placeholder="My Dashboard" 
                value={dashboardName}
                onChange={(e) => setDashboardName(e.target.value)}
                data-testid="input-dashboard-name"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="dashboardDescription">Description</Label>
              <Textarea 
                id="dashboardDescription" 
                placeholder="Dashboard description..." 
                value={dashboardDescription}
                onChange={(e) => setDashboardDescription(e.target.value)}
                data-testid="textarea-dashboard-description"
              />
            </div>
            <div className="flex space-x-3 pt-4">
              <Button 
                type="button" 
                variant="outline" 
                className="flex-1"
                onClick={() => setIsCreateDialogOpen(false)}
                data-testid="button-cancel-dashboard"
              >
                Cancel
              </Button>
              <Button 
                type="submit" 
                className="flex-1"
                disabled={createDashboardMutation.isPending || !dashboardName.trim()}
                data-testid="button-submit-dashboard"
              >
                {createDashboardMutation.isPending ? "Creating..." : "Create Dashboard"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Dashboard</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleEditSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="editDashboardName">Dashboard Name</Label>
              <Input 
                id="editDashboardName" 
                placeholder="My Dashboard" 
                value={dashboardName}
                onChange={(e) => setDashboardName(e.target.value)}
                data-testid="input-edit-dashboard-name"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="editDashboardDescription">Description</Label>
              <Textarea 
                id="editDashboardDescription" 
                placeholder="Dashboard description..." 
                value={dashboardDescription}
                onChange={(e) => setDashboardDescription(e.target.value)}
                data-testid="textarea-edit-dashboard-description"
              />
            </div>
            <div className="flex space-x-3 pt-4">
              <Button 
                type="button" 
                variant="outline" 
                className="flex-1"
                onClick={() => {
                  setIsEditDialogOpen(false);
                  setEditingDashboard(null);
                  setDashboardName("");
                  setDashboardDescription("");
                }}
                data-testid="button-cancel-edit-dashboard"
              >
                Cancel
              </Button>
              <Button 
                type="submit" 
                className="flex-1"
                disabled={updateDashboardMutation.isPending || !dashboardName.trim()}
                data-testid="button-submit-edit-dashboard"
              >
                {updateDashboardMutation.isPending ? "Updating..." : "Update Dashboard"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
