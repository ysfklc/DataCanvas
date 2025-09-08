import { useState, useEffect } from "react";
import { useLocation, Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { BarChart3, ArrowLeft, CheckCircle, AlertCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

export default function PasswordReset() {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [isTokenValid, setIsTokenValid] = useState<boolean | null>(null);
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  // Extract token from URL
  const urlParams = new URLSearchParams(window.location.search);
  const token = urlParams.get("token");

  useEffect(() => {
    if (!token) {
      setIsTokenValid(false);
      return;
    }

    // Verify token validity
    const verifyToken = async () => {
      try {
        await apiRequest("GET", `/api/auth/verify-reset-token?token=${token}`);
        setIsTokenValid(true);
      } catch (error) {
        setIsTokenValid(false);
        toast({
          title: "Invalid or expired link",
          description: "This password reset link is invalid or has expired.",
          variant: "destructive",
        });
      }
    };

    verifyToken();
  }, [token, toast]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (password !== confirmPassword) {
      toast({
        title: "Passwords don't match",
        description: "Please make sure both passwords are the same.",
        variant: "destructive",
      });
      return;
    }

    if (password.length < 6) {
      toast({
        title: "Password too short",
        description: "Password must be at least 6 characters long.",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);

    try {
      await apiRequest("POST", "/api/auth/password-reset", { token, password });
      
      setIsSuccess(true);
      toast({
        title: "Password reset successful",
        description: "Your password has been updated successfully.",
      });
      
      // Redirect to login after 3 seconds
      setTimeout(() => {
        setLocation("/login");
      }, 3000);
    } catch (error) {
      console.error("Password reset error:", error);
      toast({
        title: "Error",
        description: "Failed to reset password. The link may have expired.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (isTokenValid === false || !token) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md shadow-2xl">
          <CardHeader className="text-center pb-8">
            <div className="w-16 h-16 bg-red-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <AlertCircle className="text-white w-8 h-8" />
            </div>
            <h1 className="text-2xl font-bold text-foreground">Invalid Link</h1>
            <p className="text-muted-foreground mt-2">This password reset link is invalid or has expired</p>
          </CardHeader>
          
          <CardContent className="text-center space-y-6">
            <p className="text-sm text-muted-foreground">
              Password reset links expire after 30 minutes for security reasons.
            </p>
            
            <div className="space-y-3">
              <Link href="/password-reset-request">
                <Button className="w-full" data-testid="button-request-new">
                  Request New Password Reset
                </Button>
              </Link>
              <Link href="/login">
                <Button variant="outline" className="w-full" data-testid="button-back-login">
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Back to Login
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isSuccess) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md shadow-2xl">
          <CardHeader className="text-center pb-8">
            <div className="w-16 h-16 bg-green-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="text-white w-8 h-8" />
            </div>
            <h1 className="text-2xl font-bold text-foreground">Password Reset Successful</h1>
            <p className="text-muted-foreground mt-2">Your password has been updated successfully</p>
          </CardHeader>
          
          <CardContent className="text-center space-y-6">
            <p className="text-sm text-muted-foreground">
              You will be redirected to the login page shortly.
            </p>
            
            <Link href="/login">
              <Button className="w-full" data-testid="button-login-now">
                Login Now
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isTokenValid === null) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md shadow-2xl">
          <CardContent className="text-center py-12">
            <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full mx-auto mb-4"></div>
            <p className="text-muted-foreground">Verifying password reset link...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md shadow-2xl">
        <CardHeader className="text-center pb-8">
          <div className="w-16 h-16 bg-primary rounded-2xl flex items-center justify-center mx-auto mb-4">
            <BarChart3 className="text-primary-foreground w-8 h-8" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">Create New Password</h1>
          <p className="text-muted-foreground mt-2">Enter your new password below</p>
        </CardHeader>
        
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="password" className="text-sm font-medium text-foreground">
                New Password
              </Label>
              <Input
                id="password"
                type="password"
                placeholder="Enter new password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full"
                data-testid="input-password"
                required
                minLength={6}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="confirmPassword" className="text-sm font-medium text-foreground">
                Confirm New Password
              </Label>
              <Input
                id="confirmPassword"
                type="password"
                placeholder="Confirm new password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full"
                data-testid="input-confirm-password"
                required
                minLength={6}
              />
            </div>
            
            <div className="text-xs text-muted-foreground">
              Password must be at least 6 characters long.
            </div>
            
            <Button 
              type="submit" 
              className="w-full bg-primary text-primary-foreground hover:bg-primary/90"
              disabled={isLoading}
              data-testid="button-reset-password"
            >
              {isLoading ? "Updating Password..." : "Update Password"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}