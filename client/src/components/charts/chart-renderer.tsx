import { useQuery } from "@tanstack/react-query";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from "recharts";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { BarChart3, TrendingUp, Table as TableIcon } from "lucide-react";

interface ChartRendererProps {
  type: string;
  config: any;
  dataSourceId: string | null;
}

export function ChartRenderer({ type, config, dataSourceId }: ChartRendererProps) {
  const { data, isLoading, error } = useQuery({
    queryKey: ["/api/data-sources", dataSourceId, "data"],
    enabled: !!dataSourceId,
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
        <div className="h-full bg-muted/50 rounded-md overflow-auto">
          {data?.data?.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  {data.fields?.map((field: string) => (
                    <TableHead key={field}>{field}</TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.data.map((row: any, index: number) => (
                  <TableRow key={index}>
                    {data.fields?.map((field: string) => (
                      <TableCell key={field}>{row[field]}</TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
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
          {data?.data?.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.data}>
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
          {data?.data?.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data.data}>
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
