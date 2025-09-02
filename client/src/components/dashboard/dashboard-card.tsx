import { useState, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChartRenderer } from "@/components/charts/chart-renderer";
import { Settings, RotateCcw, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { DashboardCard as DashboardCardType } from "@shared/schema";

interface DashboardCardProps {
  card: DashboardCardType;
  onPositionChange: (cardId: string, position: { x: number; y: number }) => void;
}

export function DashboardCard({ card, onPositionChange }: DashboardCardProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [position, setPosition] = useState(card.position as { x: number; y: number });
  const [size, setSize] = useState(card.size as { width: number; height: number });
  const dragRef = useRef<HTMLDivElement>(null);
  const dragStart = useRef<{ x: number; y: number } | null>(null);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.target === dragRef.current || dragRef.current?.contains(e.target as Node)) {
      setIsDragging(true);
      dragStart.current = {
        x: e.clientX - position.x,
        y: e.clientY - position.y,
      };
    }
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (isDragging && dragStart.current) {
      const newX = Math.max(0, e.clientX - dragStart.current.x);
      const newY = Math.max(0, e.clientY - dragStart.current.y);
      
      // Snap to 20px grid
      const snappedX = Math.round(newX / 20) * 20;
      const snappedY = Math.round(newY / 20) * 20;
      
      setPosition({ x: snappedX, y: snappedY });
    }
  };

  const handleMouseUp = () => {
    if (isDragging) {
      setIsDragging(false);
      onPositionChange(card.id, position);
    }
  };

  // Add global mouse event listeners when dragging
  useState(() => {
    if (isDragging) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
    } else {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    }

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  });

  const handleRefresh = () => {
    // TODO: Refresh card data
    console.log("Refreshing card:", card.id);
  };

  const handleEdit = () => {
    // TODO: Open card edit dialog
    console.log("Editing card:", card.id);
  };

  const handleDelete = () => {
    // TODO: Delete card
    console.log("Deleting card:", card.id);
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
          />
        </div>
      </div>
    </div>
  );
}
