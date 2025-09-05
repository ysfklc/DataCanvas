import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { TopBar } from "@/components/layout/top-bar";
import { DataSourceForm } from "@/components/forms/data-source-form";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Link, Database, Globe, Play, Square, Edit, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import type { DataSource } from "@shared/schema";

const dataSourceIcons = {
  api: Link,
  scraping: Globe,
  database: Database,
};

export default function DataSourcesPage() {
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [selectedDataSource, setSelectedDataSource] = useState<DataSource | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: dataSources = [], isLoading } = useQuery({
    queryKey: ["/api/data-sources"],
  });

  const toggleDataSourceMutation = useMutation({
    mutationFn: (data: { id: string; isActive: boolean }) => 
      apiRequest("PUT", `/api/data-sources/${data.id}`, { isActive: data.isActive }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/data-sources"] });
      toast({
        title: "Data source updated",
        description: "Status changed successfully.",
      });
    },
    onError: () => {
      toast({
        title: "Failed to update data source",
        description: "Please try again.",
        variant: "destructive",
      });
    },
  });

  const deleteDataSourceMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/data-sources/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/data-sources"] });
      toast({
        title: "Data source deleted",
        description: "Data source has been removed successfully.",
      });
    },
    onError: () => {
      toast({
        title: "Failed to delete data source",
        description: "Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleCreateDataSource = () => {
    setIsCreateDialogOpen(true);
  };

  const handleEditDataSource = (dataSource: DataSource) => {
    setSelectedDataSource(dataSource);
    setIsEditDialogOpen(true);
  };

  const handleToggleDataSource = (dataSource: DataSource) => {
    toggleDataSourceMutation.mutate({
      id: dataSource.id,
      isActive: !dataSource.isActive,
    });
  };

  const handleDeleteDataSource = (dataSource: DataSource) => {
    if (window.confirm(`Are you sure you want to delete "${dataSource.name}"?`)) {
      deleteDataSourceMutation.mutate(dataSource.id);
    }
  };

  const getStatusColor = (isActive: boolean) => {
    return isActive ? "text-chart-2" : "text-muted-foreground";
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <TopBar 
        title="Data Sources"
        onSidebarToggle={() => {}}
        showCreateButton={true}
        onCreateClick={handleCreateDataSource}
        createButtonText="Add Data Source"
      />
      
      <div className="flex-1 overflow-auto p-6">
        {isLoading ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
            {[...Array(6)].map((_, i) => (
              <Card key={i} className="animate-pulse">
                <CardContent className="p-6">
                  <div className="h-4 bg-muted rounded w-3/4 mb-4"></div>
                  <div className="space-y-2">
                    <div className="h-3 bg-muted rounded w-1/2"></div>
                    <div className="h-3 bg-muted rounded w-2/3"></div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (dataSources as DataSource[]).length === 0 ? (
          <div className="text-center py-12">
            <Database className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium text-foreground mb-2">No data sources configured</h3>
            <p className="text-muted-foreground mb-4">Add your first data source to start building dashboards</p>
            <Button onClick={handleCreateDataSource} data-testid="button-create-first-data-source">
              Add Data Source
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
            {(dataSources as DataSource[]).map((dataSource: DataSource) => {
              const IconComponent = dataSourceIcons[dataSource.type as keyof typeof dataSourceIcons] || Database;
              
              return (
                <Card key={dataSource.id} data-testid={`card-data-source-${dataSource.id}`}>
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center space-x-3">
                        <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
                          <IconComponent className="w-5 h-5 text-primary" />
                        </div>
                        <div>
                          <h4 className="font-medium text-foreground" data-testid={`text-data-source-name-${dataSource.id}`}>
                            {dataSource.name}
                          </h4>
                          <p className="text-sm text-muted-foreground capitalize" data-testid={`text-data-source-type-${dataSource.id}`}>
                            {dataSource.type}
                          </p>
                        </div>
                      </div>
                      <div className="flex space-x-2">
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className={`p-1 ${
                            dataSource.isActive 
                              ? "text-chart-2 hover:text-chart-2/80" 
                              : "text-muted-foreground hover:text-foreground"
                          }`}
                          onClick={() => handleToggleDataSource(dataSource)}
                          disabled={toggleDataSourceMutation.isPending}
                          title={dataSource.isActive ? "Stop data source" : "Start data source"}
                          data-testid={`button-toggle-data-source-${dataSource.id}`}
                        >
                          {dataSource.isActive ? (
                            <Square className="w-4 h-4" />
                          ) : (
                            <Play className="w-4 h-4" />
                          )}
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="text-muted-foreground hover:text-foreground p-1"
                          onClick={() => handleEditDataSource(dataSource)}
                          data-testid={`button-edit-data-source-${dataSource.id}`}
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="text-muted-foreground hover:text-destructive p-1"
                          onClick={() => handleDeleteDataSource(dataSource)}
                          disabled={deleteDataSourceMutation.isPending}
                          data-testid={`button-delete-data-source-${dataSource.id}`}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Status:</span>
                        <span className={`flex items-center ${getStatusColor(dataSource.isActive)}`}>
                          <div className="w-2 h-2 bg-current rounded-full mr-1"></div>
                          {dataSource.isActive ? "Connected" : "Disconnected"}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Last Pull:</span>
                        <span className="text-foreground">
                          {dataSource.lastPullAt 
                            ? new Date(dataSource.lastPullAt).toLocaleString()
                            : "Never"
                          }
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Created:</span>
                        <span className="text-foreground">
                          {new Date(dataSource.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Add Data Source</DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto pr-2">
            <DataSourceForm 
              onSuccess={() => setIsCreateDialogOpen(false)}
              onCancel={() => setIsCreateDialogOpen(false)}
            />
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Edit Data Source</DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto pr-2">
            <DataSourceForm 
              dataSource={selectedDataSource}
              onSuccess={() => setIsEditDialogOpen(false)}
              onCancel={() => setIsEditDialogOpen(false)}
            />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
