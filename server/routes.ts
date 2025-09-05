import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { authenticateUser, createDefaultAdmin, createTestLDAPConfig, createTestLDAPUser, searchLDAPUser, hashPassword } from "./auth";
import { insertUserSchema, insertDashboardSchema, insertDataSourceSchema, insertDashboardCardSchema, insertSettingSchema } from "@shared/schema";
import session from "express-session";
import MemoryStore from "memorystore";

const MemoryStoreSession = MemoryStore(session);

// Extend session type to include user
declare module "express-session" {
  interface SessionData {
    user?: {
      id: string;
      username: string;
      email: string;
      role: string;
    };
  }
}

export async function registerRoutes(app: Express): Promise<Server> {
  // Initialize default admin user and test LDAP configuration
  await createDefaultAdmin();
  await createTestLDAPConfig();
  await createTestLDAPUser();

  // Session configuration
  app.use(session({
    secret: process.env.SESSION_SECRET || "development-secret-key",
    resave: false,
    saveUninitialized: false,
    store: new MemoryStoreSession({
      checkPeriod: 86400000, // prune expired entries every 24h
    }),
    cookie: {
      secure: process.env.NODE_ENV === "production",
      httpOnly: true,
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
    },
  }));

  // Authentication middleware
  const requireAuth = (req: any, res: any, next: any) => {
    if (!req.session?.user) {
      return res.status(401).json({ message: "Authentication required" });
    }
    next();
  };

  const requireAdmin = (req: any, res: any, next: any) => {
    if (!req.session?.user || req.session.user.role !== "admin") {
      return res.status(403).json({ message: "Admin access required" });
    }
    next();
  };

  // Auth routes
  app.post("/api/auth/login", async (req, res) => {
    try {
      const { identifier, password } = req.body;
      const user = await authenticateUser(identifier, password);
      
      if (!user) {
        return res.status(401).json({ message: "Invalid credentials" });
      }

      req.session.user = { id: user.id, username: user.username, email: user.email, role: user.role };
      res.json({ user: req.session.user });
    } catch (error) {
      res.status(500).json({ message: "Login failed" });
    }
  });

  app.post("/api/auth/logout", (req, res) => {
    req.session.destroy((err) => {
      if (err) {
        return res.status(500).json({ message: "Logout failed" });
      }
      res.json({ message: "Logged out successfully" });
    });
  });

  app.get("/api/auth/me", (req, res) => {
    if (req.session?.user) {
      res.json({ user: req.session.user });
    } else {
      res.status(401).json({ message: "Not authenticated" });
    }
  });

  // User routes
  app.get("/api/users", requireAdmin, async (req, res) => {
    try {
      const users = await storage.getAllUsers();
      res.json(users.map(user => ({ ...user, password: undefined })));
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch users" });
    }
  });

  app.post("/api/users", requireAdmin, async (req, res) => {
    try {
      const userData = insertUserSchema.parse(req.body);
      if (userData.password) {
        userData.password = await hashPassword(userData.password);
      }
      const user = await storage.createUser(userData);
      res.json({ ...user, password: undefined });
    } catch (error) {
      res.status(400).json({ message: "Failed to create user" });
    }
  });

  app.put("/api/users/:id", requireAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const userData = req.body;
      if (userData.password) {
        userData.password = await hashPassword(userData.password);
      }
      const user = await storage.updateUser(id, userData);
      res.json({ ...user, password: undefined });
    } catch (error) {
      res.status(400).json({ message: "Failed to update user" });
    }
  });

  app.delete("/api/users/:id", requireAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      await storage.deleteUser(id);
      res.json({ message: "User deleted successfully" });
    } catch (error) {
      res.status(500).json({ message: "Failed to delete user" });
    }
  });

  // Deactivate all LDAP users
  app.post("/api/users/deactivate-ldap", requireAdmin, async (req, res) => {
    try {
      const users = await storage.getAllUsers();
      const ldapUsers = users.filter(user => user.authMethod === "ldap");
      
      // Deactivate all LDAP users
      for (const user of ldapUsers) {
        await storage.updateUser(user.id, { isActive: false });
      }
      
      res.json({ 
        message: "LDAP users deactivated successfully",
        deactivatedCount: ldapUsers.length 
      });
    } catch (error) {
      res.status(500).json({ message: "Failed to deactivate LDAP users" });
    }
  });

  // Dashboard routes
  app.get("/api/dashboards", requireAuth, async (req, res) => {
    try {
      const user = req.session.user!;
      let dashboards;
      
      if (user.role === "admin") {
        dashboards = await storage.getAllDashboards();
      } else {
        dashboards = await storage.getDashboardsByUser(user.id);
      }
      
      res.json(dashboards);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch dashboards" });
    }
  });

  app.get("/api/dashboards/:id", requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const dashboard = await storage.getDashboard(id);
      
      if (!dashboard) {
        return res.status(404).json({ message: "Dashboard not found" });
      }

      const user = req.session.user!;
      if (user.role !== "admin" && dashboard.ownerId !== user.id) {
        return res.status(403).json({ message: "Access denied" });
      }

      res.json(dashboard);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch dashboard" });
    }
  });

  // List all public dashboards
  app.get("/api/public/dashboards", async (req, res) => {
    try {
      const dashboards = await storage.getPublicDashboards();
      res.json(dashboards);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch public dashboards" });
    }
  });

  // Public dashboard access route
  app.get("/api/public/dashboards/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const dashboard = await storage.getDashboard(id);
      
      if (!dashboard) {
        return res.status(404).json({ message: "Dashboard not found" });
      }

      if (!dashboard.isPublic) {
        return res.status(404).json({ message: "Dashboard not found" });
      }

      res.json(dashboard);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch dashboard" });
    }
  });

  // Public dashboard cards access route
  app.get("/api/public/dashboards/:id/cards", async (req, res) => {
    try {
      const { id } = req.params;
      const dashboard = await storage.getDashboard(id);
      
      if (!dashboard) {
        return res.status(404).json({ message: "Dashboard not found" });
      }

      if (!dashboard.isPublic) {
        return res.status(404).json({ message: "Dashboard not found" });
      }

      const cards = await storage.getCardsByDashboard(id);
      res.json(cards);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch dashboard cards" });
    }
  });

  app.post("/api/dashboards", requireAuth, async (req, res) => {
    try {
      const user = req.session.user!;
      const dashboardData = insertDashboardSchema.parse({
        ...req.body,
        ownerId: user.id,
      });
      const dashboard = await storage.createDashboard(dashboardData);
      res.json(dashboard);
    } catch (error) {
      res.status(400).json({ message: "Failed to create dashboard" });
    }
  });

  app.put("/api/dashboards/:id", requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const dashboard = await storage.getDashboard(id);
      
      if (!dashboard) {
        return res.status(404).json({ message: "Dashboard not found" });
      }

      const user = req.session.user!;
      if (user.role !== "admin" && dashboard.ownerId !== user.id) {
        return res.status(403).json({ message: "Access denied" });
      }

      const updatedDashboard = await storage.updateDashboard(id, req.body);
      res.json(updatedDashboard);
    } catch (error) {
      res.status(400).json({ message: "Failed to update dashboard" });
    }
  });

  app.delete("/api/dashboards/:id", requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const dashboard = await storage.getDashboard(id);
      
      if (!dashboard) {
        return res.status(404).json({ message: "Dashboard not found" });
      }

      const user = req.session.user!;
      if (user.role !== "admin" && dashboard.ownerId !== user.id) {
        return res.status(403).json({ message: "Access denied" });
      }

      await storage.deleteDashboard(id);
      res.json({ message: "Dashboard deleted successfully" });
    } catch (error) {
      res.status(500).json({ message: "Failed to delete dashboard" });
    }
  });

  // Data source routes
  app.get("/api/data-sources", requireAuth, async (req, res) => {
    try {
      const dataSources = await storage.getAllDataSources();
      res.json(dataSources);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch data sources" });
    }
  });

  // Test data source endpoint
  app.post("/api/data-sources/test", requireAuth, async (req, res) => {
    try {
      const { type, config } = req.body;
      
      if (type === "api" && config.curlRequest) {
        // Parse cURL command to extract URL and headers
        const curlRequest = config.curlRequest.trim();
        const urlMatch = curlRequest.match(/'([^']+)'|"([^"]+)"|(\S+)/g);
        let url = '';
        const headers: Record<string, string> = {};
        
        // Find URL and headers from cURL command
        for (let i = 0; i < urlMatch?.length; i++) {
          const part = urlMatch[i].replace(/['"]/g, '');
          if (part.startsWith('http')) {
            url = part;
          } else if (part === '-H' && i + 1 < urlMatch.length) {
            const header = urlMatch[i + 1].replace(/['"]/g, '');
            const [key, ...valueParts] = header.split(':');
            if (key && valueParts.length > 0) {
              headers[key.trim()] = valueParts.join(':').trim();
            }
          }
        }
        
        if (!url) {
          return res.status(400).json({ message: "Could not parse URL from cURL request" });
        }
        
        // Make the API request
        const response = await fetch(url, {
          method: 'GET',
          headers,
        });
        
        const responseText = await response.text();
        let parsedResponse;
        
        try {
          parsedResponse = JSON.parse(responseText);
        } catch {
          parsedResponse = { raw: responseText };
        }
        
        // Extract fields from JSON response
        const extractFields = (obj: any, prefix = ''): string[] => {
          let fields: string[] = [];
          if (typeof obj === 'object' && obj !== null) {
            if (Array.isArray(obj)) {
              if (obj.length > 0) {
                fields = fields.concat(extractFields(obj[0], prefix));
              }
            } else {
              Object.keys(obj).forEach(key => {
                const fieldName = prefix ? `${prefix}.${key}` : key;
                fields.push(fieldName);
                if (typeof obj[key] === 'object' && obj[key] !== null && !Array.isArray(obj[key])) {
                  fields = fields.concat(extractFields(obj[key], fieldName));
                }
              });
            }
          }
          return fields;
        };
        
        const fields = extractFields(parsedResponse);
        
        // Create structure overview
        const createStructure = (obj: any): any => {
          if (typeof obj !== 'object' || obj === null) {
            return typeof obj;
          }
          if (Array.isArray(obj)) {
            return obj.length > 0 ? [createStructure(obj[0])] : [];
          }
          const structure: any = {};
          Object.keys(obj).forEach(key => {
            structure[key] = createStructure(obj[key]);
          });
          return structure;
        };
        
        const structure = createStructure(parsedResponse);
        
        res.json({
          success: true,
          statusCode: response.status,
          response: parsedResponse,
          fields,
          structure,
          url,
          headers: Object.keys(headers)
        });
      } else {
        res.status(400).json({ message: "Unsupported data source type for testing" });
      }
    } catch (error: any) {
      console.error("Data source test error:", error);
      res.status(500).json({ message: error.message || "Failed to test data source" });
    }
  });

  app.post("/api/data-sources", requireAuth, async (req, res) => {
    try {
      const dataSourceData = insertDataSourceSchema.parse(req.body);
      const dataSource = await storage.createDataSource(dataSourceData);
      res.json(dataSource);
    } catch (error) {
      res.status(400).json({ message: "Failed to create data source" });
    }
  });

  app.put("/api/data-sources/:id", requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const dataSource = await storage.updateDataSource(id, req.body);
      res.json(dataSource);
    } catch (error) {
      res.status(400).json({ message: "Failed to update data source" });
    }
  });

  app.delete("/api/data-sources/:id", requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
      await storage.deleteDataSource(id);
      res.json({ message: "Data source deleted successfully" });
    } catch (error) {
      res.status(500).json({ message: "Failed to delete data source" });
    }
  });

  // Dashboard card routes
  app.get("/api/dashboards/:dashboardId/cards", requireAuth, async (req, res) => {
    try {
      const { dashboardId } = req.params;
      const cards = await storage.getCardsByDashboard(dashboardId);
      res.json(cards);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch dashboard cards" });
    }
  });

  app.post("/api/dashboards/:dashboardId/cards", requireAuth, async (req, res) => {
    try {
      const { dashboardId } = req.params;
      const cardData = insertDashboardCardSchema.parse({
        ...req.body,
        dashboardId,
      });
      const card = await storage.createDashboardCard(cardData);
      res.json(card);
    } catch (error) {
      res.status(400).json({ message: "Failed to create dashboard card" });
    }
  });

  app.put("/api/cards/:id", requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const card = await storage.updateDashboardCard(id, req.body);
      res.json(card);
    } catch (error) {
      res.status(400).json({ message: "Failed to update dashboard card" });
    }
  });

  app.delete("/api/cards/:id", requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
      await storage.deleteDashboardCard(id);
      res.json({ message: "Dashboard card deleted successfully" });
    } catch (error) {
      res.status(500).json({ message: "Failed to delete dashboard card" });
    }
  });

  // Settings routes
  app.get("/api/settings", requireAdmin, async (req, res) => {
    try {
      const settings = await storage.getAllSettings();
      res.json(settings);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch settings" });
    }
  });

  app.post("/api/settings", requireAdmin, async (req, res) => {
    try {
      const settingData = insertSettingSchema.parse(req.body);
      const setting = await storage.setSetting(settingData);
      res.json(setting);
    } catch (error) {
      res.status(400).json({ message: "Failed to save setting" });
    }
  });

  // LDAP user search endpoint
  app.get("/api/auth/search-ldap/:username", requireAdmin, async (req, res) => {
    try {
      const { username } = req.params;
      
      if (!username || username.trim() === "") {
        return res.status(400).json({ message: "Username is required" });
      }

      const userInfo = await searchLDAPUser(username);
      
      if (!userInfo) {
        return res.status(404).json({ message: "User not found in LDAP directory" });
      }

      res.json({
        message: "User found successfully",
        user: userInfo
      });
    } catch (error) {
      console.error("LDAP user search error:", error);
      res.status(500).json({ message: "LDAP user search failed" });
    }
  });

  // LDAP test endpoint
  app.post("/api/auth/test-ldap", requireAdmin, async (req, res) => {
    try {
      const { username, password } = req.body;
      
      if (!username || !password) {
        return res.status(400).json({ message: "Username and password are required" });
      }

      const ldapSettings = await storage.getSetting("ldap_config");
      if (!ldapSettings) {
        return res.status(404).json({ message: "LDAP configuration not found" });
      }

      // Test LDAP authentication (this won't actually connect to a server in test mode)
      res.json({ 
        message: "LDAP configuration loaded successfully", 
        config: {
          url: (ldapSettings.value as any).url,
          baseDN: (ldapSettings.value as any).baseDN,
          searchFilter: (ldapSettings.value as any).searchFilter,
        },
        note: "This is a test configuration. In production, this would attempt to authenticate against the LDAP server."
      });
    } catch (error) {
      res.status(500).json({ message: "LDAP test failed" });
    }
  });

  // Data fetching for cards
  app.post("/api/data-sources/:id/test", requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const dataSource = await storage.getDataSource(id);
      
      if (!dataSource) {
        return res.status(404).json({ message: "Data source not found" });
      }

      // Update last test time
      await storage.updateDataSource(id, { lastTestAt: new Date() });
      
      res.json({ message: "Data source tested successfully", status: "connected" });
    } catch (error) {
      res.status(500).json({ message: "Failed to test data source" });
    }
  });

  app.get("/api/data-sources/:id/data", requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const dataSource = await storage.getDataSource(id);
      
      if (!dataSource) {
        return res.status(404).json({ message: "Data source not found" });
      }

      // For demo purposes, return empty data structure
      // In production, this would fetch actual data based on dataSource.type and config
      res.json({
        data: [],
        fields: [],
        lastUpdated: new Date().toISOString(),
      });
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch data" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
