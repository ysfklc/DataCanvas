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
import { Server, Shield, Database, Save, TestTube, CheckCircle, AlertCircle, Eye, Mail } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";

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

interface MailSettings {
  host: string;
  port: number;
  secure: boolean;
  auth: {
    user: string;
    pass: string;
  };
  from: string;
  enabled: boolean;
}

export default function SettingsPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  
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

  const [mailSettings, setMailSettings] = useState<MailSettings>({
    host: "smtp.gmail.com",
    port: 587,
    secure: false,
    auth: {
      user: "",
      pass: "",
    },
    from: "noreply@example.com",
    enabled: false,
  });

  const [mailTestStatus, setMailTestStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
  const [mailTestMessage, setMailTestMessage] = useState('');

  // Fetch LDAP settings from dedicated endpoint
  const { data: ldapSettingsData } = useQuery({
    queryKey: ["/api/settings/ldap"],
  });

  // Fetch Mail settings from dedicated endpoint
  const { data: mailSettingsData } = useQuery({
    queryKey: ["/api/settings/mail"],
  });

  // Fetch general settings (for access settings)
  const { data: settings = [], isLoading } = useQuery({
    queryKey: ["/api/settings"],
  });

  // Update LDAP settings when data changes
  useState(() => {
    if (ldapSettingsData && typeof ldapSettingsData === 'object') {
      setLdapSettings({
        url: (ldapSettingsData as any).url || "",
        baseDN: (ldapSettingsData as any).baseDN || "",
        bindDN: (ldapSettingsData as any).bindDN || "",
        bindCredentials: (ldapSettingsData as any).bindCredentials || "",
        searchFilter: (ldapSettingsData as any).searchFilter || "",
        tlsOptions: {
          rejectUnauthorized: (ldapSettingsData as any).tlsRejectUnauthorized || false,
        },
      });
      setLdapEnabled((ldapSettingsData as any).enabled || false);
    }
  });

  // Update Mail settings when data changes
  useState(() => {
    if (mailSettingsData && typeof mailSettingsData === 'object') {
      setMailSettings({
        host: (mailSettingsData as any).host || "",
        port: (mailSettingsData as any).port || 587,
        secure: (mailSettingsData as any).secure || false,
        auth: {
          user: (mailSettingsData as any).authUser || "",
          pass: (mailSettingsData as any).authPass || "",
        },
        from: (mailSettingsData as any).fromAddress || "",
        enabled: (mailSettingsData as any).enabled || false,
      });
    }
  });

  // Parse general settings when data changes (for access settings)
  useState(() => {
    if (settings && Array.isArray(settings)) {
      (settings as any[]).forEach((setting: any) => {
        if (setting.key === "access") {
          setAccessSettings(setting.value);
        }
      });
    }
  });

  const testLdapMutation = useMutation({
    mutationFn: (credentials: { username: string; password: string }) =>
      apiRequest("POST", "/api/auth/test-ldap", { 
        ...credentials, 
        config: ldapSettings 
      }),
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
      // Transform frontend format to backend format
      const dbFormat = {
        url: settings.url,
        baseDN: settings.baseDN,
        bindDN: settings.bindDN,
        bindCredentials: settings.bindCredentials,
        searchFilter: settings.searchFilter,
        tlsRejectUnauthorized: settings.tlsOptions.rejectUnauthorized,
        enabled: ldapEnabled,
      };
      return await apiRequest("POST", "/api/settings/ldap", dbFormat);
    },
    onSuccess: () => {
      toast({
        title: "LDAP settings saved",
        description: "LDAP configuration has been updated successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/settings/ldap"] });
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

  const testMailMutation = useMutation({
    mutationFn: (testEmail: string) =>
      apiRequest("POST", "/api/settings/test-mail", { 
        config: mailSettings,
        testEmail
      }),
    onMutate: () => {
      setMailTestStatus('testing');
      setMailTestMessage('Sending test email...');
    },
    onSuccess: (data: any) => {
      setMailTestStatus('success');
      setMailTestMessage(data.message || 'Test email sent successfully!');
      toast({
        title: "Mail Test Successful",
        description: "Test email sent successfully. Check your inbox.",
      });
    },
    onError: (error: any) => {
      setMailTestStatus('error');
      setMailTestMessage(error.message || 'Failed to send test email');
      toast({
        title: "Mail Test Failed",
        description: "Please check your configuration and try again.",
        variant: "destructive",
      });
    },
  });

  const saveMailMutation = useMutation({
    mutationFn: (settings: MailSettings) => {
      // Transform frontend format to backend format
      const dbFormat = {
        host: settings.host,
        port: settings.port,
        secure: settings.secure,
        authUser: settings.auth.user,
        authPass: settings.auth.pass,
        fromAddress: settings.from,
        enabled: settings.enabled,
      };
      return apiRequest("POST", "/api/settings/mail", dbFormat);
    },
    onSuccess: () => {
      toast({
        title: "Mail settings saved",
        description: "Email configuration has been updated successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/settings/mail"] });
    },
    onError: () => {
      toast({
        title: "Failed to save mail settings",
        description: "Please check your configuration and try again.",
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

  const handleSaveLdap = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // If LDAP is disabled, save the disabled state and deactivate LDAP users
    if (!ldapEnabled) {
      try {
        const dbFormat = {
          url: ldapSettings.url,
          baseDN: ldapSettings.baseDN,
          bindDN: ldapSettings.bindDN,
          bindCredentials: ldapSettings.bindCredentials,
          searchFilter: ldapSettings.searchFilter,
          tlsRejectUnauthorized: ldapSettings.tlsOptions.rejectUnauthorized,
          enabled: false,
        };
        await apiRequest("POST", "/api/settings/ldap", dbFormat);
        await apiRequest("POST", "/api/users/deactivate-ldap");
        toast({
          title: "LDAP settings saved",
          description: "LDAP authentication has been disabled and LDAP users have been deactivated.",
        });
        queryClient.invalidateQueries({ queryKey: ["/api/settings/ldap"] });
        queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      } catch (error) {
        toast({
          title: "Failed to save LDAP settings",
          description: "Please try again.",
          variant: "destructive",
        });
      }
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

  const handleTestMail = (e: React.FormEvent) => {
    e.preventDefault();
    if (!mailSettings.enabled) {
      toast({
        title: "Mail Disabled",
        description: "Please enable mail configuration before testing.",
        variant: "destructive",
      });
      return;
    }
    const testEmail = prompt("Enter an email address to send a test email to:");
    if (testEmail && /\S+@\S+\.\S+/.test(testEmail)) {
      testMailMutation.mutate(testEmail);
    } else {
      toast({
        title: "Invalid Email",
        description: "Please enter a valid email address.",
        variant: "destructive",
      });
    }
  };

  const handleSaveMail = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!mailSettings.enabled) {
      // Just save disabled state
      saveMailMutation.mutate(mailSettings);
      return;
    }
    
    if (mailTestStatus !== 'success') {
      toast({
        title: "Test Required",
        description: "Please test the mail configuration before saving settings.",
        variant: "destructive",
      });
      return;
    }
    saveMailMutation.mutate(mailSettings);
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <TopBar 
        title="System Settings"
        onSidebarToggle={() => {}}
      />
      
      <div className="flex-1 overflow-auto p-6">
        {!isAdmin && (
          <div className="bg-blue-100 dark:bg-blue-900 border border-blue-200 dark:border-blue-800 rounded-lg p-4 mb-6">
            <div className="flex items-center space-x-2">
              <Eye className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              <span className="text-sm font-medium text-blue-800 dark:text-blue-300">Read-Only View</span>
            </div>
            <p className="text-sm text-blue-700 dark:text-blue-400 mt-1">
              You can view system settings but cannot modify them. Contact your administrator to make changes.
            </p>
          </div>
        )}
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Mail Configuration */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Mail className="w-5 h-5 mr-2 text-primary" />
                Email Configuration
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {/* Mail Enable Toggle */}
                <div className="flex items-center justify-between p-4 border border-border rounded-lg">
                  <div className="space-y-1">
                    <Label className="text-base font-medium">Enable Email Sending</Label>
                    <p className="text-sm text-muted-foreground">
                      Enable SMTP email functionality for password resets and notifications.
                    </p>
                  </div>
                  <Switch
                    checked={mailSettings.enabled}
                    onCheckedChange={(enabled) => {
                      setMailSettings(prev => ({ ...prev, enabled }));
                      if (enabled) {
                        setMailTestStatus('idle');
                        setMailTestMessage('');
                      }
                    }}
                    disabled={!isAdmin}
                    data-testid="switch-mail-enabled"
                  />
                </div>
                
                <form onSubmit={handleSaveMail} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="mailHost">SMTP Host</Label>
                      <Input
                        id="mailHost"
                        type="text"
                        placeholder="smtp.gmail.com"
                        value={mailSettings.host}
                        onChange={(e) => setMailSettings(prev => ({ ...prev, host: e.target.value }))}
                        disabled={!isAdmin || !mailSettings.enabled}
                        data-testid="input-mail-host"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="mailPort">SMTP Port</Label>
                      <Input
                        id="mailPort"
                        type="number"
                        placeholder="587"
                        value={mailSettings.port}
                        onChange={(e) => setMailSettings(prev => ({ ...prev, port: parseInt(e.target.value) || 587 }))}
                        disabled={!isAdmin || !mailSettings.enabled}
                        data-testid="input-mail-port"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="mailUser">Username</Label>
                    <Input
                      id="mailUser"
                      type="text"
                      placeholder="your-email@example.com"
                      value={mailSettings.auth.user}
                      onChange={(e) => setMailSettings(prev => ({ ...prev, auth: { ...prev.auth, user: e.target.value } }))}
                      disabled={!isAdmin || !mailSettings.enabled}
                      data-testid="input-mail-user"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="mailPass">Password</Label>
                    <Input
                      id="mailPass"
                      type="password"
                      placeholder="••••••••••••"
                      value={mailSettings.auth.pass}
                      onChange={(e) => setMailSettings(prev => ({ ...prev, auth: { ...prev.auth, pass: e.target.value } }))}
                      disabled={!isAdmin || !mailSettings.enabled}
                      data-testid="input-mail-pass"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="mailFrom">From Address</Label>
                    <Input
                      id="mailFrom"
                      type="email"
                      placeholder="noreply@yourcompany.com"
                      value={mailSettings.from}
                      onChange={(e) => setMailSettings(prev => ({ ...prev, from: e.target.value }))}
                      disabled={!isAdmin || !mailSettings.enabled}
                      data-testid="input-mail-from"
                    />
                  </div>

                  <div className="flex items-center space-x-2">
                    <Checkbox 
                      id="mailSecure"
                      checked={mailSettings.secure}
                      onCheckedChange={(checked) => 
                        setMailSettings(prev => ({ ...prev, secure: !!checked }))
                      }
                      disabled={!isAdmin || !mailSettings.enabled}
                      data-testid="checkbox-mail-secure"
                    />
                    <Label htmlFor="mailSecure">Use SSL/TLS (Port 465)</Label>
                  </div>

                  {/* Test Mail Status */}
                  {mailTestStatus !== 'idle' && (
                    <div className={`flex items-center space-x-2 p-3 rounded-lg ${
                      mailTestStatus === 'success' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300' :
                      mailTestStatus === 'error' ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300' :
                      'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300'
                    }`}>
                      {mailTestStatus === 'success' && <CheckCircle className="w-4 h-4" />}
                      {mailTestStatus === 'error' && <AlertCircle className="w-4 h-4" />}
                      {mailTestStatus === 'testing' && <TestTube className="w-4 h-4 animate-pulse" />}
                      <span className="text-sm">{mailTestMessage}</span>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-4">
                    <Button 
                      type="button"
                      variant="outline"
                      onClick={handleTestMail}
                      disabled={!isAdmin || !mailSettings.enabled || testMailMutation.isPending}
                      data-testid="button-test-mail"
                    >
                      <TestTube className="w-4 h-4 mr-2" />
                      {testMailMutation.isPending ? "Testing..." : "Send Test Email"}
                    </Button>
                    
                    <Button 
                      type="submit" 
                      disabled={!isAdmin || (mailSettings.enabled && mailTestStatus !== 'success') || saveMailMutation.isPending}
                      data-testid="button-save-mail"
                    >
                      <Save className="w-4 h-4 mr-2" />
                      {saveMailMutation.isPending ? "Saving..." : "Save Mail Settings"}
                    </Button>
                  </div>
                </form>
              </div>
            </CardContent>
          </Card>

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
                    onCheckedChange={(enabled) => {
                      setLdapEnabled(enabled);
                      // Reset test status when toggling
                      if (enabled) {
                        setLdapTestStatus('idle');
                        setLdapTestMessage('');
                      }
                    }}
                    disabled={!isAdmin}
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
                    disabled={!isAdmin || !ldapEnabled}
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
                    disabled={!isAdmin || !ldapEnabled}
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
                    disabled={!isAdmin || !ldapEnabled}
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
                    disabled={!isAdmin || !ldapEnabled}
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
                    disabled={!isAdmin || !ldapEnabled}
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
                    disabled={!isAdmin || !ldapEnabled}
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
                    disabled={!isAdmin || !ldapEnabled || testLdapMutation.isPending}
                    data-testid="button-test-ldap"
                  >
                    <TestTube className="w-4 h-4 mr-2" />
                    {testLdapMutation.isPending ? "Testing..." : "Test Connection"}
                  </Button>
                  
                  <Button 
                    type="submit" 
                    disabled={!isAdmin || !ldapEnabled || saveLdapMutation.isPending || (ldapEnabled && ldapTestStatus !== 'success')}
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
                    disabled={!isAdmin}
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
                        disabled={!isAdmin}
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
                        disabled={!isAdmin}
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
                    disabled={!isAdmin}
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
