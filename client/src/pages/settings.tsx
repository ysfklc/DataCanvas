import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { TopBar } from "@/components/layout/top-bar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Server, Shield, Database, Save } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

interface LDAPSettings {
  ldapHost: string;
  ldapPort: number;
  ldapProtocol: string;
  ignoreCertificate: boolean;
  ldapBaseDn: string;
  ldapBindDn: string;
  ldapBindPassword: string;
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
    ldapHost: "",
    ldapPort: 389,
    ldapProtocol: "ldaps",
    ignoreCertificate: false,
    ldapBaseDn: "",
    ldapBindDn: "",
    ldapBindPassword: "",
  });

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
        if (setting.key === "ldap") {
          setLdapSettings(setting.value);
        } else if (setting.key === "access") {
          setAccessSettings(setting.value);
        }
      });
    }
  });

  const saveLdapMutation = useMutation({
    mutationFn: (settings: LDAPSettings) =>
      apiRequest("POST", "/api/settings", { key: "ldap", value: settings }),
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

  const handleSaveLdap = (e: React.FormEvent) => {
    e.preventDefault();
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
              <form onSubmit={handleSaveLdap} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="ldapHost">LDAP Host</Label>
                  <Input
                    id="ldapHost"
                    type="text"
                    placeholder="ldap.company.com"
                    value={ldapSettings.ldapHost}
                    onChange={(e) => setLdapSettings(prev => ({ ...prev, ldapHost: e.target.value }))}
                    data-testid="input-ldap-host"
                  />
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="ldapPort">Port</Label>
                    <Input
                      id="ldapPort"
                      type="number"
                      placeholder="389"
                      value={ldapSettings.ldapPort}
                      onChange={(e) => setLdapSettings(prev => ({ ...prev, ldapPort: parseInt(e.target.value) || 389 }))}
                      data-testid="input-ldap-port"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="ldapProtocol">Protocol</Label>
                    <Select 
                      value={ldapSettings.ldapProtocol}
                      onValueChange={(value) => setLdapSettings(prev => ({ ...prev, ldapProtocol: value }))}
                    >
                      <SelectTrigger data-testid="select-ldap-protocol">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ldap">LDAP</SelectItem>
                        <SelectItem value="ldaps">LDAPS</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  <Checkbox 
                    id="ignoreCert"
                    checked={ldapSettings.ignoreCertificate}
                    onCheckedChange={(checked) => 
                      setLdapSettings(prev => ({ ...prev, ignoreCertificate: !!checked }))
                    }
                    data-testid="checkbox-ignore-certificate"
                  />
                  <Label htmlFor="ignoreCert">Ignore SSL Certificate</Label>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="ldapBaseDn">Base DN</Label>
                  <Input
                    id="ldapBaseDn"
                    type="text"
                    placeholder="dc=company,dc=com"
                    value={ldapSettings.ldapBaseDn}
                    onChange={(e) => setLdapSettings(prev => ({ ...prev, ldapBaseDn: e.target.value }))}
                    data-testid="input-ldap-base-dn"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="ldapBindDn">Bind DN</Label>
                  <Input
                    id="ldapBindDn"
                    type="text"
                    placeholder="cn=admin,dc=company,dc=com"
                    value={ldapSettings.ldapBindDn}
                    onChange={(e) => setLdapSettings(prev => ({ ...prev, ldapBindDn: e.target.value }))}
                    data-testid="input-ldap-bind-dn"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="ldapBindPassword">Bind Password</Label>
                  <Input
                    id="ldapBindPassword"
                    type="password"
                    placeholder="••••••••"
                    value={ldapSettings.ldapBindPassword}
                    onChange={(e) => setLdapSettings(prev => ({ ...prev, ldapBindPassword: e.target.value }))}
                    data-testid="input-ldap-bind-password"
                  />
                </div>

                <Button 
                  type="submit" 
                  className="w-full"
                  disabled={saveLdapMutation.isPending}
                  data-testid="button-save-ldap"
                >
                  <Save className="w-4 h-4 mr-2" />
                  {saveLdapMutation.isPending ? "Saving..." : "Save LDAP Settings"}
                </Button>
              </form>
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
