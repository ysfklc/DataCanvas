import { useState } from "react";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { UserPlus, Save, Search, UserIcon, AlertCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import type { User } from "@shared/schema";

interface UserFormProps {
  user?: User | null;
  onSuccess: () => void;
  onCancel: () => void;
}

export function UserForm({ user, onSuccess, onCancel }: UserFormProps) {
  const [username, setUsername] = useState(user?.username || "");
  const [email, setEmail] = useState(user?.email || "");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState(user?.role || "standard");
  const [authMethod, setAuthMethod] = useState(user?.authMethod || "local");
  const [isActive, setIsActive] = useState(user?.isActive ?? true);
  
  // LDAP search states
  const [ldapSearchUsername, setLdapSearchUsername] = useState("");
  const [ldapSearchStatus, setLdapSearchStatus] = useState<'idle' | 'searching' | 'found' | 'not-found'>('idle');
  const [ldapUserInfo, setLdapUserInfo] = useState<any>(null);
  
  // Check if LDAP is enabled
  const { data: settings = [] } = useQuery({
    queryKey: ["/api/settings"],
  });
  
  const ldapEnabled = (settings as any[]).find((s: any) => s.key === "ldap_enabled")?.value || false;
  
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const createMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/users", data),
    onSuccess: () => {
      toast({
        title: "User created",
        description: "The user has been created successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      onSuccess();
    },
    onError: () => {
      toast({
        title: "Failed to create user",
        description: "Please check the user details and try again.",
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: (data: any) => apiRequest("PUT", `/api/users/${user?.id}`, data),
    onSuccess: () => {
      toast({
        title: "User updated",
        description: "The user has been updated successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      onSuccess();
    },
    onError: () => {
      toast({
        title: "Failed to update user",
        description: "Please check the user details and try again.",
        variant: "destructive",
      });
    },
  });

  const searchLdapMutation = useMutation({
    mutationFn: (username: string) => apiRequest("GET", `/api/auth/search-ldap/${username}`),
    onMutate: () => {
      setLdapSearchStatus('searching');
    },
    onSuccess: (data: any) => {
      setLdapSearchStatus('found');
      setLdapUserInfo(data.user);
      
      // Auto-populate form fields
      if (data.user) {
        setUsername(data.user.username || "");
        setEmail(data.user.email || "");
      }
      
      toast({
        title: "User found",
        description: `Found user: ${data.user.fullName || data.user.username}`,
      });
    },
    onError: (error: any) => {
      setLdapSearchStatus('not-found');
      setLdapUserInfo(null);
      toast({
        title: "User not found",
        description: error.message || "User not found in LDAP directory",
        variant: "destructive",
      });
    },
  });

  const handleLdapSearch = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!ldapSearchUsername.trim()) {
      toast({
        title: "Validation error",
        description: "Please enter a username to search.",
        variant: "destructive",
      });
      return;
    }
    
    searchLdapMutation.mutate(ldapSearchUsername);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // For LDAP users, password is not required
    const isPasswordRequired = authMethod === "local" && !user;
    
    if (!username || !email || (isPasswordRequired && !password)) {
      toast({
        title: "Validation error",
        description: "Please fill in all required fields.",
        variant: "destructive",
      });
      return;
    }

    const data = {
      username,
      email,
      role,
      authMethod,
      isActive,
      ...(password && authMethod === "local" && { password }),
    };

    if (user) {
      updateMutation.mutate(data);
    } else {
      createMutation.mutate(data);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="username">Username</Label>
        <Input
          id="username"
          type="text"
          placeholder="johndoe"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          data-testid="input-username"
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          type="email"
          placeholder="john@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          data-testid="input-email"
          required
        />
      </div>

      {/* Password field - only show for local auth or editing existing users */}
      {(authMethod === "local" || user) && (
        <div className="space-y-2">
          <Label htmlFor="password">
            {user ? "New Password (leave blank to keep current)" : "Password"}
            {authMethod === "ldap" && <span className="text-muted-foreground ml-2">(LDAP users authenticate via LDAP server)</span>}
          </Label>
          <Input
            id="password"
            type="password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            data-testid="input-password"
            required={!user && authMethod === "local"}
            disabled={authMethod === "ldap" && !!user}
          />
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="role">Role</Label>
        <Select value={role} onValueChange={setRole}>
          <SelectTrigger data-testid="select-role">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="admin">Administrator</SelectItem>
            <SelectItem value="standard">Standard User</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="authMethod">Authentication Method</Label>
        <Select value={authMethod} onValueChange={(value) => {
          if (value === "ldap" && !ldapEnabled) {
            toast({
              title: "LDAP Disabled",
              description: "LDAP authentication is currently disabled. Please enable it in system settings.",
              variant: "destructive",
            });
            return;
          }
          setAuthMethod(value);
        }}>
          <SelectTrigger data-testid="select-auth-method">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="local">Local</SelectItem>
            <SelectItem value="ldap" disabled={!ldapEnabled}>
              LDAP {!ldapEnabled ? "(Disabled)" : ""}
            </SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* LDAP User Search */}
      {/* LDAP Not Enabled Warning */}
      {authMethod === "ldap" && !ldapEnabled && (
        <div className="space-y-4 border border-destructive/50 bg-destructive/10 rounded-lg p-4">
          <div className="flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 text-destructive" />
            <Label className="text-sm font-medium text-destructive">LDAP Authentication Disabled</Label>
          </div>
          <p className="text-sm text-muted-foreground">
            LDAP authentication is currently disabled in system settings. Please enable LDAP configuration to use LDAP authentication.
          </p>
        </div>
      )}
      
      {authMethod === "ldap" && !user && ldapEnabled && (
        <div className="space-y-4 border border-border rounded-lg p-4">
          <div className="flex items-center space-x-2">
            <UserIcon className="w-4 h-4 text-primary" />
            <Label className="text-sm font-medium">LDAP User Search</Label>
          </div>
          
          <div className="flex space-x-2">
            <div className="flex-1">
              <Input
                type="text"
                placeholder="Enter LDAP username..."
                value={ldapSearchUsername}
                onChange={(e) => setLdapSearchUsername(e.target.value)}
                data-testid="input-ldap-search"
              />
            </div>
            <Button 
              type="button"
              variant="outline"
              onClick={handleLdapSearch}
              disabled={!ldapEnabled || searchLdapMutation.isPending}
              data-testid="button-ldap-search"
            >
              <Search className="w-4 h-4 mr-2" />
              {searchLdapMutation.isPending ? "Searching..." : "Search"}
            </Button>
          </div>
          
          {/* Search Status */}
          {ldapSearchStatus === 'found' && ldapUserInfo && (
            <div className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300 p-3 rounded-lg">
              <div className="flex items-center space-x-2">
                <UserIcon className="w-4 h-4" />
                <span className="text-sm font-medium">User Found</span>
              </div>
              <div className="mt-2 text-sm">
                <p><strong>Full Name:</strong> {ldapUserInfo.fullName}</p>
                <p><strong>Username:</strong> {ldapUserInfo.username}</p>
                <p><strong>Email:</strong> {ldapUserInfo.email}</p>
                <p className="text-xs text-green-700 dark:text-green-400 mt-1">
                  User information has been automatically populated below.
                </p>
              </div>
            </div>
          )}
          
          {ldapSearchStatus === 'not-found' && (
            <div className="bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300 p-3 rounded-lg">
              <div className="text-sm">
                <p>User not found in LDAP directory. Please check the username and try again.</p>
              </div>
            </div>
          )}
        </div>
      )}

      <div className="flex items-center justify-between">
        <Label htmlFor="isActive">Active User</Label>
        <Switch
          id="isActive"
          checked={isActive}
          onCheckedChange={setIsActive}
          data-testid="switch-is-active"
        />
      </div>

      <div className="flex space-x-3 pt-4 border-t border-border">
        <Button 
          type="button" 
          variant="outline" 
          className="flex-1"
          onClick={onCancel}
          data-testid="button-cancel-user"
        >
          Cancel
        </Button>
        <Button 
          type="submit" 
          className="flex-1"
          disabled={createMutation.isPending || updateMutation.isPending}
          data-testid="button-submit-user"
        >
          {user ? <Save className="w-4 h-4 mr-2" /> : <UserPlus className="w-4 h-4 mr-2" />}
          {user ? "Update" : "Create"} User
        </Button>
      </div>
    </form>
  );
}
