import { useState, useRef, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChartRenderer } from "@/components/charts/chart-renderer";
import { Settings, RotateCcw, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import type { DashboardCard as DashboardCardType } from "@shared/schema";

interface DashboardCardProps {
  card: DashboardCardType;
  onPositionChange: (cardId: string, position: { x: number; y: number }, size?: { width: number; height: number }) => void;
  onEdit?: (card: DashboardCardType) => void;
  isPublic?: boolean;
  canvasRef?: React.RefObject<HTMLDivElement>;
  onNearEdge?: (cardId: string, position: { x: number; y: number }, size: { width: number; height: number }) => void;
}

export function DashboardCard({ card, onPositionChange, onEdit, isPublic = false, canvasRef, onNearEdge }: DashboardCardProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [position, setPosition] = useState(card.position as { x: number; y: number });
  const [size, setSize] = useState(card.size as { width: number; height: number });
  const dragRef = useRef<HTMLDivElement>(null);
  const dragStart = useRef<{ x: number; y: number } | null>(null);
  const resizeStart = useRef<{ x: number; y: number; width: number; height: number } | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const handleMouseDown = (e: React.MouseEvent) => {
    // Prevent dragging in public mode
    if (isPublic) return;
    
    const target = e.target as HTMLElement;
    
    // Don't start dragging if clicking on buttons or resize handles
    if (target.closest('button') || target.classList.contains('resize-handle')) {
      return;
    }
    
    e.preventDefault();
    setIsDragging(true);
    
    // Get canvas offset and scroll position for accurate coordinate calculation
    let canvasRect = { left: 0, top: 0 };
    let scrollLeft = 0;
    let scrollTop = 0;
    
    if (canvasRef?.current) {
      canvasRect = canvasRef.current.getBoundingClientRect();
      scrollLeft = canvasRef.current.scrollLeft;
      scrollTop = canvasRef.current.scrollTop;
    }
    
    dragStart.current = {
      x: e.clientX - canvasRect.left + scrollLeft - position.x,
      y: e.clientY - canvasRect.top + scrollTop - position.y,
    };
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (isDragging && dragStart.current) {
      // Get canvas offset and scroll position for accurate coordinate calculation
      let canvasRect = { left: 0, top: 0 };
      let scrollLeft = 0;
      let scrollTop = 0;
      
      if (canvasRef?.current) {
        canvasRect = canvasRef.current.getBoundingClientRect();
        scrollLeft = canvasRef.current.scrollLeft;
        scrollTop = canvasRef.current.scrollTop;
      }
      
      const newX = Math.max(0, e.clientX - canvasRect.left + scrollLeft - dragStart.current.x);
      const newY = Math.max(0, e.clientY - canvasRect.top + scrollTop - dragStart.current.y);
      
      // Snap to 20px grid
      const snappedX = Math.round(newX / 20) * 20;
      const snappedY = Math.round(newY / 20) * 20;
      
      const newPosition = { x: snappedX, y: snappedY };
      setPosition(newPosition);
      
      // Check if near edge and trigger auto-grow
      if (onNearEdge) {
        onNearEdge(card.id, newPosition, size);
      }
    }
  };

  const handleMouseUp = () => {
    if (isDragging) {
      setIsDragging(false);
      onPositionChange(card.id, position);
    }
    if (isResizing) {
      setIsResizing(false);
      onPositionChange(card.id, position, size);
    }
  };

  // Add resize functionality
  const handleResizeStart = (e: React.MouseEvent) => {
    // Prevent resizing in public mode
    if (isPublic) return;
    
    e.preventDefault();
    e.stopPropagation();
    setIsResizing(true);
    resizeStart.current = {
      x: e.clientX,
      y: e.clientY,
      width: size.width,
      height: size.height,
    };
  };

  const handleResizeMove = (e: MouseEvent) => {
    if (isResizing && resizeStart.current) {
      const deltaX = e.clientX - resizeStart.current.x;
      const deltaY = e.clientY - resizeStart.current.y;
      
      const newWidth = Math.max(200, resizeStart.current.width + deltaX);
      const newHeight = Math.max(150, resizeStart.current.height + deltaY);
      
      // Snap to 20px grid
      const snappedWidth = Math.round(newWidth / 20) * 20;
      const snappedHeight = Math.round(newHeight / 20) * 20;
      
      const newSize = { width: snappedWidth, height: snappedHeight };
      setSize(newSize);
      
      // Trigger auto-grow for resize operations
      if (onNearEdge) {
        onNearEdge(card.id, position, newSize);
      }
    }
  };

  // Add global mouse event listeners when dragging or resizing
  useEffect(() => {
    const handleMove = (e: MouseEvent) => {
      if (isDragging) {
        handleMouseMove(e);
      } else if (isResizing) {
        handleResizeMove(e);
      }
    };

    if (isDragging || isResizing) {
      document.addEventListener("mousemove", handleMove);
      document.addEventListener("mouseup", handleMouseUp);
      
      return () => {
        document.removeEventListener("mousemove", handleMove);
        document.removeEventListener("mouseup", handleMouseUp);
      };
    }
  }, [isDragging, isResizing, position, size]);

  const deleteCardMutation = useMutation({
    mutationFn: () => apiRequest("DELETE", `/api/cards/${card.id}`),
    onSuccess: () => {
      toast({
        title: "Card deleted",
        description: "Dashboard card has been deleted successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboards", card.dashboardId, "cards"] });
    },
    onError: () => {
      toast({
        title: "Failed to delete card",
        description: "Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleRefresh = () => {
    // Refresh chart data by invalidating queries
    queryClient.invalidateQueries({ queryKey: ["/api/data-sources", card.dataSourceId, "data"] });
    toast({
      title: "Card refreshed",
      description: "Dashboard card data has been refreshed.",
    });
  };

  const handleEdit = () => {
    if (onEdit) {
      onEdit(card);
    }
  };

  const handleDelete = () => {
    if (confirm("Are you sure you want to delete this card?")) {
      deleteCardMutation.mutate();
    }
  };

  return (
    <div
      ref={dragRef}
      className={cn(
        "absolute bg-card border border-border rounded-lg shadow-sm transition-all duration-200",
        isDragging ? "cursor-grabbing z-50 shadow-lg" : "cursor-move hover:shadow-md"
      )}
      style={{
        top: `${position.y}px`,
        left: `${position.x}px`,
        width: `${size.width}px`,
        height: `${size.height}px`,
      }}
      onMouseDown={handleMouseDown}
      data-testid={`dashboard-card-${card.id}`}
    >
      <div className="p-4 h-full flex flex-col">
        <div className="flex items-center justify-between mb-3">
          <h4 className="font-medium text-foreground truncate" data-testid={`text-card-title-${card.id}`}>
            {card.title}
          </h4>
          <div className="flex space-x-1">
            <Button 
              variant="ghost" 
              size="sm" 
              className="text-muted-foreground hover:text-foreground p-1 h-6 w-6"
              onClick={handleEdit}
              data-testid={`button-edit-card-${card.id}`}
            >
              <Settings className="w-3 h-3" />
            </Button>
            <Button 
              variant="ghost" 
              size="sm" 
              className="text-muted-foreground hover:text-foreground p-1 h-6 w-6"
              onClick={handleRefresh}
              data-testid={`button-refresh-card-${card.id}`}
            >
              <RotateCcw className="w-3 h-3" />
            </Button>
            <Button 
              variant="ghost" 
              size="sm" 
              className="text-muted-foreground hover:text-destructive p-1 h-6 w-6"
              onClick={handleDelete}
              data-testid={`button-delete-card-${card.id}`}
            >
              <X className="w-3 h-3" />
            </Button>
          </div>
        </div>
        <div className="flex-1 min-h-0">
          <ChartRenderer 
            type={card.visualizationType}
            config={card.config as any}
            dataSourceId={card.dataSourceId}
            isPublic={isPublic}
          />
        </div>
      </div>
      
      {/* Resize handle */}
      <div
        className="resize-handle absolute bottom-0 right-0 w-4 h-4 bg-muted-foreground/20 hover:bg-muted-foreground/40 cursor-se-resize"
        style={{
          clipPath: 'polygon(100% 0%, 0% 100%, 100% 100%)'
        }}
        onMouseDown={handleResizeStart}
      />
    </div>
  );
}
