import bcrypt from "bcrypt";
import ldap from "ldapjs";
import { storage } from "./storage";
import type { User } from "@shared/schema";

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export async function comparePassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export async function authenticateUser(identifier: string, password: string): Promise<User | null> {
  // Try to find user by username or email
  let user = await storage.getUserByUsername(identifier);
  if (!user) {
    user = await storage.getUserByEmail(identifier);
  }

  if (!user || !user.isActive) {
    return null;
  }

  // For local authentication, verify password
  if (user.authMethod === "local") {
    if (!user.password) {
      console.error("Local user missing password hash");
      return null;
    }
    const isValid = await comparePassword(password, user.password);
    if (!isValid) {
      return null;
    }
  } else if (user.authMethod === "ldap") {
    // LDAP users should have null password since they authenticate via LDAP
    // Use the username from the user record for LDAP authentication
    const isValid = await authenticateLDAP(user.username, password);
    if (!isValid) {
      return null;
    }
  }

  // Update last login
  await storage.updateUser(user.id, { lastLogin: new Date() });
  
  return user;
}

interface LDAPConfig {
  url: string;
  baseDN: string;
  bindDN?: string;
  bindCredentials?: string;
  searchFilter: string;
  tlsOptions?: {
    rejectUnauthorized: boolean;
  };
}

export async function authenticateLDAP(username: string, password: string): Promise<boolean> {
  try {
    // Get LDAP configuration from settings
    const ldapSettings = await storage.getLdapSettings();
    if (!ldapSettings || !ldapSettings.enabled) {
      console.error("LDAP configuration not found or disabled");
      return false;
    }

    const config = {
      url: ldapSettings.url,
      baseDN: ldapSettings.baseDN,
      bindDN: ldapSettings.bindDN,
      bindCredentials: ldapSettings.bindCredentials,
      searchFilter: ldapSettings.searchFilter,
      tlsOptions: {
        rejectUnauthorized: ldapSettings.tlsRejectUnauthorized,
      },
    };
    const client = ldap.createClient({
      url: config.url,
      tlsOptions: config.tlsOptions || { rejectUnauthorized: false },
    });

    return new Promise((resolve) => {
      // Handle client connection errors to prevent server crash
      client.on('error', (err) => {
        console.error("LDAP client connection error:", err.message || err);
        resolve(false);
      });

      // Set a timeout for the connection attempt
      const timeout = setTimeout(() => {
        console.error("LDAP connection timeout");
        client.unbind();
        resolve(false);
      }, 5000); // 5 second timeout

      // First bind with service account if provided, otherwise anonymous
      const bindDN = config.bindDN || "";
      const bindCredentials = config.bindCredentials || "";

      client.bind(bindDN, bindCredentials, (bindErr) => {
        clearTimeout(timeout);
        if (bindErr) {
          console.error("LDAP bind error:", bindErr);
          client.unbind();
          resolve(false);
          return;
        }

        // Search for the user
        const searchFilter = config.searchFilter.replace("{username}", username);
        client.search(config.baseDN, {
          filter: searchFilter,
          scope: "sub",
        }, (searchErr, res) => {
          if (searchErr) {
            console.error("LDAP search error:", searchErr);
            client.unbind();
            resolve(false);
            return;
          }

          let userDN: string | null = null;

          res.on("searchEntry", (entry) => {
            userDN = entry.pojo.objectName || null;
          });

          res.on("end", () => {
            if (!userDN) {
              console.error("User not found in LDAP");
              client.unbind();
              resolve(false);
              return;
            }

            // Try to bind with user credentials
            client.bind(userDN, password, (authErr) => {
              client.unbind();
              if (authErr) {
                console.error("LDAP authentication failed:", authErr);
                resolve(false);
              } else {
                resolve(true);
              }
            });
          });

          res.on("error", (err) => {
            console.error("LDAP search result error:", err);
            client.unbind();
            resolve(false);
          });
        });
      });
    });
  } catch (error) {
    console.error("LDAP authentication error:", error);
    return false;
  }
}

export async function createDefaultAdmin(): Promise<void> {
  const existingAdmin = await storage.getUserByEmail("admin@example.com");
  if (existingAdmin) {
    return;
  }

  const hashedPassword = await hashPassword("admin123");
  await storage.createUser({
    username: "admin",
    email: "admin@example.com",
    password: hashedPassword,
    role: "admin",
    authMethod: "local",
  });
}

export async function createTestLDAPConfig(): Promise<void> {
  const existingConfig = await storage.getLdapSettings();
  if (existingConfig) {
    return;
  }

  // Create test LDAP configuration
  await storage.createLdapSettings({
    url: "ldap://localhost:389",
    baseDN: "dc=example,dc=com",
    bindDN: "cn=admin,dc=example,dc=com",
    bindCredentials: "admin",
    searchFilter: "(uid={username})",
    tlsRejectUnauthorized: false,
    enabled: false, // Default to disabled for security
  });
}

export async function searchLDAPUser(username: string): Promise<any | null> {
  try {
    // Get LDAP configuration from settings
    const ldapSettings = await storage.getLdapSettings();
    if (!ldapSettings || !ldapSettings.enabled) {
      console.error("LDAP configuration not found or disabled");
      return null;
    }

    const config = {
      url: ldapSettings.url,
      baseDN: ldapSettings.baseDN,
      bindDN: ldapSettings.bindDN,
      bindCredentials: ldapSettings.bindCredentials,
      searchFilter: ldapSettings.searchFilter,
      tlsOptions: {
        rejectUnauthorized: ldapSettings.tlsRejectUnauthorized,
      },
    };
    console.log(`LDAP search for user: ${username}`);
    console.log(`LDAP config - URL: ${config.url}, baseDN: ${config.baseDN}, searchFilter: ${config.searchFilter}`);
    
    const client = ldap.createClient({
      url: config.url,
      tlsOptions: config.tlsOptions || { rejectUnauthorized: false },
    });

    return new Promise((resolve) => {
      // Handle client connection errors to prevent server crash
      client.on('error', (err) => {
        console.error("LDAP client connection error:", err.message || err);
        resolve(null);
      });

      // Set a timeout for the connection attempt
      const timeout = setTimeout(() => {
        console.error("LDAP connection timeout");
        client.unbind();
        resolve(null);
      }, 5000); // 5 second timeout

      // First bind with service account if provided, otherwise anonymous
      const bindDN = config.bindDN || "";
      const bindCredentials = config.bindCredentials || "";

      console.log(`Attempting LDAP bind with DN: ${bindDN}`);
      client.bind(bindDN, bindCredentials, (bindErr) => {
        clearTimeout(timeout);
        if (bindErr) {
          console.error("LDAP bind error:", bindErr.message || bindErr);
          client.unbind();
          resolve(null);
          return;
        }

        console.log("LDAP bind successful");
        
        // Search for the user
        const searchFilter = config.searchFilter.replace("{username}", username);
        console.log(`Searching with filter: ${searchFilter} in baseDN: ${config.baseDN}`);
        
        client.search(config.baseDN, {
          filter: searchFilter,
          scope: "sub",
        }, (searchErr, res) => {
          if (searchErr) {
            console.error("LDAP search error:", searchErr.message || searchErr);
            client.unbind();
            resolve(null);
            return;
          }

          let userInfo: any = null;
          let entryCount = 0;

          res.on("searchEntry", (entry) => {
            entryCount++;
            console.log(`Found LDAP entry ${entryCount}: ${entry.pojo.objectName}`);
            
            const userData = entry.pojo;
            const attributes: any = {};
            
            // Parse LDAP attributes into a more accessible format
            if (userData.attributes) {
              console.log("Available attributes:", Object.keys(userData.attributes));
              for (const [key, values] of Object.entries(userData.attributes)) {
                attributes[key] = Array.isArray(values) ? values[0] : values;
              }
            }
            
            userInfo = {
              username: attributes.uid || attributes.sAMAccountName || username,
              email: attributes.mail || attributes.email || `${username}@example.com`,
              fullName: attributes.cn || attributes.displayName || username,
              dn: userData.objectName,
            };
            
            console.log("Parsed user info:", userInfo);
          });

          res.on("end", () => {
            console.log(`LDAP search completed. Found ${entryCount} entries.`);
            client.unbind();
            resolve(userInfo);
          });

          res.on("error", (err) => {
            console.error("LDAP search result error:", err.message || err);
            client.unbind();
            resolve(null);
          });
        });
      });
    });
  } catch (error) {
    console.error("LDAP search error:", error);
    return null;
  }
}

export async function createTestLDAPUser(): Promise<void> {
  const existingUser = await storage.getUserByUsername("testuser");
  if (existingUser) {
    return;
  }

  // Create a test LDAP user (no password needed as it's authenticated via LDAP)
  await storage.createUser({
    username: "testuser",
    email: "testuser@example.com",
    password: null,
    role: "standard",
    authMethod: "ldap",
  });
}

export async function testLDAPConnection(config: LDAPConfig, username: string, password: string): Promise<{ success: boolean; error?: string }> {
  try {
    const client = ldap.createClient({
      url: config.url,
      tlsOptions: config.tlsOptions || { rejectUnauthorized: false },
    });

    return new Promise((resolve) => {
      // Handle client connection errors to prevent server crash
      client.on('error', (err) => {
        console.error("LDAP client connection error:", err.message || err);
        resolve({ success: false, error: `Connection failed: ${err.message || err}` });
      });

      // Set a timeout for the connection attempt
      const timeout = setTimeout(() => {
        console.error("LDAP connection timeout");
        client.unbind();
        resolve({ success: false, error: "Connection timeout after 5 seconds" });
      }, 5000); // 5 second timeout

      // First bind with service account if provided, otherwise anonymous
      const bindDN = config.bindDN || "";
      const bindCredentials = config.bindCredentials || "";

      client.bind(bindDN, bindCredentials, (bindErr) => {
        clearTimeout(timeout);
        if (bindErr) {
          console.error("LDAP bind error:", bindErr);
          client.unbind();
          resolve({ success: false, error: `Authentication failed: ${bindErr.message || bindErr}` });
          return;
        }

        // If bind was successful, the LDAP connection is working
        console.log("LDAP bind successful - connection test passed");
        client.unbind();
        resolve({ success: true });
      });
    });
  } catch (error) {
    console.error("LDAP authentication error:", error);
    return { success: false, error: `Configuration error: ${error}` };
  }
}
