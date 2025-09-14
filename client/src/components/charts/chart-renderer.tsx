import { useQuery } from "@tanstack/react-query";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from "recharts";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { BarChart3, TrendingUp, Table as TableIcon } from "lucide-react";
import { useEffect, useState } from "react";

interface ChartRendererProps {
  type: string;
  config: any;
  dataSourceId: string | null;
  isPublic?: boolean;
}

export function ChartRenderer({ type, config, dataSourceId, isPublic = false }: ChartRendererProps) {
  const [refreshInterval, setRefreshInterval] = useState<number | false>(false);

  // Get data source info to determine refresh settings
  const { data: dataSourceInfo } = useQuery({
    queryKey: ["/api/data-sources", dataSourceId],
    enabled: !!dataSourceId && !isPublic, // Don't fetch data source info for public dashboards
  });

  // Calculate refresh interval in milliseconds
  useEffect(() => {
    if (dataSourceInfo?.config?.refreshInterval && dataSourceInfo?.config?.refreshUnit) {
      const interval = dataSourceInfo.config.refreshInterval;
      const unit = dataSourceInfo.config.refreshUnit;
      
      let milliseconds = 0;
      switch (unit) {
        case 'seconds':
          milliseconds = interval * 1000;
          break;
        case 'minutes':
          milliseconds = interval * 60 * 1000;
          break;
        case 'hours':
          milliseconds = interval * 60 * 60 * 1000;
          break;
        case 'days':
          milliseconds = interval * 24 * 60 * 60 * 1000;
          break;
        case 'weeks':
          milliseconds = interval * 7 * 24 * 60 * 60 * 1000;
          break;
        case 'months':
          milliseconds = interval * 30 * 24 * 60 * 60 * 1000; // Approximate
          break;
        default:
          milliseconds = 5 * 60 * 1000; // Default 5 minutes
      }
      
      // Only enable auto-refresh for reasonable intervals (minimum 10 seconds)
      setRefreshInterval(milliseconds >= 10000 ? milliseconds : false);
    } else {
      setRefreshInterval(false);
    }
  }, [dataSourceInfo]);

  const { data, isLoading, error } = useQuery({
    queryKey: isPublic
      ? ["/api/public/data-sources", dataSourceId, "data"]
      : ["/api/data-sources", dataSourceId, "data"],
    enabled: !!dataSourceId,
    refetchInterval: refreshInterval,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full bg-muted/50 rounded-md">
        <div className="text-center">
          <div className="animate-spin w-6 h-6 border-2 border-primary border-t-transparent rounded-full mx-auto mb-2"></div>
          <p className="text-sm text-muted-foreground">Loading data...</p>
        </div>
      </div>
    );
  }

  if (error || !dataSourceId) {
    return (
      <div className="flex items-center justify-center h-full bg-muted/50 rounded-md">
        <div className="text-center">
          <div className="w-8 h-8 bg-destructive/10 rounded-full flex items-center justify-center mx-auto mb-2">
            <span className="text-destructive text-sm">!</span>
          </div>
          <p className="text-sm text-muted-foreground">
            {error ? "Failed to load data" : "No data source configured"}
          </p>
        </div>
      </div>
    );
  }

  // Render based on visualization type
  switch (type) {
    case "table":
      return (
        <div className="h-full bg-muted/50 rounded-md">
          {(data as any)?.data?.length > 0 ? (
            <div 
              className="h-full overflow-auto scrollbar-thin scrollbar-track-muted scrollbar-thumb-muted-foreground"
              style={{
                scrollbarWidth: 'thin',
                scrollbarColor: 'hsl(var(--muted-foreground)) hsl(var(--muted))'
              }}
            >
              <table className="border-collapse" style={{ minWidth: 'max-content' }}>
                <thead className="[&_tr]:border-b sticky top-0 bg-muted/50">
                  <tr className="border-b transition-colors hover:bg-muted/50">
                    {(data as any).fields?.map((field: string) => {
                      const displayName = (data as any).fieldDisplayNames?.[field] || field;
                      return (
                        <th 
                          key={field}
                          className="h-8 px-4 text-left align-middle font-medium text-muted-foreground whitespace-nowrap min-w-[120px]"
                        >
                          {displayName}
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody className="[&_tr:last-child]:border-0">
                  {(data as any).data.map((row: any, index: number) => (
                    <tr key={index} className="border-b transition-colors hover:bg-muted/50">
                      {(data as any).fields?.map((field: string) => {
                        const value = row[field];
                        let displayValue = value;
                        
                        // Handle nested objects by converting to string
                        if (typeof value === 'object' && value !== null) {
                          displayValue = JSON.stringify(value);
                        } else if (value === null || value === undefined) {
                          displayValue = '';
                        }
                        
                        return (
                          <td 
                            key={field}
                            className="p-4 align-middle whitespace-nowrap text-sm min-w-[120px]"
                          >
                            {String(displayValue)}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <TableIcon className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">No data available</p>
              </div>
            </div>
          )}
        </div>
      );

    case "chart":
      return (
        <div className="h-full bg-muted/50 rounded-md p-2">
          {(data as any)?.data?.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={(data as any).data}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" fontSize={12} />
                <YAxis fontSize={12} />
                <Tooltip />
                <Bar dataKey="value" fill="hsl(var(--primary))" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <BarChart3 className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">No data available</p>
              </div>
            </div>
          )}
        </div>
      );

    case "graph":
      return (
        <div className="h-full bg-muted/50 rounded-md p-2">
          {(data as any)?.data?.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={(data as any).data}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" fontSize={12} />
                <YAxis fontSize={12} />
                <Tooltip />
                <Line type="monotone" dataKey="value" stroke="hsl(var(--primary))" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <TrendingUp className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">No data available</p>
              </div>
            </div>
          )}
        </div>
      );

    default:
      return (
        <div className="flex items-center justify-center h-full bg-muted/50 rounded-md">
          <div className="text-center">
            <div className="w-8 h-8 bg-muted rounded-lg flex items-center justify-center mx-auto mb-2">
              <span className="text-muted-foreground text-sm">?</span>
            </div>
            <p className="text-sm text-muted-foreground">Unknown visualization type</p>
          </div>
        </div>
      );
  }
}
