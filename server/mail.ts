import nodemailer from "nodemailer";
import { storage } from "./storage";

interface MailSettings {
  host: string;
  port: number;
  secure: boolean;
  auth: {
    user: string;
    pass: string;
  };
  from: string;
  enabled: boolean;
}

export async function getMailSettings(): Promise<MailSettings | null> {
  const setting = await storage.getSetting("mail_config");
  if (!setting?.value) {
    return null;
  }
  return setting.value as MailSettings;
}

export async function sendTestEmail(config: MailSettings, testEmail: string): Promise<boolean> {
  if (!config.enabled) {
    throw new Error("Mail service is not enabled");
  }

  const transporter = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure, // true for 465, false for other ports
    auth: {
      user: config.auth.user,
      pass: config.auth.pass,
    },
  });

  try {
    // Verify connection configuration
    await transporter.verify();

    // Send test email
    const info = await transporter.sendMail({
      from: config.from,
      to: testEmail,
      subject: "DataBoard Test Email",
      text: `This is a test email from DataBoard to verify your email configuration is working correctly.\n\nSent at: ${new Date().toISOString()}`,
      html: `
        <h2>DataBoard Test Email</h2>
        <p>This is a test email to verify your email configuration is working correctly.</p>
        <p><strong>Configuration details:</strong></p>
        <ul>
          <li>SMTP Host: ${config.host}</li>
          <li>Port: ${config.port}</li>
          <li>Secure: ${config.secure ? 'Yes' : 'No'}</li>
          <li>From Address: ${config.from}</li>
        </ul>
        <p><em>Sent at: ${new Date().toISOString()}</em></p>
        <hr>
        <small>This email was sent by DataBoard</small>
      `,
    });

    console.log("Test email sent:", info.messageId);
    return true;
  } catch (error) {
    console.error("Failed to send test email:", error);
    throw error;
  }
}

export async function sendPasswordResetEmail(userEmail: string, token: string): Promise<boolean> {
  const config = await getMailSettings();
  
  if (!config?.enabled) {
    console.log(`Password reset email would be sent to ${userEmail} with token: ${token}`);
    console.log(`Reset link: http://localhost:5000/password-reset?token=${token}`);
    return false; // Email not configured, but don't throw error
  }

  const transporter = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: {
      user: config.auth.user,
      pass: config.auth.pass,
    },
  });

  try {
    const resetUrl = `${process.env.FRONTEND_URL || 'http://localhost:5000'}/password-reset?token=${token}`;
    
    const info = await transporter.sendMail({
      from: config.from,
      to: userEmail,
      subject: "DataBoard Password Reset Request",
      text: `You have requested to reset your password for DataBoard.\n\nClick the following link to reset your password (link expires in 30 minutes):\n${resetUrl}\n\nIf you did not request this password reset, please ignore this email.\n\n`,
      html: `
        <div style="max-width: 600px; margin: 0 auto; font-family: Arial, sans-serif;">
          <h2 style="color: #333;">DataBoard Password Reset</h2>
          <p>You have requested to reset your password for DataBoard.</p>
          <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <p style="margin: 0; font-weight: bold;">Click the button below to reset your password:</p>
            <p style="margin: 20px 0;">
              <a href="${resetUrl}" style="background-color: #007bff; color: white; text-decoration: none; padding: 12px 24px; border-radius: 6px; display: inline-block;">Reset Password</a>
            </p>
            <p style="margin: 0; font-size: 14px; color: #666;">
              <strong>Important:</strong> This link will expire in 30 minutes and can only be used once.
            </p>
          </div>
          <p style="font-size: 14px; color: #666;">
            If the button doesn't work, copy and paste this URL into your browser:<br>
            <a href="${resetUrl}" style="color: #007bff;">${resetUrl}</a>
          </p>
          <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
          <p style="font-size: 12px; color: #888;">
            If you did not request this password reset, please ignore this email. Your account remains secure.
          </p>
        </div>
      `,
    });

    console.log("Password reset email sent:", info.messageId);
    return true;
  } catch (error) {
    console.error("Failed to send password reset email:", error);
    throw error;
  }
}