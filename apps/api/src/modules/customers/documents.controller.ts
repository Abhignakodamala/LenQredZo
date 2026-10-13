import { Response } from 'express';
import path from 'path';
import fs from 'fs';
import multer from 'multer';
import prisma from '../../lib/prisma';
import { logAudit } from '../../utils/audit';

const UPLOADS_ROOT = path.resolve(__dirname, '../../../uploads');
const KYC_UPLOAD_DIR = path.join(UPLOADS_ROOT, 'kyc');

if (!fs.existsSync(KYC_UPLOAD_DIR)) {
  fs.mkdirSync(KYC_UPLOAD_DIR, { recursive: true });
}

// Multer disk storage config
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, KYC_UPLOAD_DIR);
  },
  filename: (_req, file, cb) => {
    const cleanName = file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e6)}`;
    cb(null, `${uniqueSuffix}-${cleanName}`);
  }
});

const fileFilter = (_req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const allowedMimes = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg', 'application/pdf'];
  if (allowedMimes.includes(file.mimetype.toLowerCase())) {
    cb(null, true);
  } else {
    cb(new Error('Only JPEG, PNG, WEBP, and PDF documents are allowed.'));
  }
};

const formatDocTypeName = (t: string) => {
  const map: Record<string, string> = {
    aadhar_front: 'Aadhaar Card (Front)',
    aadhar_back: 'Aadhaar Card (Back)',
    pan_card: 'PAN Card',
    photo: 'Borrower Photo',
    bank_passbook: 'Bank Passbook / Statement',
    salary_slip: 'Salary Slip',
    cheque: 'Cancelled Cheque',
    other: 'Supporting Document'
  };
  return map[t] || (t ? t.replace(/_/g, ' ').toUpperCase() : 'Document');
};

export const uploadMiddleware = multer({
  storage,
  fileFilter,
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
}).single('file');

// Helper to check customer access
async function findAuthorizedCustomer(customerId: number, user: any) {
  const customer = await prisma.customer.findUnique({
    where: { id: customerId }
  });
  if (!customer || customer.companyId !== user.companyId) {
    return null;
  }
  return customer;
}

/**
 * Upload a document for a customer
 * Supports both multipart form (req.file) and Base64 JSON payload
 */
export const uploadDocument = async (req: any, res: Response) => {
  try {
    const customerId = Number(req.params.id);
    if (isNaN(customerId)) {
      return res.status(400).json({ error: 'Invalid customer ID' });
    }

    const customer = await findAuthorizedCustomer(customerId, req.user);
    if (!customer) {
      return res.status(404).json({ error: 'Customer not found' });
    }

    let fileName = '';
    let fileUrl = '';
    let fileSize = 0;
    let mimeType = '';
    const docType = req.body.docType || 'other';

    if (req.file) {
      fileName = req.file.originalname;
      fileUrl = `/uploads/kyc/${req.file.filename}`;
      fileSize = req.file.size;
      mimeType = req.file.mimetype;
    } else if (req.body.base64Data) {
      // Base64 upload fallback
      const base64Data = req.body.base64Data;
      const originalName = req.body.fileName || `document-${Date.now()}.png`;
      mimeType = req.body.mimeType || 'image/png';

      const match = base64Data.match(/^data:([a-zA-Z0-9]+\/[a-zA-Z0-9-.+]+);base64,(.+)$/);
      const rawBase64 = match ? match[2] : base64Data;
      if (match) mimeType = match[1];

      const buffer = Buffer.from(rawBase64, 'base64');
      fileSize = buffer.length;

      const cleanName = originalName.replace(/[^a-zA-Z0-9.-]/g, '_');
      const uniqueName = `${Date.now()}-${Math.round(Math.random() * 1e6)}-${cleanName}`;
      const filePath = path.join(KYC_UPLOAD_DIR, uniqueName);

      fs.writeFileSync(filePath, buffer);
      fileName = originalName;
      fileUrl = `/uploads/kyc/${uniqueName}`;
    } else {
      return res.status(400).json({ error: 'No file uploaded or file payload missing' });
    }

    const document = await prisma.customerDocument.create({
      data: {
        customerId,
        companyId: req.user.companyId,
        docType,
        fileName,
        fileUrl,
        fileSize,
        mimeType,
        status: 'pending'
      }
    });

    // If customer was in 'pending' status, transition them to 'submitted'
    if (customer.kycStatus === 'pending') {
      await prisma.customer.update({
        where: { id: customerId },
        data: { kycStatus: 'submitted' }
      });
    }

    const friendlyDoc = formatDocTypeName(docType);
    await logAudit({
      req,
      action: 'UPLOAD_CUSTOMER_DOCUMENT',
      entityType: 'CustomerDocument',
      entityId: document.id,
      details: `Uploaded ${friendlyDoc} (${fileName}) for customer #${customerId}`
    });

    return res.status(201).json(document);
  } catch (error: any) {
    console.error('Upload document error:', error);
    return res.status(500).json({ error: error.message || 'Failed to upload document' });
  }
};

/**
 * List documents for a customer
 */
export const getCustomerDocuments = async (req: any, res: Response) => {
  try {
    const customerId = Number(req.params.id);
    if (isNaN(customerId)) {
      return res.status(400).json({ error: 'Invalid customer ID' });
    }

    const customer = await findAuthorizedCustomer(customerId, req.user);
    if (!customer) {
      return res.status(404).json({ error: 'Customer not found' });
    }

    const documents = await prisma.customerDocument.findMany({
      where: { customerId, companyId: req.user.companyId },
      orderBy: { createdAt: 'desc' }
    });

    return res.json(documents);
  } catch (error: any) {
    console.error('Get customer documents error:', error);
    return res.status(500).json({ error: 'Failed to retrieve documents' });
  }
};

/**
 * Verify or Reject a single customer document
 */
export const verifyCustomerDocument = async (req: any, res: Response) => {
  try {
    const customerId = Number(req.params.id);
    const docId = Number(req.params.docId);
    const { status, rejectionReason } = req.body;

    if (!['verified', 'rejected', 'pending'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status. Must be verified, rejected, or pending' });
    }

    const document = await prisma.customerDocument.findFirst({
      where: { id: docId, customerId, companyId: req.user.companyId }
    });

    if (!document) {
      return res.status(404).json({ error: 'Document not found' });
    }

    const verifierName = req.user.name || req.user.email || 'Staff';

    const updated = await prisma.customerDocument.update({
      where: { id: docId },
      data: {
        status,
        rejectionReason: status === 'rejected' ? rejectionReason || 'Document details could not be validated' : null,
        verifiedBy: status === 'verified' ? verifierName : null,
        verifiedAt: status === 'verified' ? new Date() : null
      }
    });

    // Check if all uploaded documents are verified to optionally auto-update customer kycStatus
    const allDocs = await prisma.customerDocument.findMany({
      where: { customerId, companyId: req.user.companyId }
    });

    const hasRejected = allDocs.some(d => d.status === 'rejected');
    const allVerified = allDocs.length > 0 && allDocs.every(d => d.status === 'verified');

    if (hasRejected) {
      await prisma.customer.update({
        where: { id: customerId },
        data: { kycStatus: 'rejected' }
      });
    } else if (allVerified) {
      await prisma.customer.update({
        where: { id: customerId },
        data: { kycStatus: 'verified' }
      });
    }

    const friendlyDoc = formatDocTypeName(document.docType);
    const actionVerb = status === 'verified' ? 'Approved & verified' : status === 'rejected' ? 'Rejected' : 'Reviewed';
    const reasonText = status === 'rejected' && rejectionReason ? ` (Reason: "${rejectionReason}")` : '';
    await logAudit({
      req,
      action: status === 'verified' ? 'VERIFY_CUSTOMER_DOCUMENT' : 'REJECT_CUSTOMER_DOCUMENT',
      entityType: 'CustomerDocument',
      entityId: docId,
      details: `${actionVerb} ${friendlyDoc} for customer #${customerId}${reasonText}`
    });

    return res.json(updated);
  } catch (error: any) {
    console.error('Verify document error:', error);
    return res.status(500).json({ error: 'Failed to update document verification' });
  }
};

/**
 * Delete a customer document
 */
export const deleteCustomerDocument = async (req: any, res: Response) => {
  try {
    const customerId = Number(req.params.id);
    const docId = Number(req.params.docId);

    const document = await prisma.customerDocument.findFirst({
      where: { id: docId, customerId, companyId: req.user.companyId }
    });

    if (!document) {
      return res.status(404).json({ error: 'Document not found' });
    }

    // Try deleting physical file from disk
    try {
      const fileName = path.basename(document.fileUrl);
      const filePath = path.join(KYC_UPLOAD_DIR, fileName);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    } catch (fsErr) {
      console.warn('Could not remove file from disk:', fsErr);
    }

    await prisma.customerDocument.delete({
      where: { id: docId }
    });

    const friendlyDoc = formatDocTypeName(document.docType);
    await logAudit({
      req,
      action: 'DELETE_CUSTOMER_DOCUMENT',
      entityType: 'CustomerDocument',
      entityId: docId,
      details: `Deleted ${friendlyDoc} for customer #${customerId}`
    });

    return res.json({ success: true, message: 'Document deleted successfully' });
  } catch (error: any) {
    console.error('Delete document error:', error);
    return res.status(500).json({ error: 'Failed to delete document' });
  }
};

/**
 * Update overall Customer KYC status directly
 */
export const updateCustomerKycStatus = async (req: any, res: Response) => {
  try {
    const customerId = Number(req.params.id);
    const { kycStatus } = req.body;

    if (!['pending', 'submitted', 'verified', 'rejected'].includes(kycStatus)) {
      return res.status(400).json({ error: 'Invalid KYC status' });
    }

    const customer = await findAuthorizedCustomer(customerId, req.user);
    if (!customer) {
      return res.status(404).json({ error: 'Customer not found' });
    }

    if (kycStatus === 'verified') {
      const docs = await prisma.customerDocument.findMany({
        where: { customerId, companyId: req.user.companyId }
      });
      const hasAadhaar = docs.some(d => (d.docType === 'aadhar_front' || d.docType === 'aadhar_back') && d.status === 'verified');
      const hasPan = docs.some(d => d.docType === 'pan_card' && d.status === 'verified');
      const hasPhoto = docs.some(d => d.docType === 'photo');

      if (!hasAadhaar || !hasPan || !hasPhoto) {
        return res.status(400).json({
          error: 'Cannot mark KYC as verified: Verified Aadhaar, Verified PAN, and Borrower Photo are mandatory.'
        });
      }
    }

    const updated = await prisma.customer.update({
      where: { id: customerId },
      data: { kycStatus }
    });

    const prevStatus = customer.kycStatus ? customer.kycStatus.toUpperCase() : 'PENDING';
    const nextStatus = kycStatus.toUpperCase();
    await logAudit({
      req,
      action: 'UPDATE_CUSTOMER_KYC_STATUS',
      entityType: 'Customer',
      entityId: customerId,
      details: `KYC status updated from ${prevStatus} to ${nextStatus} for customer #${customerId}`
    });

    return res.json({ success: true, kycStatus: updated.kycStatus });
  } catch (error: any) {
    console.error('Update KYC status error:', error);
    return res.status(500).json({ error: 'Failed to update customer KYC status' });
  }
};
