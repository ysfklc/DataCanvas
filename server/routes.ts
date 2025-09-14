import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { authenticateUser, createDefaultAdmin, createTestLDAPConfig, createTestLDAPUser, searchLDAPUser, hashPassword, authenticateLDAP, testLDAPConnection } from "./auth";
import { insertUserSchema, insertDashboardSchema, updateDashboardSchema, insertDataSourceSchema, insertDashboardCardSchema, insertSettingSchema, insertPasswordResetTokenSchema } from "@shared/schema";
import session from "express-session";
import MemoryStore from "memorystore";
import { nanoid } from "nanoid";
import { sendTestEmail, sendPasswordResetEmail } from "./mail";
import multer from "multer";
import path from "path";
import fs from "fs";

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
      sameSite: 'lax', // CSRF protection
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

  // Ensure upload directory exists
  const uploadDir = path.join(process.cwd(), "public", "uploads", "logos");
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }

  // Configure multer for logo uploads
  const storage_multer = multer.diskStorage({
    destination: (req, file, cb) => {
      cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
      cb(null, 'logo-' + uniqueSuffix + path.extname(file.originalname));
    }
  });

  const upload = multer({
    storage: storage_multer,
    limits: {
      fileSize: 5 * 1024 * 1024, // 5MB limit
    },
    fileFilter: (req, file, cb) => {
      const allowedMimes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
      if (allowedMimes.includes(file.mimetype)) {
        cb(null, true);
      } else {
        cb(new Error('Invalid file type. Only JPEG, PNG, GIF, and WebP images are allowed.'));
      }
    }
  });

  // Logo upload endpoint
  app.post("/api/upload/logo", requireAuth, upload.single('logo'), (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "No file uploaded" });
      }

      const logoUrl = `/uploads/logos/${req.file.filename}`;
      res.json({ 
        message: "Logo uploaded successfully",
        logoUrl: logoUrl
      });
    } catch (error: any) {
      res.status(400).json({ message: error.message || "Failed to upload logo" });
    }
  });

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

  // Password reset routes
  app.post("/api/auth/password-reset-request", async (req, res) => {
    try {
      const { email } = req.body;
      
      if (!email) {
        return res.status(400).json({ message: "Email is required" });
      }

      // Check if user exists
      const user = await storage.getUserByEmail(email);
      
      // Always return success to prevent email enumeration
      if (!user) {
        return res.json({ message: "Password reset email sent if account exists" });
      }

      // Generate token and set expiration (30 minutes)
      const token = nanoid(32);
      const expiresAt = new Date();
      expiresAt.setMinutes(expiresAt.getMinutes() + 30);

      // Clean up expired tokens first
      await storage.cleanupExpiredTokens();

      // Create password reset token
      await storage.createPasswordResetToken({
        userId: user.id,
        token,
        expiresAt,
        isUsed: false,
      });

      // Send password reset email
      try {
        await sendPasswordResetEmail(user.email, token);
        console.log(`Password reset email sent to ${email}`);
      } catch (emailError) {
        console.error("Failed to send password reset email:", emailError);
        // Don't fail the request if email fails, just log it
        // This prevents revealing whether an account exists or not
      }

      res.json({ message: "Password reset email sent if account exists" });
    } catch (error) {
      console.error("Password reset request error:", error);
      res.status(500).json({ message: "Failed to process password reset request" });
    }
  });

  app.get("/api/auth/verify-reset-token", async (req, res) => {
    try {
      const { token } = req.query;

      if (!token || typeof token !== "string") {
        return res.status(400).json({ message: "Token is required" });
      }

      const resetToken = await storage.getPasswordResetToken(token);

      if (!resetToken) {
        return res.status(404).json({ message: "Invalid or expired token" });
      }

      // Check if token is expired
      if (new Date() > resetToken.expiresAt) {
        return res.status(404).json({ message: "Token has expired" });
      }

      res.json({ message: "Token is valid" });
    } catch (error) {
      console.error("Token verification error:", error);
      res.status(500).json({ message: "Failed to verify token" });
    }
  });

  app.post("/api/auth/password-reset", async (req, res) => {
    try {
      const { token, password } = req.body;

      if (!token || !password) {
        return res.status(400).json({ message: "Token and password are required" });
      }

      if (password.length < 6) {
        return res.status(400).json({ message: "Password must be at least 6 characters long" });
      }

      const resetToken = await storage.getPasswordResetToken(token);

      if (!resetToken) {
        return res.status(404).json({ message: "Invalid or expired token" });
      }

      // Check if token is expired
      if (new Date() > resetToken.expiresAt) {
        return res.status(404).json({ message: "Token has expired" });
      }

      // Mark token as used
      await storage.markTokenAsUsed(resetToken.id);

      // Update user's password
      const hashedPassword = await hashPassword(password);
      await storage.updateUser(resetToken.userId, { password: hashedPassword });

      res.json({ message: "Password reset successful" });
    } catch (error) {
      console.error("Password reset error:", error);
      res.status(500).json({ message: "Failed to reset password" });
    }
  });

  // Mail settings routes
  app.post("/api/settings/test-mail", requireAdmin, async (req, res) => {
    try {
      const { config, testEmail } = req.body;

      if (!config || !testEmail) {
        return res.status(400).json({ message: "Configuration and test email are required" });
      }

      if (!config.enabled) {
        return res.status(400).json({ message: "Mail configuration is disabled" });
      }

      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(testEmail)) {
        return res.status(400).json({ message: "Invalid email format" });
      }

      await sendTestEmail(config, testEmail);
      res.json({ message: "Test email sent successfully" });
    } catch (error) {
      console.error("Mail test error:", error);
      const errorMessage = error instanceof Error ? error.message : "Failed to send test email";
      res.status(500).json({ message: errorMessage });
    }
  });

  // User routes
  app.get("/api/users", requireAuth, async (req, res) => {
    try {
      const currentUser = req.session?.user;
      
      if (!currentUser) {
        return res.status(401).json({ message: "Authentication required" });
      }
      
      if (currentUser.role === "admin") {
        // Admins can see all users
        const users = await storage.getAllUsers();
        res.json(users.map(user => ({ ...user, password: undefined })));
      } else {
        // Standard users can only see their own account
        const user = await storage.getUser(currentUser.id);
        if (user) {
          res.json([{ ...user, password: undefined }]);
        } else {
          res.json([]);
        }
      }
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
      
      // Add card count to each dashboard
      const dashboardsWithCardCount = await Promise.all(
        dashboards.map(async (dashboard) => {
          const cards = await storage.getCardsByDashboard(dashboard.id);
          return {
            ...dashboard,
            cardCount: cards.length
          };
        })
      );
      
      res.json(dashboardsWithCardCount);
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
      
      // Add card count to each dashboard
      const dashboardsWithCardCount = await Promise.all(
        dashboards.map(async (dashboard) => {
          const cards = await storage.getCardsByDashboard(dashboard.id);
          return {
            ...dashboard,
            cardCount: cards.length
          };
        })
      );
      
      res.json(dashboardsWithCardCount);
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

  // Public data source data endpoint - for public dashboards only
  app.get("/api/public/data-sources/:id/data", async (req, res) => {
    try {
      const { id } = req.params;
      const dataSource = await storage.getDataSource(id);
      
      if (!dataSource) {
        return res.status(404).json({ message: "Data source not found" });
      }

      // Verify this data source is used in at least one public dashboard
      const allDashboards = await storage.getAllDashboards();
      let isUsedInPublicDashboard = false;
      
      for (const dashboard of allDashboards) {
        if (dashboard.isPublic) {
          const cards = await storage.getCardsByDashboard(dashboard.id);
          if (cards.some(card => card.dataSourceId === id)) {
            isUsedInPublicDashboard = true;
            break;
          }
        }
      }

      if (!isUsedInPublicDashboard) {
        return res.status(404).json({ message: "Data source not found" });
      }

      // Now we can serve the data using the same logic as the authenticated endpoint
      // Update last pull time to track actual data pulls
      await storage.updateDataSource(id, { lastPullAt: new Date() });

      if (dataSource.type === "api" && (dataSource.config as any)?.curlRequest) {
        try {
          const curlRequest = (dataSource.config as any).curlRequest.trim();
          const urlMatch = curlRequest.match(/'([^']+)'|"([^"]+)"|(\S+)/g);
          let url = '';
          const headers: Record<string, string> = {};
          
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
            return res.json({
              data: [],
              fields: [],
              lastUpdated: new Date().toISOString(),
              error: "Could not parse URL from cURL request"
            });
          }
          
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
          
          res.json({
            data: Array.isArray(parsedResponse) ? parsedResponse : [parsedResponse],
            fields,
            lastUpdated: new Date().toISOString()
          });
        } catch (error: any) {
          res.json({
            data: [],
            fields: [],
            lastUpdated: new Date().toISOString(),
            error: error.message || "Failed to fetch API data"
          });
        }
      } else if (dataSource.type === "jira") {
        try {
          const config = dataSource.config as any;
          const auth = Buffer.from(`${config.jiraUsername}:${config.jiraPassword}`).toString('base64');
          const baseUrl = config.jiraUrl.replace(/\/$/, '');
          
          const jql = config.jiraQuery || `project = ${config.selectedJiraProject}`;
          const url = `${baseUrl}/rest/api/2/search?jql=${encodeURIComponent(jql)}&maxResults=100`;
          
          const response = await fetch(url, {
            method: 'GET',
            headers: {
              'Authorization': `Basic ${auth}`,
              'Accept': 'application/json',
              'Content-Type': 'application/json'
            }
          });
          
          if (!response.ok) {
            throw new Error(`JIRA API error: ${response.status} ${response.statusText}`);
          }
          
          const jiraData = await response.json();
          
          const formattedData = jiraData.issues.map((issue: any) => ({
            key: issue.key,
            summary: issue.fields.summary,
            status: issue.fields.status.name,
            assignee: issue.fields.assignee?.displayName || 'Unassigned',
            reporter: issue.fields.reporter?.displayName || 'Unknown',
            priority: issue.fields.priority?.name || 'None',
            issueType: issue.fields.issuetype?.name,
            created: issue.fields.created,
            updated: issue.fields.updated,
            resolved: issue.fields.resolutiondate,
            project: issue.fields.project.name,
            projectKey: issue.fields.project.key,
            description: issue.fields.description,
            labels: Array.isArray(issue.fields.labels) ? issue.fields.labels.join(', ') : '',
            components: Array.isArray(issue.fields.components) ? 
              issue.fields.components.map((c: any) => c.name).join(', ') : '',
            fixVersions: Array.isArray(issue.fields.fixVersions) ? 
              issue.fields.fixVersions.map((v: any) => v.name).join(', ') : '',
            storyPoints: issue.fields.customfield_10016 || '',
            sprint: issue.fields.customfield_10020 && Array.isArray(issue.fields.customfield_10020) && issue.fields.customfield_10020.length > 0 ? 
              (Array.isArray(issue.fields.customfield_10020) && issue.fields.customfield_10020.length > 0 ? 
                issue.fields.customfield_10020[issue.fields.customfield_10020.length - 1].name : '') : ''
          }));
          
          const fields = ['key', 'summary', 'status', 'assignee', 'reporter', 'priority', 'issueType', 'created', 'updated', 'resolved', 'project', 'projectKey', 'description', 'labels', 'components', 'fixVersions', 'storyPoints', 'sprint'];
          
          res.json({
            data: formattedData,
            fields,
            lastUpdated: new Date().toISOString()
          });
        } catch (error: any) {
          console.error("JIRA data fetch error:", error);
          res.json({
            data: [],
            fields: [],
            lastUpdated: new Date().toISOString(),
            error: error.message || "Failed to fetch JIRA data"
          });
        }
      } else {
        // For other data source types, return empty data
        res.json({
          data: [],
          fields: [],
          lastUpdated: new Date().toISOString(),
          error: "Data source type not supported in public mode"
        });
      }
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch data source data" });
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

      // Validate request body using updateDashboardSchema
      const updateData = updateDashboardSchema.parse(req.body);
      const updatedDashboard = await storage.updateDashboard(id, updateData);
      res.json(updatedDashboard);
    } catch (error) {
      console.error("Dashboard update error:", error);
      if (error instanceof Error && error.name === 'ZodError') {
        return res.status(400).json({ message: "Invalid request data", details: error.message });
      }
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

  app.get("/api/data-sources/:id", requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const dataSource = await storage.getDataSource(id);
      if (!dataSource) {
        return res.status(404).json({ message: "Data source not found" });
      }
      res.json(dataSource);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch data source" });
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
      } else if (type === "jira" && config.jiraUrl && config.jiraUsername && config.jiraPassword) {
        // JIRA authentication and project fetching
        const auth = Buffer.from(`${config.jiraUsername}:${config.jiraPassword}`).toString('base64');
        const baseUrl = config.jiraUrl.replace(/\/$/, ''); // Remove trailing slash
        
        try {
          // Test authentication by fetching projects
          const projectsResponse = await fetch(`${baseUrl}/rest/api/2/project`, {
            method: 'GET',
            headers: {
              'Authorization': `Basic ${auth}`,
              'Accept': 'application/json',
              'Content-Type': 'application/json'
            }
          });
          
          if (!projectsResponse.ok) {
            throw new Error(`JIRA authentication failed: ${projectsResponse.status} ${projectsResponse.statusText}`);
          }
          
          const projects = await projectsResponse.json();
          
          // Test API access by fetching current user info
          const userResponse = await fetch(`${baseUrl}/rest/api/2/myself`, {
            method: 'GET',
            headers: {
              'Authorization': `Basic ${auth}`,
              'Accept': 'application/json'
            }
          });
          
          // Validate that user authentication actually worked
          if (!userResponse.ok) {
            throw new Error(`JIRA user authentication failed: ${userResponse.status} ${userResponse.statusText}`);
          }
          
          const userInfo = await userResponse.json();
          
          // Ensure we got valid user data back
          if (!userInfo || !userInfo.accountId) {
            throw new Error('JIRA authentication failed: Invalid or empty user data returned');
          }
          
          // Validate projects array exists and is valid
          if (!Array.isArray(projects)) {
            throw new Error('JIRA authentication failed: Invalid projects data returned');
          }
          
          // Fetch saved filters
          let savedFilters: any[] = [];
          try {
            // First try to fetch favorite filters
            const favFiltersResponse = await fetch(`${baseUrl}/rest/api/2/filter/favourite`, {
              method: 'GET',
              headers: {
                'Authorization': `Basic ${auth}`,
                'Accept': 'application/json'
              }
            });
            
            if (favFiltersResponse.ok) {
              const favFilters = await favFiltersResponse.json();
              if (Array.isArray(favFilters)) {
                savedFilters = savedFilters.concat(favFilters.map((filter: any) => ({
                  id: filter.id,
                  name: filter.name,
                  description: filter.description,
                  jql: filter.jql,
                  favourite: true,
                  owner: filter.owner?.displayName || filter.owner?.name || 'Unknown'
                })));
              }
            }
            
            // Then try to fetch additional accessible filters via search (limit to 20 for performance)
            const searchFiltersResponse = await fetch(`${baseUrl}/rest/api/2/filter/search?maxResults=20`, {
              method: 'GET',
              headers: {
                'Authorization': `Basic ${auth}`,
                'Accept': 'application/json'
              }
            });
            
            if (searchFiltersResponse.ok) {
              const searchResult = await searchFiltersResponse.json();
              if (searchResult.values && Array.isArray(searchResult.values)) {
                // Add non-favorite filters that aren't already in the list
                const existingFilterIds = new Set(savedFilters.map(f => f.id));
                const additionalFilters = searchResult.values
                  .filter((filter: any) => !existingFilterIds.has(filter.id))
                  .map((filter: any) => ({
                    id: filter.id,
                    name: filter.name,
                    description: filter.description,
                    jql: filter.jql,
                    favourite: false,
                    owner: filter.owner?.displayName || filter.owner?.name || 'Unknown'
                  }));
                  
                savedFilters = savedFilters.concat(additionalFilters);
              }
            }
          } catch (filterError: any) {
            // Don't fail the entire request if filter fetching fails, just log it
            console.warn("Failed to fetch JIRA saved filters:", filterError.message);
          }
          
          res.json({
            success: true,
            message: "JIRA connection successful",
            projects: projects.map((project: any) => ({
              key: project.key,
              name: project.name,
              id: project.id,
              projectTypeKey: project.projectTypeKey
            })),
            user: {
              displayName: userInfo.displayName,
              emailAddress: userInfo.emailAddress,
              accountId: userInfo.accountId
            },
            savedFilters: savedFilters,
            jiraUrl: baseUrl
          });
        } catch (error: any) {
          console.error("JIRA test error:", error);
          throw new Error(`JIRA connection failed: ${error.message}`);
        }
      } else if (type === "smax" && config.smaxUrl && config.smaxUsername && config.smaxPassword) {
        // SMAX authentication and service fetching
        const baseUrl = config.smaxUrl.replace(/\/$/, ''); // Remove trailing slash
        
        try {
          // First, get authentication token
          const authResponse = await fetch(`${baseUrl}/auth/authentication-endpoint/authenticate/login?TENANTID=1`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Accept': 'application/json'
            },
            body: JSON.stringify({
              Login: config.smaxUsername,
              Password: config.smaxPassword
            })
          });
          
          if (!authResponse.ok) {
            throw new Error(`SMAX authentication failed: ${authResponse.status} ${authResponse.statusText}`);
          }
          
          const authData = await authResponse.json();
          const token = authData.token;
          
          if (!token) {
            throw new Error('SMAX authentication failed: No token received');
          }
          
          // Test API access by fetching available entity types/services
          const entitiesResponse = await fetch(`${baseUrl}/rest/1/metadata`, {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Accept': 'application/json',
              'Content-Type': 'application/json'
            }
          });
          
          let services: { name: string; displayName: string }[] = [];
          if (entitiesResponse.ok) {
            const entitiesData = await entitiesResponse.json();
            // Extract common SMAX entity types
            services = [
              { name: 'Request', displayName: 'Service Requests' },
              { name: 'Incident', displayName: 'Incidents' },
              { name: 'Problem', displayName: 'Problems' },
              { name: 'Change', displayName: 'Change Requests' },
              { name: 'Task', displayName: 'Tasks' },
              { name: 'KnowledgeDocument', displayName: 'Knowledge Articles' }
            ];
          }
          
          // Test current user info
          const userResponse = await fetch(`${baseUrl}/rest/1/ems/Person`, {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Accept': 'application/json'
            }
          });
          
          let userInfo = null;
          if (userResponse.ok) {
            const userData = await userResponse.json();
            if (userData.entities && userData.entities.length > 0) {
              const user = userData.entities[0];
              userInfo = {
                id: user.entity_id,
                name: user.Name || user.DisplayName,
                email: user.Email
              };
            }
          }
          
          res.json({
            success: true,
            message: "SMAX connection successful",
            services: services,
            user: userInfo,
            smaxUrl: baseUrl,
            token: token // We'll need this for subsequent requests
          });
        } catch (error: any) {
          console.error("SMAX test error:", error);
          throw new Error(`SMAX connection failed: ${error.message}`);
        }
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

  // Settings routes - standard users can view settings (read-only)
  app.get("/api/settings", requireAuth, async (req, res) => {
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

  // LDAP Settings endpoints
  app.get("/api/settings/ldap", requireAdmin, async (req, res) => {
    try {
      const ldapSettings = await storage.getLdapSettings();
      if (!ldapSettings) {
        return res.json({
          url: "ldap://localhost:389",
          baseDN: "ou=users,dc=example,dc=com",
          bindDN: "",
          bindCredentials: "",
          searchFilter: "(uid={username})",
          tlsRejectUnauthorized: false,
          enabled: false
        });
      }
      res.json(ldapSettings);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch LDAP settings" });
    }
  });

  app.post("/api/settings/ldap", requireAdmin, async (req, res) => {
    try {
      const ldapSettings = await storage.updateLdapSettings(req.body);
      res.json(ldapSettings);
    } catch (error) {
      console.error("Failed to save LDAP settings:", error);
      res.status(400).json({ message: "Failed to save LDAP settings" });
    }
  });

  // Mail Settings endpoints
  app.get("/api/settings/mail", requireAdmin, async (req, res) => {
    try {
      const mailSettings = await storage.getMailSettings();
      if (!mailSettings) {
        return res.json({
          host: "smtp.gmail.com",
          port: 587,
          secure: false,
          authUser: "",
          authPass: "",
          fromAddress: "",
          enabled: false
        });
      }
      res.json(mailSettings);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch mail settings" });
    }
  });

  app.post("/api/settings/mail", requireAdmin, async (req, res) => {
    try {
      const mailSettings = await storage.updateMailSettings(req.body);
      res.json(mailSettings);
    } catch (error) {
      console.error("Failed to save mail settings:", error);
      res.status(400).json({ message: "Failed to save mail settings" });
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
      const { username, password, config } = req.body;
      
      if (!username || !password) {
        return res.status(400).json({ message: "Username and password are required" });
      }

      if (!config) {
        return res.status(400).json({ message: "LDAP configuration is required for testing" });
      }

      // Test LDAP connection using the provided configuration directly
      const testResult = await testLDAPConnection(config, username, password);
      
      if (testResult.success) {
        res.json({ 
          message: "LDAP connection and authentication successful", 
          config: {
            url: config.url,
            baseDN: config.baseDN,
            searchFilter: config.searchFilter,
          },
          status: "success"
        });
      } else {
        // Connection failed - could be server unreachable, wrong config, or invalid credentials
        res.status(400).json({ 
          message: testResult.error || "LDAP connection or authentication failed. Please check your server configuration and test credentials.",
          status: "failed"
        });
      }
    } catch (error) {
      console.error("LDAP test error:", error);
      res.status(500).json({ 
        message: "LDAP test failed due to server error. Please check your configuration and try again.",
        status: "error"
      });
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
      await storage.updateDataSource(id, { lastPullAt: new Date() });
      
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

      // Update last pull time to track actual data pulls
      await storage.updateDataSource(id, { lastPullAt: new Date() });

      if (dataSource.type === "api" && (dataSource.config as any)?.curlRequest) {
        try {
          // Parse cURL command to extract URL and headers
          const curlRequest = (dataSource.config as any).curlRequest.trim();
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
            return res.json({
              data: [],
              fields: [],
              lastUpdated: new Date().toISOString(),
              error: "Could not parse URL from cURL request"
            });
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
          
          const allFields = extractFields(parsedResponse);
          const selectedFields = (dataSource.config as any)?.selectedFields || allFields;
          const fieldDisplayNames = (dataSource.config as any)?.fieldDisplayNames || {};
          
          // Convert data to chart-friendly format and filter by selected fields
          let chartData = [];
          if (Array.isArray(parsedResponse)) {
            // If it's an array of objects, flatten nested objects and filter by selected fields
            chartData = parsedResponse.map(item => {
              const flattened: any = {};
              const flattenObject = (obj: any, prefix = '') => {
                Object.keys(obj).forEach(key => {
                  const value = obj[key];
                  const newKey = prefix ? `${prefix}.${key}` : key;
                  
                  if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
                    flattenObject(value, newKey);
                  } else {
                    flattened[newKey] = value;
                  }
                });
              };
              
              if (typeof item === 'object' && item !== null) {
                flattenObject(item);
                
                // Filter to only selected fields
                const filteredItem: any = {};
                selectedFields.forEach((field: string) => {
                  if (flattened.hasOwnProperty(field)) {
                    filteredItem[field] = flattened[field];
                  }
                });
                return filteredItem;
              }
              return item;
            });
          } else if (parsedResponse && typeof parsedResponse === 'object') {
            // If it's an object, convert to array format for charts and filter by selected fields
            chartData = Object.keys(parsedResponse)
              .filter(key => selectedFields.includes(key))
              .map(key => ({
                name: key,
                value: parsedResponse[key]
              }));
          }
          
          res.json({
            data: chartData,
            fields: selectedFields,
            fieldDisplayNames: fieldDisplayNames,
            lastUpdated: new Date().toISOString(),
          });
        } catch (error: any) {
          console.error("Data fetch error:", error);
          res.json({
            data: [],
            fields: [],
            lastUpdated: new Date().toISOString(),
            error: error.message || "Failed to fetch API data"
          });
        }
      } else if (dataSource.type === "jira" && (dataSource.config as any)?.jiraUrl) {
        try {
          const config = dataSource.config as any;
          const auth = Buffer.from(`${config.jiraUsername}:${config.jiraPassword}`).toString('base64');
          const baseUrl = config.jiraUrl.replace(/\/$/, '');
          
          // Build JQL query
          let jql = '';
          if (config.selectedJiraProject) {
            jql = `project = "${config.selectedJiraProject}"`;
            if (config.jiraQuery && config.jiraQuery.trim()) {
              jql += ` AND (${config.jiraQuery.trim()})`;
            }
          } else if (config.jiraQuery && config.jiraQuery.trim()) {
            jql = config.jiraQuery.trim();
          } else {
            jql = 'ORDER BY created DESC';
          }
          
          // Fetch issues from JIRA
          const searchUrl = `${baseUrl}/rest/api/2/search?jql=${encodeURIComponent(jql)}&maxResults=100&fields=*all`;
          const response = await fetch(searchUrl, {
            method: 'GET',
            headers: {
              'Authorization': `Basic ${auth}`,
              'Accept': 'application/json'
            }
          });
          
          if (!response.ok) {
            throw new Error(`JIRA API error: ${response.status} ${response.statusText}`);
          }
          
          const jiraData = await response.json();
          const issues = jiraData.issues || [];
          
          // Transform JIRA issues to flat structure
          const chartData = issues.map((issue: any) => ({
            id: issue.id,
            key: issue.key,
            summary: issue.fields.summary || '',
            status: issue.fields.status?.name || '',
            assignee: issue.fields.assignee?.displayName || 'Unassigned',
            reporter: issue.fields.reporter?.displayName || '',
            priority: issue.fields.priority?.name || '',
            issueType: issue.fields.issuetype?.name || '',
            created: issue.fields.created ? new Date(issue.fields.created).toLocaleDateString() : '',
            updated: issue.fields.updated ? new Date(issue.fields.updated).toLocaleDateString() : '',
            resolved: issue.fields.resolutiondate ? new Date(issue.fields.resolutiondate).toLocaleDateString() : '',
            project: issue.fields.project?.name || '',
            projectKey: issue.fields.project?.key || '',
            description: issue.fields.description || '',
            labels: Array.isArray(issue.fields.labels) ? issue.fields.labels.join(', ') : '',
            components: Array.isArray(issue.fields.components) ? issue.fields.components.map((c: any) => c.name).join(', ') : '',
            fixVersions: Array.isArray(issue.fields.fixVersions) ? issue.fields.fixVersions.map((v: any) => v.name).join(', ') : '',
            storyPoints: issue.fields.customfield_10016 || '', // Common story points field
            sprint: issue.fields.customfield_10020 ? 
              (Array.isArray(issue.fields.customfield_10020) && issue.fields.customfield_10020.length > 0 ? 
                issue.fields.customfield_10020[issue.fields.customfield_10020.length - 1].name : '') : ''
          }));
          
          // Get all available fields
          const allFields = chartData.length > 0 ? Object.keys(chartData[0]) : [];
          const selectedFields = config.selectedFields || allFields;
          const fieldDisplayNames = config.fieldDisplayNames || {};
          
          // Default field display names for JIRA
          const defaultJiraFieldNames: Record<string, string> = {
            id: 'Issue ID',
            key: 'Issue Key',
            summary: 'Summary',
            status: 'Status',
            assignee: 'Assignee',
            reporter: 'Reporter',
            priority: 'Priority',
            issueType: 'Issue Type',
            created: 'Created Date',
            updated: 'Updated Date',
            resolved: 'Resolved Date',
            project: 'Project Name',
            projectKey: 'Project Key',
            description: 'Description',
            labels: 'Labels',
            components: 'Components',
            fixVersions: 'Fix Versions',
            storyPoints: 'Story Points',
            sprint: 'Sprint'
          };
          
          // Merge with custom field names
          const finalFieldNames = { ...defaultJiraFieldNames, ...fieldDisplayNames };
          
          // Filter data by selected fields
          const filteredData = chartData.map((item: any) => {
            const filtered: any = {};
            selectedFields.forEach((field: string) => {
              if (item.hasOwnProperty(field)) {
                filtered[field] = item[field];
              }
            });
            return filtered;
          });
          
          res.json({
            data: filteredData,
            fields: selectedFields,
            fieldDisplayNames: finalFieldNames,
            lastUpdated: new Date().toISOString(),
            totalIssues: jiraData.total || issues.length,
            jql: jql
          });
        } catch (error: any) {
          console.error("JIRA data fetch error:", error);
          res.json({
            data: [],
            fields: [],
            lastUpdated: new Date().toISOString(),
            error: error.message || "Failed to fetch JIRA data"
          });
        }
      } else if (dataSource.type === "smax" && (dataSource.config as any)?.smaxUrl) {
        try {
          const config = dataSource.config as any;
          const baseUrl = config.smaxUrl.replace(/\/$/, '');
          
          // Get authentication token
          const authResponse = await fetch(`${baseUrl}/auth/authentication-endpoint/authenticate/login?TENANTID=1`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Accept': 'application/json'
            },
            body: JSON.stringify({
              Login: config.smaxUsername,
              Password: config.smaxPassword
            })
          });
          
          if (!authResponse.ok) {
            throw new Error(`SMAX authentication failed: ${authResponse.status} ${authResponse.statusText}`);
          }
          
          const authData = await authResponse.json();
          const token = authData.token;
          
          if (!token) {
            throw new Error('SMAX authentication failed: No token received');
          }
          
          // Build query parameters
          let queryParams = '';
          if (config.smaxQuery && config.smaxQuery.trim()) {
            queryParams = `&query=${encodeURIComponent(config.smaxQuery.trim())}`;
          }
          
          // Fetch records from SMAX
          const entityType = config.selectedSmaxService || 'Request';
          const searchUrl = `${baseUrl}/rest/1/ems/${entityType}?layout=Id,Title,Status,Priority,AssignedTo,RequestedBy,Category,Subcategory,CreationTime,LastUpdateTime,ClosureTime,Description,Service,ImpactScope,Urgency,Phase&size=100${queryParams}`;
          
          const response = await fetch(searchUrl, {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Accept': 'application/json'
            }
          });
          
          if (!response.ok) {
            throw new Error(`SMAX API error: ${response.status} ${response.statusText}`);
          }
          
          const smaxData = await response.json();
          const entities = smaxData.entities || [];
          
          // Transform SMAX entities to flat structure
          const chartData = entities.map((entity: any) => ({
            id: entity.entity_id || entity.Id,
            title: entity.Title || '',
            status: entity.Status || '',
            priority: entity.Priority || '',
            assignedTo: entity.AssignedTo || 'Unassigned',
            requestedBy: entity.RequestedBy || '',
            category: entity.Category || '',
            subcategory: entity.Subcategory || '',
            creationTime: entity.CreationTime ? new Date(entity.CreationTime).toLocaleDateString() : '',
            lastUpdateTime: entity.LastUpdateTime ? new Date(entity.LastUpdateTime).toLocaleDateString() : '',
            closureTime: entity.ClosureTime ? new Date(entity.ClosureTime).toLocaleDateString() : '',
            description: entity.Description || '',
            service: entity.Service || '',
            impactScope: entity.ImpactScope || '',
            urgency: entity.Urgency || '',
            phase: entity.Phase || '',
            entityType: entityType
          }));
          
          // Get all available fields
          const allFields = chartData.length > 0 ? Object.keys(chartData[0]) : [];
          const selectedFields = config.selectedFields || allFields;
          const fieldDisplayNames = config.fieldDisplayNames || {};
          
          // Default field display names for SMAX
          const defaultSmaxFieldNames: Record<string, string> = {
            id: 'ID',
            title: 'Title',
            status: 'Status',
            priority: 'Priority',
            assignedTo: 'Assigned To',
            requestedBy: 'Requested By',
            category: 'Category',
            subcategory: 'Subcategory',
            creationTime: 'Created',
            lastUpdateTime: 'Last Updated',
            closureTime: 'Closed',
            description: 'Description',
            service: 'Service',
            impactScope: 'Impact Scope',
            urgency: 'Urgency',
            phase: 'Phase',
            entityType: 'Type'
          };
          
          // Merge with custom field names
          const finalFieldNames = { ...defaultSmaxFieldNames, ...fieldDisplayNames };
          
          // Filter data by selected fields
          const filteredData = chartData.map((item: any) => {
            const filtered: any = {};
            selectedFields.forEach((field: string) => {
              if (item.hasOwnProperty(field)) {
                filtered[field] = item[field];
              }
            });
            return filtered;
          });
          
          res.json({
            data: filteredData,
            fields: selectedFields,
            fieldDisplayNames: finalFieldNames,
            lastUpdated: new Date().toISOString(),
            totalRecords: smaxData.meta?.total_count || entities.length,
            entityType: entityType,
            query: config.smaxQuery || ''
          });
        } catch (error: any) {
          console.error("SMAX data fetch error:", error);
          res.json({
            data: [],
            fields: [],
            lastUpdated: new Date().toISOString(),
            error: error.message || "Failed to fetch SMAX data"
          });
        }
      } else {
        // For non-supported data sources or missing configuration, return empty data
        res.json({
          data: [],
          fields: [],
          lastUpdated: new Date().toISOString(),
          message: "Data source type not supported or not configured"
        });
      }
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch data" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
