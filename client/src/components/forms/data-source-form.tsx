import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Link, Globe, Database, Plus, PlayCircle, CheckCircle, AlertCircle, Clock } from "lucide-react";
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

    setIsTestingDataSource(true);
    setTestResults(null);
    setTestError(null);

    try {
      const testData = {
        type: selectedType,
        config: selectedType === "api" ? { curlRequest } : {},
      };

      const response = await apiRequest("POST", "/api/data-sources/test", testData);
      const responseData = await response.json();
      setTestResults(responseData);
      
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

    const config = selectedType === "api" ? { curlRequest, selectedFields, fieldDisplayNames, refreshInterval, refreshUnit } : {};
    
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
