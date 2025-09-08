import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useLocation, Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { BarChart3, Building, Eye } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function Login() {
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const { login } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      await login(identifier, password);
      setLocation("/");
      toast({
        title: "Login successful",
        description: "Welcome to DataBoard!",
      });
    } catch (error) {
      toast({
        title: "Login failed",
        description: "Invalid credentials. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md shadow-2xl">
        <CardHeader className="text-center pb-8">
          <div className="w-16 h-16 bg-primary rounded-2xl flex items-center justify-center mx-auto mb-4">
            <BarChart3 className="text-primary-foreground w-8 h-8" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">Welcome to DataBoard</h1>
          <p className="text-muted-foreground mt-2">Sign in to access your dashboards</p>
        </CardHeader>
        
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="identifier" className="text-sm font-medium text-foreground">
                Email or Username
              </Label>
              <Input
                id="identifier"
                type="text"
                placeholder="admin@example.com"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                className="w-full"
                data-testid="input-identifier"
                required
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="password" className="text-sm font-medium text-foreground">
                Password
              </Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full"
                data-testid="input-password"
                required
              />
            </div>
            
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Checkbox id="remember" data-testid="checkbox-remember" />
                <Label htmlFor="remember" className="text-sm text-muted-foreground">
                  Remember me
                </Label>
              </div>
              <Link href="/password-reset-request" className="text-sm text-primary hover:underline" data-testid="link-forgot-password">
                Forgot password?
              </Link>
            </div>
            
            <Button 
              type="submit" 
              className="w-full bg-primary text-primary-foreground hover:bg-primary/90"
              disabled={isLoading}
              data-testid="button-login"
            >
              {isLoading ? "Signing in..." : "Sign In"}
            </Button>
          </form>

          <div className="mt-6 pt-6 border-t border-border">
            <div className="text-center space-y-3">
              
              <div className="pt-3">
                <p className="text-sm text-muted-foreground mb-3">Or browse without signing in</p>
                <Link href="/public/dashboards">
                  <Button 
                    variant="outline" 
                    className="w-full"
                    data-testid="button-view-public"
                  >
                    <Eye className="w-4 h-4 mr-2" />
                    View Public Dashboards
                  </Button>
                </Link>
              </div>
            </div>
          </div>

        </CardContent>
      </Card>
    </div>
  );
}
