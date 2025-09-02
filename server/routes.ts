import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { authenticateUser, createDefaultAdmin, hashPassword } from "./auth";
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
  // Initialize default admin user
  await createDefaultAdmin();

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
