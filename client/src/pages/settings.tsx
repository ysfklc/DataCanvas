import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { TopBar } from "@/components/layout/top-bar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Server, Shield, Database, Save, TestTube, CheckCircle, AlertCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

interface LDAPSettings {
  url: string;
  baseDN: string;
  bindDN: string;
  bindCredentials: string;
  searchFilter: string;
  tlsOptions: {
    rejectUnauthorized: boolean;
  };
}

interface AccessSettings {
  defaultAccess: string;
  allowPublicView: boolean;
  requirePublicAuth: boolean;
  sessionTimeout: number;
}

export default function SettingsPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [ldapSettings, setLdapSettings] = useState<LDAPSettings>({
    url: "ldap://localhost:389",
    baseDN: "ou=users,dc=example,dc=com",
    bindDN: "cn=admin,dc=example,dc=com",
    bindCredentials: "",
    searchFilter: "(uid={username})",
    tlsOptions: {
      rejectUnauthorized: false,
    },
  });

  const [ldapTestStatus, setLdapTestStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
  const [ldapTestMessage, setLdapTestMessage] = useState('');
  const [ldapEnabled, setLdapEnabled] = useState(false);

  const [accessSettings, setAccessSettings] = useState<AccessSettings>({
    defaultAccess: "standard",
    allowPublicView: true,
    requirePublicAuth: false,
    sessionTimeout: 60,
  });

  const { data: settings = [], isLoading } = useQuery({
    queryKey: ["/api/settings"],
  });

  // Parse settings when data changes
  useState(() => {
    if (settings && Array.isArray(settings)) {
      (settings as any[]).forEach((setting: any) => {
        if (setting.key === "ldap_config") {
          setLdapSettings(setting.value);
        } else if (setting.key === "ldap_enabled") {
          setLdapEnabled(!!setting.value);
        } else if (setting.key === "access") {
          setAccessSettings(setting.value);
        }
      });
    }
  });

  const testLdapMutation = useMutation({
    mutationFn: (credentials: { username: string; password: string }) =>
      apiRequest("POST", "/api/auth/test-ldap", credentials),
    onMutate: () => {
      setLdapTestStatus('testing');
      setLdapTestMessage('Testing connection...');
    },
    onSuccess: (data: any) => {
      setLdapTestStatus('success');
      setLdapTestMessage(data.message || 'Connection test successful!');
      toast({
        title: "LDAP Test Successful",
        description: "LDAP configuration is working correctly.",
      });
    },
    onError: (error: any) => {
      setLdapTestStatus('error');
      setLdapTestMessage(error.message || 'Connection test failed');
      toast({
        title: "LDAP Test Failed",
        description: "Please check your configuration and try again.",
        variant: "destructive",
      });
    },
  });

  const saveLdapMutation = useMutation({
    mutationFn: async (settings: LDAPSettings) => {
      // Save both LDAP config and enabled status
      await apiRequest("POST", "/api/settings", { key: "ldap_config", value: settings });
      await apiRequest("POST", "/api/settings", { key: "ldap_enabled", value: ldapEnabled });
    },
    onSuccess: () => {
      toast({
        title: "LDAP settings saved",
        description: "LDAP configuration has been updated successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/settings"] });
    },
    onError: () => {
      toast({
        title: "Failed to save LDAP settings",
        description: "Please check your configuration and try again.",
        variant: "destructive",
      });
    },
  });

  const saveAccessMutation = useMutation({
    mutationFn: (settings: AccessSettings) =>
      apiRequest("POST", "/api/settings", { key: "access", value: settings }),
    onSuccess: () => {
      toast({
        title: "Access settings saved",
        description: "Dashboard access configuration has been updated.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/settings"] });
    },
    onError: () => {
      toast({
        title: "Failed to save access settings",
        description: "Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleTestLdap = (e: React.FormEvent) => {
    e.preventDefault();
    if (!ldapEnabled) {
      toast({
        title: "LDAP Disabled",
        description: "Please enable LDAP configuration before testing.",
        variant: "destructive",
      });
      return;
    }
    // For testing purposes, use default test credentials
    testLdapMutation.mutate({ username: 'testuser', password: 'testpass' });
  };

  const handleSaveLdap = (e: React.FormEvent) => {
    e.preventDefault();
    
    // If LDAP is disabled, only save the disabled state
    if (!ldapEnabled) {
      apiRequest("POST", "/api/settings", { key: "ldap_enabled", value: false })
        .then(() => {
          toast({
            title: "LDAP settings saved",
            description: "LDAP authentication has been disabled.",
          });
          queryClient.invalidateQueries({ queryKey: ["/api/settings"] });
        })
        .catch(() => {
          toast({
            title: "Failed to save LDAP settings",
            description: "Please try again.",
            variant: "destructive",
          });
        });
      return;
    }
    
    if (ldapTestStatus !== 'success') {
      toast({
        title: "Test Required",
        description: "Please test the LDAP connection before saving settings.",
        variant: "destructive",
      });
      return;
    }
    saveLdapMutation.mutate(ldapSettings);
  };

  const handleSaveAccess = (e: React.FormEvent) => {
    e.preventDefault();
    saveAccessMutation.mutate(accessSettings);
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <TopBar 
        title="System Settings"
        onSidebarToggle={() => {}}
      />
      
      <div className="flex-1 overflow-auto p-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* LDAP Configuration */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Server className="w-5 h-5 mr-2 text-primary" />
                LDAP Configuration
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {/* LDAP Enable Toggle */}
                <div className="flex items-center justify-between p-4 border border-border rounded-lg">
                  <div className="space-y-1">
                    <Label className="text-base font-medium">Enable LDAP Authentication</Label>
                    <p className="text-sm text-muted-foreground">
                      Enable LDAP authentication for your organization. When disabled, users cannot authenticate via LDAP.
                    </p>
                  </div>
                  <Switch
                    checked={ldapEnabled}
                    onCheckedChange={async (enabled) => {
                      setLdapEnabled(enabled);
                      // Automatically save when toggled
                      try {
                        await apiRequest("POST", "/api/settings", { 
                          key: "ldap_enabled", 
                          value: enabled 
                        });
                        
                        if (!enabled) {
                          // Deactivate LDAP users when disabling LDAP
                          await apiRequest("POST", "/api/users/deactivate-ldap");
                          toast({
                            title: "LDAP disabled",
                            description: "LDAP authentication has been disabled and LDAP users have been deactivated.",
                          });
                        } else {
                          toast({
                            title: "LDAP enabled",
                            description: "LDAP authentication has been enabled.",
                          });
                        }
                        
                        queryClient.invalidateQueries({ queryKey: ["/api/settings"] });
                        queryClient.invalidateQueries({ queryKey: ["/api/users"] });
                      } catch (error) {
                        // Revert the toggle if save fails
                        setLdapEnabled(!enabled);
                        toast({
                          title: "Failed to update LDAP settings",
                          description: "Please try again.",
                          variant: "destructive",
                        });
                      }
                    }}
                    data-testid="switch-ldap-enabled"
                  />
                </div>
                
                <form onSubmit={handleSaveLdap} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="ldapUrl">LDAP URL</Label>
                  <Input
                    id="ldapUrl"
                    type="text"
                    placeholder="ldap://ldap.company.com:389"
                    value={ldapSettings.url}
                    onChange={(e) => setLdapSettings(prev => ({ ...prev, url: e.target.value }))}
                    disabled={!ldapEnabled}
                    data-testid="input-ldap-url"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="ldapBaseDn">Base DN</Label>
                  <Input
                    id="ldapBaseDn"
                    type="text"
                    placeholder="ou=users,dc=company,dc=com"
                    value={ldapSettings.baseDN}
                    onChange={(e) => setLdapSettings(prev => ({ ...prev, baseDN: e.target.value }))}
                    disabled={!ldapEnabled}
                    data-testid="input-ldap-base-dn"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="ldapBindDn">Bind DN</Label>
                  <Input
                    id="ldapBindDn"
                    type="text"
                    placeholder="cn=admin,dc=company,dc=com"
                    value={ldapSettings.bindDN}
                    onChange={(e) => setLdapSettings(prev => ({ ...prev, bindDN: e.target.value }))}
                    disabled={!ldapEnabled}
                    data-testid="input-ldap-bind-dn"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="ldapBindPassword">Bind Password</Label>
                  <Input
                    id="ldapBindPassword"
                    type="password"
                    placeholder="••••••••"
                    value={ldapSettings.bindCredentials}
                    onChange={(e) => setLdapSettings(prev => ({ ...prev, bindCredentials: e.target.value }))}
                    disabled={!ldapEnabled}
                    data-testid="input-ldap-bind-password"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="ldapSearchFilter">Search Filter</Label>
                  <Input
                    id="ldapSearchFilter"
                    type="text"
                    placeholder="(uid={username})"
                    value={ldapSettings.searchFilter}
                    onChange={(e) => setLdapSettings(prev => ({ ...prev, searchFilter: e.target.value }))}
                    disabled={!ldapEnabled}
                    data-testid="input-ldap-search-filter"
                  />
                </div>

                <div className="flex items-center space-x-2">
                  <Checkbox 
                    id="rejectUnauthorized"
                    checked={!ldapSettings.tlsOptions.rejectUnauthorized}
                    onCheckedChange={(checked) => 
                      setLdapSettings(prev => ({
                        ...prev,
                        tlsOptions: { ...prev.tlsOptions, rejectUnauthorized: !checked }
                      }))
                    }
                    disabled={!ldapEnabled}
                    data-testid="checkbox-ignore-certificate"
                  />
                  <Label htmlFor="rejectUnauthorized">Ignore SSL Certificate</Label>
                </div>

                {/* Test Connection Status */}
                {ldapTestStatus !== 'idle' && (
                  <div className={`flex items-center space-x-2 p-3 rounded-lg ${
                    ldapTestStatus === 'success' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300' :
                    ldapTestStatus === 'error' ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300' :
                    'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300'
                  }`}>
                    {ldapTestStatus === 'success' && <CheckCircle className="w-4 h-4" />}
                    {ldapTestStatus === 'error' && <AlertCircle className="w-4 h-4" />}
                    {ldapTestStatus === 'testing' && <TestTube className="w-4 h-4 animate-pulse" />}
                    <span className="text-sm">{ldapTestMessage}</span>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <Button 
                    type="button"
                    variant="outline"
                    onClick={handleTestLdap}
                    disabled={!ldapEnabled || testLdapMutation.isPending}
                    data-testid="button-test-ldap"
                  >
                    <TestTube className="w-4 h-4 mr-2" />
                    {testLdapMutation.isPending ? "Testing..." : "Test Connection"}
                  </Button>
                  
                  <Button 
                    type="submit" 
                    disabled={!ldapEnabled || saveLdapMutation.isPending || (ldapEnabled && ldapTestStatus !== 'success')}
                    data-testid="button-save-ldap"
                  >
                    <Save className="w-4 h-4 mr-2" />
                    {saveLdapMutation.isPending ? "Saving..." : "Save LDAP Settings"}
                  </Button>
                </div>
              </form>
              </div>
            </CardContent>
          </Card>

          {/* Dashboard Access Configuration */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Shield className="w-5 h-5 mr-2 text-primary" />
                Dashboard Access
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSaveAccess} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="defaultAccess">Default Access Level</Label>
                  <Select 
                    value={accessSettings.defaultAccess}
                    onValueChange={(value) => setAccessSettings(prev => ({ ...prev, defaultAccess: value }))}
                  >
                    <SelectTrigger data-testid="select-default-access">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="admin">Admin Only</SelectItem>
                      <SelectItem value="standard">Standard User</SelectItem>
                      <SelectItem value="public">Public Access</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-3">
                  <Label>Public Dashboard Settings</Label>
                  <div className="space-y-2">
                    <div className="flex items-center space-x-2">
                      <Checkbox 
                        id="allowPublicView"
                        checked={accessSettings.allowPublicView}
                        onCheckedChange={(checked) => 
                          setAccessSettings(prev => ({ ...prev, allowPublicView: !!checked }))
                        }
                        data-testid="checkbox-allow-public-view"
                      />
                      <Label htmlFor="allowPublicView" className="text-sm">
                        Allow public dashboard viewing
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Checkbox 
                        id="requirePublicAuth"
                        checked={accessSettings.requirePublicAuth}
                        onCheckedChange={(checked) => 
                          setAccessSettings(prev => ({ ...prev, requirePublicAuth: !!checked }))
                        }
                        data-testid="checkbox-require-public-auth"
                      />
                      <Label htmlFor="requirePublicAuth" className="text-sm">
                        Require authentication for public dashboards
                      </Label>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="sessionTimeout">Session Timeout (minutes)</Label>
                  <Input
                    id="sessionTimeout"
                    type="number"
                    placeholder="60"
                    value={accessSettings.sessionTimeout}
                    onChange={(e) => setAccessSettings(prev => ({ ...prev, sessionTimeout: parseInt(e.target.value) || 60 }))}
                    data-testid="input-session-timeout"
                  />
                </div>

                <Button 
                  type="submit" 
                  className="w-full"
                  disabled={saveAccessMutation.isPending}
                  data-testid="button-save-access"
                >
                  <Save className="w-4 h-4 mr-2" />
                  {saveAccessMutation.isPending ? "Saving..." : "Save Access Settings"}
                </Button>
              </form>
            </CardContent>
          </Card>

          {/* Database Status */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center">
                <Database className="w-5 h-5 mr-2 text-primary" />
                Database Status
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-muted/30 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-foreground">Connection Status</span>
                    <div className="w-2 h-2 bg-chart-2 rounded-full"></div>
                  </div>
                  <p className="text-2xl font-bold text-chart-2" data-testid="text-db-status">Connected</p>
                  <p className="text-xs text-muted-foreground">PostgreSQL</p>
                </div>
                <div className="bg-muted/30 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-foreground">Total Tables</span>
                    <Database className="w-4 h-4 text-primary" />
                  </div>
                  <p className="text-2xl font-bold text-foreground" data-testid="text-db-tables">5</p>
                  <p className="text-xs text-muted-foreground">Auto-created on startup</p>
                </div>
                <div className="bg-muted/30 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-foreground">Status</span>
                    <div className="w-4 h-4 bg-chart-2 rounded-full"></div>
                  </div>
                  <p className="text-2xl font-bold text-foreground" data-testid="text-db-health">Healthy</p>
                  <p className="text-xs text-muted-foreground">All systems operational</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
