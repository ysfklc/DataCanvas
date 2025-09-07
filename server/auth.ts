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

  if (!user || !user.password || !user.isActive) {
    return null;
  }

  // For local authentication, verify password
  if (user.authMethod === "local") {
    const isValid = await comparePassword(password, user.password);
    if (!isValid) {
      return null;
    }
  } else if (user.authMethod === "ldap") {
    const isValid = await authenticateLDAP(identifier, password);
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
    const ldapSettings = await storage.getSetting("ldap_config");
    if (!ldapSettings) {
      console.error("LDAP configuration not found");
      return false;
    }

    const config = ldapSettings.value as LDAPConfig;
    const client = ldap.createClient({
      url: config.url,
      tlsOptions: config.tlsOptions || { rejectUnauthorized: false },
    });

    return new Promise((resolve) => {
      // First bind with service account if provided, otherwise anonymous
      const bindDN = config.bindDN || "";
      const bindCredentials = config.bindCredentials || "";

      client.bind(bindDN, bindCredentials, (bindErr) => {
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
  const existingConfig = await storage.getSetting("ldap_config");
  if (existingConfig) {
    return;
  }

  // Create test LDAP configuration
  const testLDAPConfig: LDAPConfig = {
    url: "ldap://localhost:389",
    baseDN: "dc=example,dc=com",
    bindDN: "cn=admin,dc=example,dc=com",
    bindCredentials: "admin",
    searchFilter: "(uid={username})",
    tlsOptions: {
      rejectUnauthorized: false,
    },
  };

  await storage.setSetting({
    key: "ldap_config",
    value: testLDAPConfig,
  });
}

export async function searchLDAPUser(username: string): Promise<any | null> {
  try {
    // Get LDAP configuration from settings
    const ldapSettings = await storage.getSetting("ldap_config");
    if (!ldapSettings) {
      console.error("LDAP configuration not found");
      return null;
    }

    const config = ldapSettings.value as LDAPConfig;
    console.log(`LDAP search for user: ${username}`);
    console.log(`LDAP config - URL: ${config.url}, baseDN: ${config.baseDN}, searchFilter: ${config.searchFilter}`);
    
    const client = ldap.createClient({
      url: config.url,
      tlsOptions: config.tlsOptions || { rejectUnauthorized: false },
    });

    return new Promise((resolve) => {
      // First bind with service account if provided, otherwise anonymous
      const bindDN = config.bindDN || "";
      const bindCredentials = config.bindCredentials || "";

      console.log(`Attempting LDAP bind with DN: ${bindDN}`);
      client.bind(bindDN, bindCredentials, (bindErr) => {
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
