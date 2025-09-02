import bcrypt from "bcrypt";
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
  }

  // Update last login
  await storage.updateUser(user.id, { lastLogin: new Date() });
  
  return user;
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
