import prisma from '../../lib/prisma';
import { Response } from 'express';
import bcrypt from 'bcrypt';
import path from 'path';
import fs from 'fs';
import multer from 'multer';

const UPLOADS_ROOT = path.resolve(__dirname, '../../../uploads');
const LOGOS_UPLOAD_DIR = path.join(UPLOADS_ROOT, 'logos');

if (!fs.existsSync(LOGOS_UPLOAD_DIR)) {
  fs.mkdirSync(LOGOS_UPLOAD_DIR, { recursive: true });
}

// Multer disk storage for company logos
const logoStorage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    if (!fs.existsSync(LOGOS_UPLOAD_DIR)) {
      fs.mkdirSync(LOGOS_UPLOAD_DIR, { recursive: true });
    }
    cb(null, LOGOS_UPLOAD_DIR);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase() || '.png';
    const cleanName = path.basename(file.originalname, ext).replace(/[^a-zA-Z0-9_-]/g, '_');
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e6)}`;
    cb(null, `logo-${uniqueSuffix}-${cleanName}${ext}`);
  }
});

const logoFileFilter = (_req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const allowedMimes = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg'];
  if (allowedMimes.includes(file.mimetype.toLowerCase())) {
    cb(null, true);
  } else {
    cb(new Error('Only JPEG, PNG, and WEBP images are allowed as company logo.'));
  }
};

export const logoUploadMiddleware = multer({
  storage: logoStorage,
  fileFilter: logoFileFilter,
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB limit
}).single('logo');

export const getSettings = async (req: any, res: Response) => {
  try {
    const companyId = req.user.companyId;
    const userId = req.user.id || req.user.userId;

    const company = await prisma.company.findUnique({
      where: { id: companyId },
      include: {
        razorpaySettings: {
          select: {
            id: true,
            keyId: true,
            isEnabled: true,
            createdAt: true,
            updatedAt: true
          }
        }
      }
    });

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true, email: true, role: true }
    });

    res.json({ company, user, razorpaySettings: company?.razorpaySettings || null });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error });
  }
};

export const updateCompany = async (req: any, res: Response) => {
  try {
    const companyId = req.user.companyId;
    const { name, primaryColor, plan, logo } = req.body;
    const company = await prisma.company.update({
      where: { id: companyId },
      data: {
        name,
        primaryColor,
        plan,
        ...(logo !== undefined ? { logo } : {})
      }
    });
    res.json({ message: 'Company updated', company });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error });
  }
};

export const uploadCompanyLogo = async (req: any, res: Response) => {
  try {
    const companyId = req.user.companyId;
    if (!companyId) {
      return res.status(400).json({ message: 'Company ID missing from session' });
    }

    let logoUrl = '';

    // 1. Multipart file upload via req.file
    if (req.file) {
      logoUrl = `/uploads/logos/${req.file.filename}`;
    }
    // 2. Base64 payload fallback
    else if (req.body?.logoBase64) {
      const match = req.body.logoBase64.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
      if (!match) {
        return res.status(400).json({ message: 'Invalid Base64 image format' });
      }
      const mimeType = match[1];
      const base64Data = match[2];
      const ext = mimeType.includes('png') ? '.png' : mimeType.includes('svg') ? '.svg' : mimeType.includes('webp') ? '.webp' : '.jpg';
      const fileName = `logo-${Date.now()}-${Math.round(Math.random() * 1e6)}${ext}`;
      const filePath = path.join(LOGOS_UPLOAD_DIR, fileName);
      fs.writeFileSync(filePath, Buffer.from(base64Data, 'base64'));
      logoUrl = `/uploads/logos/${fileName}`;
    } else {
      return res.status(400).json({ message: 'No logo file or image data provided' });
    }

    // Remove old logo file if it exists in local storage
    const existing = await prisma.company.findUnique({ where: { id: companyId } });
    if (existing?.logo && existing.logo.startsWith('/uploads/logos/')) {
      const oldPath = path.join(UPLOADS_ROOT, existing.logo.replace('/uploads/', ''));
      if (fs.existsSync(oldPath)) {
        try { fs.unlinkSync(oldPath); } catch (_) {}
      }
    }

    const updated = await prisma.company.update({
      where: { id: companyId },
      data: { logo: logoUrl }
    });

    // Create audit log
    try {
      await prisma.auditLog.create({
        data: {
          companyId,
          userId: req.user.id || req.user.userId || null,
          userName: req.user.name || 'Admin',
          action: 'UPDATE_COMPANY_LOGO',
          entityType: 'Company',
          entityId: companyId,
          details: `Updated official company branding logo to ${logoUrl}`
        }
      });
    } catch (_) {}

    res.json({
      message: 'Company logo uploaded successfully',
      logo: logoUrl,
      company: updated
    });
  } catch (error: any) {
    console.error('Upload company logo error:', error);
    res.status(500).json({ message: error.message || 'Server error while uploading logo' });
  }
};

export const deleteCompanyLogo = async (req: any, res: Response) => {
  try {
    const companyId = req.user.companyId;
    const existing = await prisma.company.findUnique({ where: { id: companyId } });
    if (existing?.logo && existing.logo.startsWith('/uploads/logos/')) {
      const oldPath = path.join(UPLOADS_ROOT, existing.logo.replace('/uploads/', ''));
      if (fs.existsSync(oldPath)) {
        try { fs.unlinkSync(oldPath); } catch (_) {}
      }
    }

    const updated = await prisma.company.update({
      where: { id: companyId },
      data: { logo: null }
    });

    res.json({ message: 'Company logo removed successfully', company: updated });
  } catch (error: any) {
    res.status(500).json({ message: error.message || 'Server error while removing logo' });
  }
};

export const updateProfile = async (req: any, res: Response) => {
  try {
    const userId = req.user.id || req.user.userId;
    const { name, email } = req.body;
    const user = await prisma.user.update({
      where: { id: userId },
      data: { name, email },
      select: { id: true, name: true, email: true, role: true }
    });
    res.json({ message: 'Profile updated', user });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error });
  }
};

export const changePassword = async (req: any, res: Response) => {
  try {
    const userId = req.user.id || req.user.userId;
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ message: 'Both current and new password are required' });
    }
    if (newPassword.length < 6) {
      return res.status(400).json({ message: 'New password must be at least 6 characters' });
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return res.status(404).json({ message: 'User not found' });

    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: 'Current password is incorrect' });
    }

    const hashed = await bcrypt.hash(newPassword, 10);
    await prisma.user.update({ where: { id: userId }, data: { password: hashed } });

    res.json({ message: 'Password changed successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error });
  }
};

// ── RAZORPAY & CONNECTED BANKING SETTINGS ──────────────────────────────────────

export const getRazorpaySettings = async (req: any, res: Response) => {
  try {
    const companyId = req.user.companyId;
    const settings = await prisma.razorpaySettings.findUnique({ where: { companyId } });
    if (!settings) {
      return res.json({ configured: false, keyId: '', isEnabled: false });
    }
    return res.json({
      configured: true,
      keyId: settings.keyId,
      keySecretMasked: settings.keySecret ? `••••••••${settings.keySecret.slice(-4)}` : '',
      isEnabled: settings.isEnabled
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Server error' });
  }
};

export const updateRazorpaySettings = async (req: any, res: Response) => {
  try {
    const companyId = req.user.companyId;
    const { keyId, keySecret, isEnabled = true } = req.body;

    if (!keyId || !String(keyId).trim()) {
      return res.status(400).json({ error: 'Razorpay Key ID is required (e.g. rzp_live_... or rzp_test_...)' });
    }

    const existing = await prisma.razorpaySettings.findUnique({ where: { companyId } });

    // Keep existing secret if empty or unchanged
    let finalSecret = keySecret ? String(keySecret).trim() : '';
    if (!finalSecret || finalSecret.includes('••••')) {
      finalSecret = existing?.keySecret || '';
    }

    if (!finalSecret) {
      return res.status(400).json({ error: 'Razorpay Key Secret is required' });
    }

    const saved = await prisma.razorpaySettings.upsert({
      where: { companyId },
      create: {
        companyId,
        keyId: String(keyId).trim(),
        keySecret: finalSecret,
        isEnabled: Boolean(isEnabled)
      },
      update: {
        keyId: String(keyId).trim(),
        keySecret: finalSecret,
        isEnabled: Boolean(isEnabled)
      }
    });

    return res.json({
      success: true,
      message: 'Razorpay credentials saved successfully',
      settings: {
        keyId: saved.keyId,
        isEnabled: saved.isEnabled
      }
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Failed to save Razorpay settings' });
  }
};

export const testRazorpayConnection = async (req: any, res: Response) => {
  try {
    const companyId = req.user.companyId;
    const settings = await prisma.razorpaySettings.findUnique({ where: { companyId } });

    const keyId = req.body.keyId ? String(req.body.keyId).trim() : settings?.keyId;
    let keySecret = req.body.keySecret ? String(req.body.keySecret).trim() : '';
    if (!keySecret || keySecret.includes('••••')) {
      keySecret = settings?.keySecret || '';
    }

    if (!keyId || !keySecret) {
      return res.status(400).json({ error: 'Razorpay Key ID and Key Secret are required to test connection' });
    }

    // Ping Razorpay API endpoint with basic auth
    const authHeader = 'Basic ' + Buffer.from(`${keyId}:${keySecret}`).toString('base64');
    const rzpRes = await (globalThis as any).fetch('https://api.razorpay.com/v1/payments?count=1', {
      headers: { Authorization: authHeader }
    });

    if (rzpRes.ok) {
      return res.json({
        success: true,
        message: 'Connection verified! Razorpay account is active and authenticated.'
      });
    } else {
      const errData = await rzpRes.json().catch(() => ({}));
      return res.status(400).json({
        success: false,
        error: errData.error?.description || 'Authentication failed. Please verify your Key ID and Key Secret.'
      });
    }
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Failed to connect to Razorpay' });
  }
};
