import { Button } from "@/components/ui/button";
import { Menu, Plus, Sun, Moon } from "lucide-react";
import { useEffect, useState } from "react";

interface TopBarProps {
  title: string;
  onSidebarToggle: () => void;
  showCreateButton?: boolean;
  onCreateClick?: () => void;
  createButtonText?: string;
}

export function TopBar({ 
  title, 
  onSidebarToggle, 
  showCreateButton = false, 
  onCreateClick,
  createButtonText = "Create"
}: TopBarProps) {
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    const isDarkMode = document.documentElement.classList.contains('dark');
    setIsDark(isDarkMode);
  }, []);

  const toggleTheme = () => {
    const newIsDark = !isDark;
    setIsDark(newIsDark);
    
    if (newIsDark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  };

  return (
    <header className="bg-card border-b border-border px-6 py-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Button
            variant="ghost"
            size="sm"
            className="md:hidden text-muted-foreground hover:text-foreground"
            onClick={onSidebarToggle}
            data-testid="button-sidebar-toggle"
          >
            <Menu className="w-5 h-5" />
          </Button>
          <h2 className="text-2xl font-semibold text-foreground" data-testid="page-title">
            {title}
          </h2>
        </div>
        <div className="flex items-center space-x-4">
          {showCreateButton && onCreateClick && (
            <Button 
              onClick={onCreateClick}
              className="bg-primary text-primary-foreground hover:bg-primary/90"
              data-testid="button-create"
            >
              <Plus className="w-4 h-4 mr-2" />
              {createButtonText}
            </Button>
          )}
          <Button 
            variant="ghost" 
            size="sm" 
            className="text-muted-foreground hover:text-foreground"
            onClick={toggleTheme}
            data-testid="button-theme-toggle"
          >
            {isDark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
          </Button>
        </div>
      </div>
    </header>
  );
}
