import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Link, Globe, Database, Plus, PlayCircle, CheckCircle, AlertCircle, Clock, Ticket, Headphones, Edit, Star } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { cn } from "@/lib/utils";
import type { DataSource } from "@shared/schema";

interface DataSourceFormProps {
  dataSource?: DataSource | null;
  onSuccess: () => void;
  onCancel: () => void;
}

const dataSourceTypes = [
  { id: "api", name: "API", description: "REST endpoints", icon: Link },
  { id: "jira", name: "JIRA", description: "Issue tracking", icon: Ticket },
  { id: "smax", name: "OpenText SMAX", description: "Service Management", icon: Headphones },
  { id: "scraping", name: "Web Scraping", description: "Extract from web", icon: Globe },
  { id: "database", name: "Database", description: "SQL queries", icon: Database },
];

export function DataSourceForm({ dataSource, onSuccess, onCancel }: DataSourceFormProps) {
  const [selectedType, setSelectedType] = useState(dataSource?.type || "");
  const [name, setName] = useState(dataSource?.name || "");
  const [curlRequest, setCurlRequest] = useState((dataSource?.config as any)?.curlRequest || "");
  const [selectedFields, setSelectedFields] = useState<string[]>((dataSource?.config as any)?.selectedFields || []);
  const [fieldDisplayNames, setFieldDisplayNames] = useState<Record<string, string>>((dataSource?.config as any)?.fieldDisplayNames || {});
  const [refreshInterval, setRefreshInterval] = useState<number>((dataSource?.config as any)?.refreshInterval || 5);
  const [refreshUnit, setRefreshUnit] = useState<string>((dataSource?.config as any)?.refreshUnit || "minutes");
  
  // JIRA-specific states
  const [jiraUrl, setJiraUrl] = useState((dataSource?.config as any)?.jiraUrl || "");
  const [jiraUsername, setJiraUsername] = useState((dataSource?.config as any)?.jiraUsername || "");
  const [jiraPassword, setJiraPassword] = useState((dataSource?.config as any)?.jiraPassword || "");
  const [jiraProjects, setJiraProjects] = useState<any[]>([]);
  const [selectedJiraProject, setSelectedJiraProject] = useState((dataSource?.config as any)?.selectedJiraProject || "");
  const [jiraQuery, setJiraQuery] = useState((dataSource?.config as any)?.jiraQuery || "");
  const [jiraSavedFilters, setJiraSavedFilters] = useState<any[]>([]);
  const [selectedJiraSavedFilter, setSelectedJiraSavedFilter] = useState("");
  
  // SMAX-specific states
  const [smaxUrl, setSmaxUrl] = useState((dataSource?.config as any)?.smaxUrl || "");
  const [smaxUsername, setSmaxUsername] = useState((dataSource?.config as any)?.smaxUsername || "");
  const [smaxPassword, setSmaxPassword] = useState((dataSource?.config as any)?.smaxPassword || "");
  const [smaxServices, setSmaxServices] = useState<any[]>([]);
  const [selectedSmaxService, setSelectedSmaxService] = useState((dataSource?.config as any)?.selectedSmaxService || "");
  const [smaxQuery, setSmaxQuery] = useState((dataSource?.config as any)?.smaxQuery || "");
  const [isTestingDataSource, setIsTestingDataSource] = useState(false);
  const [testResults, setTestResults] = useState<any>(null);
  const [testError, setTestError] = useState<string | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const createMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/data-sources", data),
    onSuccess: () => {
      toast({
        title: "Data source created",
        description: "Your data source has been configured successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/data-sources"] });
      onSuccess();
    },
    onError: () => {
      toast({
        title: "Failed to create data source",
        description: "Please check your configuration and try again.",
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: (data: any) => apiRequest("PUT", `/api/data-sources/${dataSource?.id}`, data),
    onSuccess: () => {
      toast({
        title: "Data source updated",
        description: "Your data source has been updated successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/data-sources"] });
      onSuccess();
    },
    onError: () => {
      toast({
        title: "Failed to update data source",
        description: "Please check your configuration and try again.",
        variant: "destructive",
      });
    },
  });

  const handleTestDataSource = async () => {
    if (!selectedType) {
      toast({
        title: "Please select a data source type",
        variant: "destructive",
      });
      return;
    }

    if (selectedType === "api" && !curlRequest.trim()) {
      toast({
        title: "Please enter a cURL request to test",
        variant: "destructive",
      });
      return;
    }

    if (selectedType === "jira" && (!jiraUrl.trim() || !jiraUsername.trim() || !jiraPassword.trim())) {
      toast({
        title: "Please enter JIRA URL, username, and password to test",
        variant: "destructive",
      });
      return;
    }

    if (selectedType === "smax" && (!smaxUrl.trim() || !smaxUsername.trim() || !smaxPassword.trim())) {
      toast({
        title: "Please enter SMAX URL, username, and password to test",
        variant: "destructive",
      });
      return;
    }

    setIsTestingDataSource(true);
    setTestResults(null);
    setTestError(null);

    try {
      const testData = {
        type: selectedType,
        config: selectedType === "api" 
          ? { curlRequest } 
          : selectedType === "jira"
          ? { jiraUrl, jiraUsername, jiraPassword }
          : selectedType === "smax"
          ? { smaxUrl, smaxUsername, smaxPassword }
          : {},
      };

      const response = await apiRequest("POST", "/api/data-sources/test", testData);
      const responseData = await response.json();
      setTestResults(responseData);
      
      // For JIRA, set the projects and saved filters if returned
      if (selectedType === "jira" && responseData.projects) {
        setJiraProjects(responseData.projects);
        if (responseData.savedFilters) {
          setJiraSavedFilters(responseData.savedFilters);
        }
      }
      
      // For SMAX, set the services if returned
      if (selectedType === "smax" && responseData.services) {
        setSmaxServices(responseData.services);
      }
      
      toast({
        title: "Test successful",
        description: "Data source connection tested successfully!",
      });
    } catch (error: any) {
      const errorMessage = error.message || "Failed to test data source";
      setTestError(errorMessage);
      toast({
        title: "Test failed",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsTestingDataSource(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedType || !name) {
      toast({
        title: "Validation error",
        description: "Please fill in all required fields.",
        variant: "destructive",
      });
      return;
    }

    let config = {};
    if (selectedType === "api") {
      config = { curlRequest, selectedFields, fieldDisplayNames, refreshInterval, refreshUnit };
    } else if (selectedType === "jira") {
      config = { jiraUrl, jiraUsername, jiraPassword, selectedJiraProject, jiraQuery, selectedJiraSavedFilter, selectedFields, fieldDisplayNames, refreshInterval, refreshUnit };
    } else if (selectedType === "smax") {
      config = { smaxUrl, smaxUsername, smaxPassword, selectedSmaxService, smaxQuery, selectedFields, fieldDisplayNames, refreshInterval, refreshUnit };
    }
    
    const data = {
      name,
      type: selectedType,
      config,
    };

    if (dataSource) {
      updateMutation.mutate(data);
    } else {
      createMutation.mutate(data);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-4">
        <Label className="text-sm font-medium text-foreground">Data Source Type</Label>
        <div className="grid grid-cols-3 gap-4">
          {dataSourceTypes.map((type) => {
            const IconComponent = type.icon;
            return (
              <Card 
                key={type.id}
                className={cn(
                  "cursor-pointer transition-colors hover:bg-accent",
                  selectedType === type.id && "ring-2 ring-primary bg-accent"
                )}
                onClick={() => setSelectedType(type.id)}
                data-testid={`card-data-source-type-${type.id}`}
              >
                <CardContent className="p-4 text-center">
                  <IconComponent className="w-8 h-8 mx-auto mb-2 text-primary" />
                  <p className="font-medium text-foreground">{type.name}</p>
                  <p className="text-xs text-muted-foreground">{type.description}</p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="dataSourceName">Data Source Name</Label>
        <Input
          id="dataSourceName"
          type="text"
          placeholder="My API Source"
          value={name}
          onChange={(e) => setName(e.target.value)}
          data-testid="input-data-source-name"
          required
        />
      </div>

      {selectedType === "api" && (
        <div className="space-y-2">
          <Label htmlFor="curlRequest">cURL Request</Label>
          <Textarea
            id="curlRequest"
            placeholder="curl -X GET 'https://api.example.com/data' -H 'Authorization: Bearer TOKEN'"
            value={curlRequest}
            onChange={(e) => setCurlRequest(e.target.value)}
            className="h-24"
            data-testid="textarea-curl-request"
          />
          <div className="bg-muted/30 rounded-md p-3 text-sm text-muted-foreground">
            <p>• Import your cURL request to automatically parse JSON fields</p>
            <p>• Map response fields to dashboard card data</p>
            <p>• Configure data transformations and filters</p>
          </div>
          
          {curlRequest.trim() && (
            <Button
              type="button"
              variant="secondary"
              onClick={handleTestDataSource}
              disabled={isTestingDataSource}
              className="w-full"
              data-testid="button-test-data-source"
            >
              <PlayCircle className="w-4 h-4 mr-2" />
              {isTestingDataSource ? "Testing..." : "Test Data Source"}
            </Button>
          )}
          
          {/* Refresh Interval Configuration */}
          <div className="space-y-2 pt-4 border-t border-border">
            <Label className="text-sm font-medium text-foreground flex items-center">
              <Clock className="w-4 h-4 mr-2" />
              Auto-Refresh Interval
            </Label>
            <div className="flex gap-2">
              <div className="flex-1">
                <Input
                  type="number"
                  min="1"
                  max="999"
                  placeholder="5"
                  value={refreshInterval}
                  onChange={(e) => setRefreshInterval(parseInt(e.target.value) || 5)}
                  className="w-full"
                  data-testid="input-refresh-interval"
                />
              </div>
              <div className="w-32">
                <Select value={refreshUnit} onValueChange={setRefreshUnit}>
                  <SelectTrigger data-testid="select-refresh-unit">
                    <SelectValue placeholder="Unit" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="seconds">Seconds</SelectItem>
                    <SelectItem value="minutes">Minutes</SelectItem>
                    <SelectItem value="hours">Hours</SelectItem>
                    <SelectItem value="days">Days</SelectItem>
                    <SelectItem value="weeks">Weeks</SelectItem>
                    <SelectItem value="months">Months</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Dashboard cards will automatically refresh data every {refreshInterval} {refreshUnit}.
            </p>
          </div>
        </div>
      )}

      {selectedType === "jira" && (
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="jiraUrl">JIRA URL</Label>
            <Input
              id="jiraUrl"
              type="url"
              placeholder="https://your-company.atlassian.net"
              value={jiraUrl}
              onChange={(e) => setJiraUrl(e.target.value)}
              data-testid="input-jira-url"
              required
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="jiraUsername">JIRA Username</Label>
            <Input
              id="jiraUsername"
              type="text"
              placeholder="your.email@company.com"
              value={jiraUsername}
              onChange={(e) => setJiraUsername(e.target.value)}
              data-testid="input-jira-username"
              required
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="jiraPassword">JIRA Password/API Token</Label>
            <Input
              id="jiraPassword"
              type="password"
              placeholder="Your API token"
              value={jiraPassword}
              onChange={(e) => setJiraPassword(e.target.value)}
              data-testid="input-jira-password"
              required
            />
            <p className="text-xs text-muted-foreground">
              For Atlassian Cloud, use an API token instead of your password. Generate one at: Account Settings → Security → API tokens
            </p>
          </div>
          
          {jiraUrl.trim() && jiraUsername.trim() && jiraPassword.trim() && (
            <Button
              type="button"
              variant="secondary"
              onClick={handleTestDataSource}
              disabled={isTestingDataSource}
              className="w-full"
              data-testid="button-test-jira-connection"
            >
              <PlayCircle className="w-4 h-4 mr-2" />
              {isTestingDataSource ? "Testing..." : "Test JIRA Connection"}
            </Button>
          )}
          
          {jiraProjects.length > 0 && (
            <div className="space-y-2">
              <Label htmlFor="jiraProject">JIRA Project</Label>
              <Select value={selectedJiraProject} onValueChange={setSelectedJiraProject}>
                <SelectTrigger data-testid="select-jira-project">
                  <SelectValue placeholder="Select a project" />
                </SelectTrigger>
                <SelectContent>
                  {jiraProjects.map((project) => (
                    <SelectItem key={project.key} value={project.key}>
                      {project.name} ({project.key})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          
          {/* Saved Filters Selection */}
          {jiraSavedFilters.length > 0 && selectedJiraProject && (
            <div className="space-y-2">
              <Label htmlFor="jiraSavedFilter">Use Saved Filter</Label>
              <Select 
                value={selectedJiraSavedFilter} 
                onValueChange={(value) => {
                  setSelectedJiraSavedFilter(value);
                  if (value === "custom") {
                    setJiraQuery(""); // Clear custom query when switching to custom
                  } else if (value) {
                    // Find the selected filter and set its JQL (fix ID type mismatch)
                    const filter = jiraSavedFilters.find(f => String(f.id) === value);
                    if (filter) {
                      setJiraQuery(filter.jql || "");
                    }
                  }
                }}
              >
                <SelectTrigger data-testid="select-jira-saved-filter">
                  <SelectValue placeholder="Select saved filter or custom JQL" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="custom">
                    <div className="flex items-center">
                      <Edit className="w-4 h-4 mr-2" />
                      Custom JQL Query
                    </div>
                  </SelectItem>
                  {jiraSavedFilters.map((filter) => (
                    <SelectItem key={filter.id} value={String(filter.id)}>
                      <div className="flex items-center">
                        {filter.favourite && <Star className="w-4 h-4 mr-2 text-yellow-500" />}
                        <div>
                          <div className="font-medium">{filter.name}</div>
                          {filter.description && (
                            <div className="text-xs text-muted-foreground">{filter.description}</div>
                          )}
                          <div className="text-xs text-muted-foreground">by {filter.owner}</div>
                        </div>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedJiraSavedFilter && selectedJiraSavedFilter !== "custom" && (
                <div className="bg-muted/30 rounded-md p-3 text-sm text-muted-foreground">
                  <p><strong>Filter JQL:</strong> {jiraSavedFilters.find(f => String(f.id) === selectedJiraSavedFilter)?.jql}</p>
                </div>
              )}
            </div>
          )}
          
          {selectedJiraProject && (
            <div className="space-y-2">
              <Label htmlFor="jiraQuery">JIRA Query (JQL)</Label>
              <Textarea
                id="jiraQuery"
                placeholder="project = MYPROJECT AND status != Done ORDER BY created DESC"
                value={jiraQuery}
                onChange={(e) => setJiraQuery(e.target.value)}
                className="h-20"
                data-testid="textarea-jira-query"
              />
              <div className="bg-muted/30 rounded-md p-3 text-sm text-muted-foreground">
                <p>• Use JQL (JIRA Query Language) to filter issues</p>
                <p>• Example: project = "{selectedJiraProject}" AND assignee = currentUser()</p>
                <p>• Leave empty to fetch all issues from the project</p>
              </div>
              
              {/* Test JIRA query to get fields */}
              <Button
                type="button"
                variant="secondary"
                onClick={async () => {
                  setIsTestingDataSource(true);
                  setTestResults(null);
                  setTestError(null);
                  
                  try {
                    const testData = {
                      type: "jira",
                      config: { jiraUrl, jiraUsername, jiraPassword, selectedJiraProject, jiraQuery }
                    };
                    
                    const response = await apiRequest("POST", "/api/data-sources/test", testData);
                    const responseData = await response.json();
                    
                    // Update saved filters if returned from query test
                    if (responseData.savedFilters) {
                      setJiraSavedFilters(responseData.savedFilters);
                    }
                    
                    // Simulate fetching sample data to show available fields
                    const sampleFields = [
                      'key', 'summary', 'status', 'assignee', 'reporter', 'priority',
                      'issueType', 'created', 'updated', 'resolved', 'project', 'projectKey',
                      'description', 'labels', 'components', 'fixVersions', 'storyPoints', 'sprint'
                    ];
                    
                    setTestResults({ 
                      ...responseData, 
                      fields: sampleFields,
                      message: "JIRA query tested successfully! Select the fields you want to display in your dashboard."
                    });
                    
                    toast({
                      title: "JIRA query test successful",
                      description: "Select the fields you want to display in your dashboard.",
                    });
                  } catch (error: any) {
                    const errorMessage = error.message || "Failed to test JIRA query";
                    setTestError(errorMessage);
                    toast({
                      title: "JIRA query test failed",
                      description: errorMessage,
                      variant: "destructive",
                    });
                  } finally {
                    setIsTestingDataSource(false);
                  }
                }}
                disabled={isTestingDataSource || !selectedJiraProject}
                className="w-full"
                data-testid="button-test-jira-query"
              >
                <PlayCircle className="w-4 h-4 mr-2" />
                {isTestingDataSource ? "Testing Query..." : "Test Query & Select Fields"}
              </Button>
            </div>
          )}
          
          {/* Refresh Interval Configuration for JIRA */}
          {selectedJiraProject && (
            <div className="space-y-2 pt-4 border-t border-border">
              <Label className="text-sm font-medium text-foreground flex items-center">
                <Clock className="w-4 h-4 mr-2" />
                Auto-Refresh Interval
              </Label>
              <div className="flex gap-2">
                <div className="flex-1">
                  <Input
                    type="number"
                    min="1"
                    max="999"
                    placeholder="5"
                    value={refreshInterval}
                    onChange={(e) => setRefreshInterval(parseInt(e.target.value) || 5)}
                    className="w-full"
                    data-testid="input-jira-refresh-interval"
                  />
                </div>
                <div className="w-32">
                  <Select value={refreshUnit} onValueChange={setRefreshUnit}>
                    <SelectTrigger data-testid="select-jira-refresh-unit">
                      <SelectValue placeholder="Unit" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="seconds">Seconds</SelectItem>
                      <SelectItem value="minutes">Minutes</SelectItem>
                      <SelectItem value="hours">Hours</SelectItem>
                      <SelectItem value="days">Days</SelectItem>
                      <SelectItem value="weeks">Weeks</SelectItem>
                      <SelectItem value="months">Months</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Dashboard cards will automatically refresh JIRA data every {refreshInterval} {refreshUnit}.
              </p>
            </div>
          )}
        </div>
      )}

      {selectedType === "smax" && (
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="smaxUrl">SMAX URL</Label>
            <Input
              id="smaxUrl"
              type="url"
              placeholder="https://your-smax-instance.com"
              value={smaxUrl}
              onChange={(e) => setSmaxUrl(e.target.value)}
              data-testid="input-smax-url"
              required
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="smaxUsername">SMAX Username</Label>
            <Input
              id="smaxUsername"
              type="text"
              placeholder="your.username"
              value={smaxUsername}
              onChange={(e) => setSmaxUsername(e.target.value)}
              data-testid="input-smax-username"
              required
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="smaxPassword">SMAX Password</Label>
            <Input
              id="smaxPassword"
              type="password"
              placeholder="Your password"
              value={smaxPassword}
              onChange={(e) => setSmaxPassword(e.target.value)}
              data-testid="input-smax-password"
              required
            />
            <p className="text-xs text-muted-foreground">
              Use your SMAX account credentials to connect to the service management platform
            </p>
          </div>
          
          {smaxUrl.trim() && smaxUsername.trim() && smaxPassword.trim() && (
            <Button
              type="button"
              variant="secondary"
              onClick={handleTestDataSource}
              disabled={isTestingDataSource}
              className="w-full"
              data-testid="button-test-smax-connection"
            >
              <PlayCircle className="w-4 h-4 mr-2" />
              {isTestingDataSource ? "Testing..." : "Test SMAX Connection"}
            </Button>
          )}
          
          {smaxServices.length > 0 && (
            <div className="space-y-2">
              <Label htmlFor="smaxService">Service/Entity Type</Label>
              <Select value={selectedSmaxService} onValueChange={setSelectedSmaxService}>
                <SelectTrigger data-testid="select-smax-service">
                  <SelectValue placeholder="Select a service type" />
                </SelectTrigger>
                <SelectContent>
                  {smaxServices.map((service) => (
                    <SelectItem key={service.name} value={service.name}>
                      {service.displayName || service.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          
          {selectedSmaxService && (
            <div className="space-y-2">
              <Label htmlFor="smaxQuery">SMAX Query Filter</Label>
              <Textarea
                id="smaxQuery"
                placeholder="Status='Open' OR Priority='High'"
                value={smaxQuery}
                onChange={(e) => setSmaxQuery(e.target.value)}
                className="h-20"
                data-testid="textarea-smax-query"
              />
              <div className="bg-muted/30 rounded-md p-3 text-sm text-muted-foreground">
                <p>• Use SMAX query syntax to filter records</p>
                <p>• Example: Status='InProgress' AND AssignedTo='John.Doe'</p>
                <p>• Leave empty to fetch all records of the selected type</p>
              </div>
              
              {/* Test SMAX query to get fields */}
              <Button
                type="button"
                variant="secondary"
                onClick={async () => {
                  setIsTestingDataSource(true);
                  setTestResults(null);
                  setTestError(null);
                  
                  try {
                    const testData = {
                      type: "smax",
                      config: { smaxUrl, smaxUsername, smaxPassword, selectedSmaxService, smaxQuery }
                    };
                    
                    const response = await apiRequest("POST", "/api/data-sources/test", testData);
                    const responseData = await response.json();
                    
                    // Simulate fetching sample data to show available fields
                    const sampleFields = [
                      'Id', 'Title', 'Status', 'Priority', 'AssignedTo', 'RequestedBy',
                      'Category', 'Subcategory', 'CreationTime', 'LastUpdateTime', 'ClosureTime',
                      'Description', 'Service', 'ImpactScope', 'Urgency', 'Phase'
                    ];
                    
                    setTestResults({ 
                      ...responseData, 
                      fields: sampleFields,
                      message: "SMAX query tested successfully! Select the fields you want to display in your dashboard."
                    });
                    
                    toast({
                      title: "SMAX query test successful",
                      description: "Select the fields you want to display in your dashboard.",
                    });
                  } catch (error: any) {
                    const errorMessage = error.message || "Failed to test SMAX query";
                    setTestError(errorMessage);
                    toast({
                      title: "SMAX query test failed",
                      description: errorMessage,
                      variant: "destructive",
                    });
                  } finally {
                    setIsTestingDataSource(false);
                  }
                }}
                disabled={isTestingDataSource || !selectedSmaxService}
                className="w-full"
                data-testid="button-test-smax-query"
              >
                <PlayCircle className="w-4 h-4 mr-2" />
                {isTestingDataSource ? "Testing Query..." : "Test Query & Select Fields"}
              </Button>
            </div>
          )}
          
          {/* Refresh Interval Configuration for SMAX */}
          {selectedSmaxService && (
            <div className="space-y-2 pt-4 border-t border-border">
              <Label className="text-sm font-medium text-foreground flex items-center">
                <Clock className="w-4 h-4 mr-2" />
                Auto-Refresh Interval
              </Label>
              <div className="flex gap-2">
                <div className="flex-1">
                  <Input
                    type="number"
                    min="1"
                    max="999"
                    placeholder="5"
                    value={refreshInterval}
                    onChange={(e) => setRefreshInterval(parseInt(e.target.value) || 5)}
                    className="w-full"
                    data-testid="input-smax-refresh-interval"
                  />
                </div>
                <div className="w-32">
                  <Select value={refreshUnit} onValueChange={setRefreshUnit}>
                    <SelectTrigger data-testid="select-smax-refresh-unit">
                      <SelectValue placeholder="Unit" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="seconds">Seconds</SelectItem>
                      <SelectItem value="minutes">Minutes</SelectItem>
                      <SelectItem value="hours">Hours</SelectItem>
                      <SelectItem value="days">Days</SelectItem>
                      <SelectItem value="weeks">Weeks</SelectItem>
                      <SelectItem value="months">Months</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Dashboard cards will automatically refresh SMAX data every {refreshInterval} {refreshUnit}.
              </p>
            </div>
          )}
        </div>
      )}

      {selectedType === "scraping" && (
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="scrapingUrl">Target URL</Label>
            <Input
              id="scrapingUrl"
              type="url"
              placeholder="https://example.com"
              data-testid="input-scraping-url"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="scrapingSelectors">CSS Selectors</Label>
            <Textarea
              id="scrapingSelectors"
              placeholder="Enter CSS selectors for elements to extract..."
              className="h-24"
              data-testid="textarea-scraping-selectors"
            />
          </div>
        </div>
      )}

      {selectedType === "database" && (
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="dbConnectionString">Connection String</Label>
            <Input
              id="dbConnectionString"
              type="text"
              placeholder="postgresql://user:password@host:port/database"
              data-testid="input-db-connection"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="dbQuery">SQL Query</Label>
            <Textarea
              id="dbQuery"
              placeholder="SELECT * FROM table_name WHERE condition;"
              className="h-24"
              data-testid="textarea-db-query"
            />
          </div>
        </div>
      )}

      {/* Test Results Display */}
      {(testResults || testError) && (
        <div className="space-y-4 p-4 border border-border rounded-lg bg-muted/20">
          <div className="flex items-center justify-between">
            <h3 className="font-medium text-foreground flex items-center">
              {testError ? (
                <AlertCircle className="w-5 h-5 text-destructive mr-2" />
              ) : (
                <CheckCircle className="w-5 h-5 text-green-600 mr-2" />
              )}
              Test Results
            </h3>
          </div>

          {testError && (
            <div className="p-3 bg-destructive/10 rounded border border-destructive/20">
              <p className="text-sm text-destructive font-medium">Error:</p>
              <p className="text-sm text-destructive/80 mt-1">{testError}</p>
            </div>
          )}

          {testResults && (
            <div className="space-y-3">
              {/* Status Code */}
              {testResults.statusCode && (
                <div>
                  <p className="text-sm font-medium text-foreground mb-2">HTTP Status:</p>
                  <div className="p-3 bg-background rounded border border-border">
                    <span className={`inline-flex items-center px-2 py-1 text-xs rounded-md ${
                      testResults.statusCode >= 200 && testResults.statusCode < 300 
                        ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
                        : testResults.statusCode >= 400
                        ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300'  
                        : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300'
                    }`}>
                      {testResults.statusCode}
                    </span>
                  </div>
                </div>
              )}
              
              {/* Raw Response */}
              <div>
                <p className="text-sm font-medium text-foreground mb-2">Response:</p>
                <div className="p-3 bg-background rounded border border-border max-h-64 overflow-auto">
                  <pre className="text-xs text-muted-foreground whitespace-pre-wrap">
                    {JSON.stringify(testResults.response, null, 2)}
                  </pre>
                </div>
              </div>

              {/* Parsed Fields with Selection */}
              {testResults.fields && testResults.fields.length > 0 && (
                <div>
                  <p className="text-sm font-medium text-foreground mb-2">
                    Select Fields to Fetch ({testResults.fields.length} available):
                  </p>
                  <div className="p-3 bg-background rounded border border-border space-y-3">
                    <div className="flex items-center gap-2 pb-2 border-b border-border">
                      <Checkbox
                        id="select-all-fields"
                        checked={selectedFields.length === testResults.fields.length}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setSelectedFields([...testResults.fields]);
                            // Initialize display names for all fields
                            const newDisplayNames = { ...fieldDisplayNames };
                            testResults.fields.forEach((field: string) => {
                              if (!newDisplayNames[field]) {
                                newDisplayNames[field] = field.split('.').pop() || field;
                              }
                            });
                            setFieldDisplayNames(newDisplayNames);
                          } else {
                            setSelectedFields([]);
                          }
                        }}
                        data-testid="checkbox-select-all-fields"
                      />
                      <Label htmlFor="select-all-fields" className="text-sm font-medium">
                        Select All ({selectedFields.length} selected)
                      </Label>
                    </div>
                    <div className="space-y-2 max-h-60 overflow-auto">
                      {testResults.fields.map((field: string, index: number) => (
                        <div key={index} className="flex items-center gap-2">
                          <Checkbox
                            id={`field-${index}`}
                            checked={selectedFields.includes(field)}
                            onCheckedChange={(checked) => {
                              if (checked) {
                                setSelectedFields([...selectedFields, field]);
                                // Initialize display name if not set
                                if (!fieldDisplayNames[field]) {
                                  setFieldDisplayNames({
                                    ...fieldDisplayNames,
                                    [field]: field.split('.').pop() || field
                                  });
                                }
                              } else {
                                setSelectedFields(selectedFields.filter(f => f !== field));
                              }
                            }}
                            data-testid={`checkbox-field-${field}`}
                          />
                          <div className="flex-1 min-w-0">
                            <Label
                              htmlFor={`field-${index}`}
                              className="text-xs font-medium cursor-pointer block truncate"
                              title={field}
                            >
                              {field}
                            </Label>
                            {selectedFields.includes(field) && (
                              <Input
                                type="text"
                                placeholder="Display name"
                                value={fieldDisplayNames[field] || ''}
                                onChange={(e) => {
                                  setFieldDisplayNames({
                                    ...fieldDisplayNames,
                                    [field]: e.target.value
                                  });
                                }}
                                className="mt-1 h-6 text-xs"
                                data-testid={`input-display-name-${field}`}
                              />
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                    {selectedFields.length > 0 && (
                      <div className="pt-2 border-t border-border">
                        <p className="text-xs text-muted-foreground">
                          Selected fields will be used in dashboard cards and charts.
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* JSON Structure */}
              {testResults.structure && (
                <div>
                  <p className="text-sm font-medium text-foreground mb-2">JSON Structure:</p>
                  <div className="p-3 bg-background rounded border border-border max-h-64 overflow-auto">
                    <pre className="text-xs text-muted-foreground whitespace-pre-wrap">
                      {JSON.stringify(testResults.structure, null, 2)}
                    </pre>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      <div className="flex space-x-3 pt-4 border-t border-border">
        <Button 
          type="button" 
          variant="outline" 
          className="flex-1"
          onClick={onCancel}
          data-testid="button-cancel-data-source"
        >
          Cancel
        </Button>
        <Button 
          type="submit" 
          className="flex-1"
          disabled={createMutation.isPending || updateMutation.isPending}
          data-testid="button-submit-data-source"
        >
          <Plus className="w-4 h-4 mr-2" />
          {dataSource ? "Update" : "Create"} Data Source
        </Button>
      </div>
    </form>
  );
}
