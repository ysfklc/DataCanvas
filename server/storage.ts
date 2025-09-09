import { 
  users, dashboards, dataSources, dashboardCards, settings, passwordResetTokens, ldapSettings, mailSettings,
  type User, type InsertUser, 
  type Dashboard, type InsertDashboard,
  type DataSource, type InsertDataSource,
  type DashboardCard, type InsertDashboardCard,
  type Setting, type InsertSetting,
  type LdapSettings, type InsertLdapSettings,
  type MailSettings, type InsertMailSettings,
  type PasswordResetToken, type InsertPasswordResetToken
} from "@shared/schema";
import { db } from "./db";
import { eq, and, lt } from "drizzle-orm";
import crypto from "crypto";

// Encryption functions for settings passwords (using symmetric encryption)
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'fallback-key-32-chars-long-12345';
const ALGORITHM = 'aes-256-cbc';

function encryptPassword(password: string): string {
  if (!password || password.trim() === "") {
    return "";
  }
  
  const iv = crypto.randomBytes(16);
  const key = crypto.createHash('sha256').update(ENCRYPTION_KEY).digest();
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  
  let encrypted = cipher.update(password, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  // Combine IV and encrypted data
  return iv.toString('hex') + ':' + encrypted;
}

function decryptPassword(encryptedPassword: string): string {
  if (!encryptedPassword || encryptedPassword.trim() === "") {
    return "";
  }
  
  try {
    const parts = encryptedPassword.split(':');
    if (parts.length !== 2) {
      return encryptedPassword; // Return as-is if not encrypted format (backward compatibility)
    }
    
    const iv = Buffer.from(parts[0], 'hex');
    const encrypted = parts[1];
    const key = crypto.createHash('sha256').update(ENCRYPTION_KEY).digest();
    
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  } catch (error) {
    console.error('Failed to decrypt password:', error);
    return encryptedPassword; // Return as-is if decryption fails (backward compatibility)
  }
}

export interface IStorage {
  // Users
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: string, user: Partial<InsertUser>): Promise<User>;
  deleteUser(id: string): Promise<void>;
  getAllUsers(): Promise<User[]>;
  
  // Dashboards
  getDashboard(id: string): Promise<Dashboard | undefined>;
  getDashboardsByUser(userId: string): Promise<Dashboard[]>;
  getAllDashboards(): Promise<Dashboard[]>;
  getPublicDashboards(): Promise<Dashboard[]>;
  createDashboard(dashboard: InsertDashboard): Promise<Dashboard>;
  updateDashboard(id: string, dashboard: Partial<InsertDashboard>): Promise<Dashboard>;
  deleteDashboard(id: string): Promise<void>;
  
  // Data Sources
  getDataSource(id: string): Promise<DataSource | undefined>;
  getAllDataSources(): Promise<DataSource[]>;
  createDataSource(dataSource: InsertDataSource): Promise<DataSource>;
  updateDataSource(id: string, dataSource: Partial<InsertDataSource>): Promise<DataSource>;
  deleteDataSource(id: string): Promise<void>;
  
  // Dashboard Cards
  getDashboardCard(id: string): Promise<DashboardCard | undefined>;
  getCardsByDashboard(dashboardId: string): Promise<DashboardCard[]>;
  createDashboardCard(card: InsertDashboardCard): Promise<DashboardCard>;
  updateDashboardCard(id: string, card: Partial<InsertDashboardCard>): Promise<DashboardCard>;
  deleteDashboardCard(id: string): Promise<void>;
  
  // Settings
  getSetting(key: string): Promise<Setting | undefined>;
  getAllSettings(): Promise<Setting[]>;
  setSetting(setting: InsertSetting): Promise<Setting>;
  
  // LDAP Settings
  getLdapSettings(): Promise<LdapSettings | undefined>;
  createLdapSettings(settings: InsertLdapSettings): Promise<LdapSettings>;
  updateLdapSettings(settings: Partial<InsertLdapSettings>): Promise<LdapSettings>;
  
  // Mail Settings
  getMailSettings(): Promise<MailSettings | undefined>;
  createMailSettings(settings: InsertMailSettings): Promise<MailSettings>;
  updateMailSettings(settings: Partial<InsertMailSettings>): Promise<MailSettings>;
  
  // Password Reset Tokens
  createPasswordResetToken(token: InsertPasswordResetToken): Promise<PasswordResetToken>;
  getPasswordResetToken(token: string): Promise<PasswordResetToken | undefined>;
  markTokenAsUsed(tokenId: string): Promise<void>;
  cleanupExpiredTokens(): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  // Users
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user || undefined;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user || undefined;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db.insert(users).values(insertUser).returning();
    return user;
  }

  async updateUser(id: string, updateUser: Partial<InsertUser>): Promise<User> {
    const [user] = await db.update(users).set(updateUser).where(eq(users.id, id)).returning();
    return user;
  }

  async deleteUser(id: string): Promise<void> {
    await db.delete(users).where(eq(users.id, id));
  }

  async getAllUsers(): Promise<User[]> {
    return await db.select().from(users);
  }

  // Dashboards
  async getDashboard(id: string): Promise<Dashboard | undefined> {
    const [dashboard] = await db.select().from(dashboards).where(eq(dashboards.id, id));
    return dashboard || undefined;
  }

  async getDashboardsByUser(userId: string): Promise<Dashboard[]> {
    return await db.select().from(dashboards).where(eq(dashboards.ownerId, userId));
  }

  async getAllDashboards(): Promise<Dashboard[]> {
    return await db.select().from(dashboards);
  }

  async getPublicDashboards(): Promise<Dashboard[]> {
    return await db.select().from(dashboards).where(eq(dashboards.isPublic, true));
  }

  async createDashboard(insertDashboard: InsertDashboard): Promise<Dashboard> {
    const [dashboard] = await db.insert(dashboards).values(insertDashboard).returning();
    return dashboard;
  }

  async updateDashboard(id: string, updateDashboard: Partial<InsertDashboard>): Promise<Dashboard> {
    const [dashboard] = await db.update(dashboards).set({
      ...updateDashboard,
      updatedAt: new Date(),
    }).where(eq(dashboards.id, id)).returning();
    return dashboard;
  }

  async deleteDashboard(id: string): Promise<void> {
    await db.delete(dashboards).where(eq(dashboards.id, id));
  }

  // Data Sources
  async getDataSource(id: string): Promise<DataSource | undefined> {
    const [dataSource] = await db.select().from(dataSources).where(eq(dataSources.id, id));
    return dataSource || undefined;
  }

  async getAllDataSources(): Promise<DataSource[]> {
    return await db.select().from(dataSources);
  }

  async createDataSource(insertDataSource: InsertDataSource): Promise<DataSource> {
    const [dataSource] = await db.insert(dataSources).values(insertDataSource).returning();
    return dataSource;
  }

  async updateDataSource(id: string, updateDataSource: Partial<InsertDataSource>): Promise<DataSource> {
    const [dataSource] = await db.update(dataSources).set(updateDataSource).where(eq(dataSources.id, id)).returning();
    return dataSource;
  }

  async deleteDataSource(id: string): Promise<void> {
    await db.delete(dataSources).where(eq(dataSources.id, id));
  }

  // Dashboard Cards
  async getDashboardCard(id: string): Promise<DashboardCard | undefined> {
    const [card] = await db.select().from(dashboardCards).where(eq(dashboardCards.id, id));
    return card || undefined;
  }

  async getCardsByDashboard(dashboardId: string): Promise<DashboardCard[]> {
    return await db.select().from(dashboardCards).where(eq(dashboardCards.dashboardId, dashboardId));
  }

  async createDashboardCard(insertCard: InsertDashboardCard): Promise<DashboardCard> {
    const [card] = await db.insert(dashboardCards).values(insertCard).returning();
    return card;
  }

  async updateDashboardCard(id: string, updateCard: Partial<InsertDashboardCard>): Promise<DashboardCard> {
    const [card] = await db.update(dashboardCards).set(updateCard).where(eq(dashboardCards.id, id)).returning();
    return card;
  }

  async deleteDashboardCard(id: string): Promise<void> {
    await db.delete(dashboardCards).where(eq(dashboardCards.id, id));
  }

  // Settings
  async getSetting(key: string): Promise<Setting | undefined> {
    const [setting] = await db.select().from(settings).where(eq(settings.key, key));
    return setting || undefined;
  }

  async getAllSettings(): Promise<Setting[]> {
    return await db.select().from(settings);
  }

  async setSetting(insertSetting: InsertSetting): Promise<Setting> {
    const [setting] = await db
      .insert(settings)
      .values(insertSetting)
      .onConflictDoUpdate({
        target: settings.key,
        set: { value: insertSetting.value, updatedAt: new Date() },
      })
      .returning();
    return setting;
  }

  // LDAP Settings
  async getLdapSettings(): Promise<LdapSettings | undefined> {
    const [setting] = await db.select().from(ldapSettings).limit(1);
    if (setting && setting.bindCredentials) {
      // Decrypt the password when retrieving
      setting.bindCredentials = decryptPassword(setting.bindCredentials);
    }
    return setting || undefined;
  }

  async createLdapSettings(insertLdapSettings: InsertLdapSettings): Promise<LdapSettings> {
    // Delete any existing records to enforce single record constraint
    await db.delete(ldapSettings);
    
    // Encrypt password before storing
    if (insertLdapSettings.bindCredentials) {
      insertLdapSettings.bindCredentials = encryptPassword(insertLdapSettings.bindCredentials);
    }
    
    const [setting] = await db.insert(ldapSettings).values(insertLdapSettings).returning();
    
    // Decrypt password before returning
    if (setting.bindCredentials) {
      setting.bindCredentials = decryptPassword(setting.bindCredentials);
    }
    
    return setting;
  }

  async updateLdapSettings(updateLdapSettings: Partial<InsertLdapSettings>): Promise<LdapSettings> {
    // Encrypt password if provided
    if (updateLdapSettings.bindCredentials) {
      updateLdapSettings.bindCredentials = encryptPassword(updateLdapSettings.bindCredentials);
    }
    
    // First, check if any LDAP settings exist
    const existing = await db.select().from(ldapSettings).limit(1);
    
    if (existing.length > 0) {
      // Update existing record
      const [setting] = await db.update(ldapSettings)
        .set({
          ...updateLdapSettings,
          updatedAt: new Date(),
        })
        .where(eq(ldapSettings.id, existing[0].id))
        .returning();
      
      // Decrypt password before returning
      if (setting.bindCredentials) {
        setting.bindCredentials = decryptPassword(setting.bindCredentials);
      }
      
      return setting;
    } else {
      // Create new record if none exists
      return await this.createLdapSettings(updateLdapSettings as InsertLdapSettings);
    }
  }

  // Mail Settings
  async getMailSettings(): Promise<MailSettings | undefined> {
    const [setting] = await db.select().from(mailSettings).limit(1);
    if (setting && setting.authPass) {
      // Decrypt the password when retrieving
      setting.authPass = decryptPassword(setting.authPass);
    }
    return setting || undefined;
  }

  async createMailSettings(insertMailSettings: InsertMailSettings): Promise<MailSettings> {
    // Delete any existing records to enforce single record constraint
    await db.delete(mailSettings);
    
    // Encrypt password before storing
    if (insertMailSettings.authPass) {
      insertMailSettings.authPass = encryptPassword(insertMailSettings.authPass);
    }
    
    const [setting] = await db.insert(mailSettings).values(insertMailSettings).returning();
    
    // Decrypt password before returning
    if (setting.authPass) {
      setting.authPass = decryptPassword(setting.authPass);
    }
    
    return setting;
  }

  async updateMailSettings(updateMailSettings: Partial<InsertMailSettings>): Promise<MailSettings> {
    // Encrypt password if provided
    if (updateMailSettings.authPass) {
      updateMailSettings.authPass = encryptPassword(updateMailSettings.authPass);
    }
    
    // First, check if any mail settings exist
    const existing = await db.select().from(mailSettings).limit(1);
    
    if (existing.length > 0) {
      // Update existing record
      const [setting] = await db.update(mailSettings)
        .set({
          ...updateMailSettings,
          updatedAt: new Date(),
        })
        .where(eq(mailSettings.id, existing[0].id))
        .returning();
      
      // Decrypt password before returning
      if (setting.authPass) {
        setting.authPass = decryptPassword(setting.authPass);
      }
      
      return setting;
    } else {
      // Create new record if none exists
      return await this.createMailSettings(updateMailSettings as InsertMailSettings);
    }
  }

  // Password Reset Tokens
  async createPasswordResetToken(insertToken: InsertPasswordResetToken): Promise<PasswordResetToken> {
    const [token] = await db.insert(passwordResetTokens).values(insertToken).returning();
    return token;
  }

  async getPasswordResetToken(tokenValue: string): Promise<PasswordResetToken | undefined> {
    const [token] = await db.select().from(passwordResetTokens).where(
      and(
        eq(passwordResetTokens.token, tokenValue),
        eq(passwordResetTokens.isUsed, false)
      )
    );
    return token || undefined;
  }

  async markTokenAsUsed(tokenId: string): Promise<void> {
    await db.update(passwordResetTokens)
      .set({ isUsed: true })
      .where(eq(passwordResetTokens.id, tokenId));
  }

  async cleanupExpiredTokens(): Promise<void> {
    await db.delete(passwordResetTokens)
      .where(lt(passwordResetTokens.expiresAt, new Date()));
  }
}

export const storage = new DatabaseStorage();
