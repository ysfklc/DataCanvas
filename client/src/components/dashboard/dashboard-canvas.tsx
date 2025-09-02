import { useState, useRef, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { DashboardCard } from "./dashboard-card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Plus, Save, BarChart3, Table, TrendingUp } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import type { Dashboard, DashboardCard as DashboardCardType, DataSource } from "@shared/schema";

interface DashboardCanvasProps {
  dashboard: Dashboard;
  onBack: () => void;
}

export function DashboardCanvas({ dashboard, onBack }: DashboardCanvasProps) {
  const [isAddCardDialogOpen, setIsAddCardDialogOpen] = useState(false);
  const [cardTitle, setCardTitle] = useState("");
  const [selectedDataSource, setSelectedDataSource] = useState("");
  const [selectedVisualizationType, setSelectedVisualizationType] = useState("");
  const canvasRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: cards = [], isLoading } = useQuery({
    queryKey: ["/api/dashboards", dashboard.id, "cards"],
  });

  const { data: dataSources = [] } = useQuery({
    queryKey: ["/api/data-sources"],
  });

  const createCardMutation = useMutation({
    mutationFn: (data: any) =>
      apiRequest("POST", `/api/dashboards/${dashboard.id}/cards`, data),
    onSuccess: () => {
      toast({
        title: "Card created",
        description: "Your dashboard card has been created successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboards", dashboard.id, "cards"] });
      setIsAddCardDialogOpen(false);
      setCardTitle("");
      setSelectedDataSource("");
      setSelectedVisualizationType("");
    },
    onError: () => {
      toast({
        title: "Failed to create card",
        description: "Please try again.",
        variant: "destructive",
      });
    },
  });

  const visualizationTypes = [
    { id: "table", name: "Table", description: "Display data in rows and columns", icon: Table },
    { id: "chart", name: "Bar Chart", description: "Show data as bars", icon: BarChart3 },
    { id: "graph", name: "Line Graph", description: "Display trends over time", icon: TrendingUp },
  ];

  const handleAddCard = () => {
    setIsAddCardDialogOpen(true);
  };

  const handleSaveDashboard = () => {
    // TODO: Implement save functionality
    console.log("Saving dashboard...");
  };

  const handleCardPositionChange = useCallback((cardId: string, position: { x: number; y: number }) => {
    // TODO: Update card position in the backend
    console.log("Card position changed:", cardId, position);
  }, []);

  const handleCreateCard = (e: React.FormEvent) => {
    e.preventDefault();
    if (!cardTitle.trim() || !selectedVisualizationType) {
      toast({
        title: "Validation error",
        description: "Please fill in all required fields.",
        variant: "destructive",
      });
      return;
    }

    // Calculate position for new card (simple grid layout)
    const existingCardsCount = (cards as DashboardCardType[]).length;
    const x = (existingCardsCount % 3) * 320; // 300px width + 20px margin
    const y = Math.floor(existingCardsCount / 3) * 240; // 200px height + 40px margin

    createCardMutation.mutate({
      title: cardTitle.trim(),
      dataSourceId: selectedDataSource === "none" ? null : selectedDataSource || null,
      visualizationType: selectedVisualizationType,
      position: { x, y },
      size: { width: 300, height: 200 },
      config: {},
    });
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="bg-card border-b border-border p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={onBack}
              className="text-muted-foreground hover:text-foreground"
              data-testid="button-back-to-dashboards"
            >
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <h3 className="text-xl font-semibold text-foreground" data-testid="text-dashboard-name">
              {dashboard.name}
            </h3>
          </div>
          <div className="flex items-center space-x-2">
            <Button 
              variant="secondary" 
              size="sm"
              onClick={handleAddCard}
              data-testid="button-add-card"
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Card
            </Button>
            <Button 
              size="sm"
              onClick={handleSaveDashboard}
              data-testid="button-save-dashboard"
            >
              <Save className="w-4 h-4 mr-2" />
              Save
            </Button>
          </div>
        </div>
      </div>

      <div 
        ref={canvasRef}
        className="flex-1 dashboard-canvas relative bg-muted/30 m-4 rounded-lg overflow-auto"
        style={{ 
          backgroundImage: "radial-gradient(circle, hsl(var(--muted)) 1px, transparent 1px)",
          backgroundSize: "20px 20px"
        }}
        data-testid="dashboard-canvas"
      >
        {isLoading ? (
          <div className="p-4">
            <div className="text-center text-muted-foreground">Loading cards...</div>
          </div>
        ) : (cards as DashboardCardType[]).length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <Plus className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium text-foreground mb-2">No cards yet</h3>
              <p className="text-muted-foreground mb-4">Add your first card to start visualizing data</p>
              <Button onClick={handleAddCard} data-testid="button-add-first-card">
                Add Card
              </Button>
            </div>
          </div>
        ) : (
          (cards as DashboardCardType[]).map((card: DashboardCardType) => (
            <DashboardCard
              key={card.id}
              card={card}
              onPositionChange={handleCardPositionChange}
            />
          ))
        )}
      </div>

      <Dialog open={isAddCardDialogOpen} onOpenChange={setIsAddCardDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Add Dashboard Card</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreateCard} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="cardTitle">Card Title</Label>
              <Input 
                id="cardTitle" 
                placeholder="Sales Overview" 
                value={cardTitle}
                onChange={(e) => setCardTitle(e.target.value)}
                data-testid="input-card-title"
                required
              />
            </div>
            
            <div className="space-y-2">
              <Label>Data Source (Optional)</Label>
              <Select value={selectedDataSource} onValueChange={setSelectedDataSource}>
                <SelectTrigger data-testid="select-data-source">
                  <SelectValue placeholder="Select a data source" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No data source</SelectItem>
                  {(dataSources as DataSource[]).map((dataSource) => (
                    <SelectItem key={dataSource.id} value={dataSource.id}>
                      {dataSource.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Visualization Type</Label>
              <div className="grid grid-cols-3 gap-2">
                {visualizationTypes.map((type) => {
                  const IconComponent = type.icon;
                  return (
                    <Button
                      key={type.id}
                      type="button"
                      variant={selectedVisualizationType === type.id ? "default" : "outline"}
                      className="h-auto p-3 flex flex-col items-center space-y-2"
                      onClick={() => setSelectedVisualizationType(type.id)}
                      data-testid={`button-visualization-${type.id}`}
                    >
                      <IconComponent className="w-6 h-6" />
                      <div className="text-center">
                        <div className="text-sm font-medium">{type.name}</div>
                        <div className="text-xs text-muted-foreground">{type.description}</div>
                      </div>
                    </Button>
                  );
                })}
              </div>
            </div>
            
            <div className="flex space-x-3 pt-4">
              <Button 
                type="button" 
                variant="outline" 
                className="flex-1"
                onClick={() => setIsAddCardDialogOpen(false)}
                data-testid="button-cancel-card"
              >
                Cancel
              </Button>
              <Button 
                type="submit" 
                className="flex-1"
                disabled={createCardMutation.isPending}
                data-testid="button-submit-card"
              >
                <Plus className="w-4 h-4 mr-2" />
                {createCardMutation.isPending ? "Creating..." : "Create Card"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
