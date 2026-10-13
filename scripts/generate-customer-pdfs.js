/**
 * Pure Node.js Standard PDF Generator
 * Generates valid, self-contained PDF 1.4 documents without external dependencies.
 */
const fs = require('fs');
const path = require('path');

function createPdfBuffer({ title, subtitle, customerData }) {
  // Build stream content for Helvetica text
  const lines = [
    'BT',
    '/F1 20 Tf',
    '50 740 Td',
    `(${escapePdf(title)}) Tj`,
    'ET',
    'BT',
    '/F1 11 Tf',
    '50 718 Td',
    `(${escapePdf(subtitle)}) Tj`,
    'ET',
    // Horizontal separator
    '0.75 0.75 0.75 RG',
    '1 w',
    '50 705 m 560 705 l S',
    '0 0 0 RG'
  ];

  let currentY = 680;

  for (const section of customerData) {
    if (currentY < 120) break; // stay on page

    // Section Header
    lines.push(
      '0.12 0.23 0.54 rg', // Navy color
      'BT',
      '/F1 13 Tf',
      `50 ${currentY} Td`,
      `(${escapePdf(section.category.toUpperCase())}) Tj`,
      'ET',
      '0 0 0 rg'
    );
    currentY -= 20;

    // Key-Value pairs
    for (const [key, value] of Object.entries(section.fields)) {
      lines.push(
        '0.3 0.3 0.3 rg',
        'BT',
        '/F1 10 Tf',
        `60 ${currentY} Td`,
        `(${escapePdf(key)}:) Tj`,
        'ET',
        '0 0 0 rg',
        'BT',
        '/F1 10 Tf',
        `220 ${currentY} Td`,
        `(${escapePdf(String(value))}) Tj`,
        'ET'
      );
      currentY -= 17;
    }

    currentY -= 10;
  }

  // Footer
  lines.push(
    '0.8 0.8 0.8 RG',
    '50 50 m 560 50 l S',
    '0.5 0.5 0.5 rg',
    'BT',
    '/F1 8 Tf',
    '50 38 Td',
    '(FinSmart AI / LenQredZo Automated Document Ingestion & Verification System - Confidential) Tj',
    'ET'
  );

  const streamContent = lines.join('\n');
  const streamLength = Buffer.byteLength(streamContent, 'utf-8');

  // Construct PDF Objects
  const objects = [];

  // 1: Catalog
  objects.push('1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n');

  // 2: Pages
  objects.push('2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n');

  // 3: Page
  objects.push(
    '3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>\nendobj\n'
  );

  // 4: Contents
  objects.push(
    `4 0 obj\n<< /Length ${streamLength} >>\nstream\n${streamContent}\nendstream\nendobj\n`
  );

  // 5: Font
  objects.push(
    '5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n'
  );

  // Calculate byte offsets for XRef table
  const header = '%PDF-1.4\n%\xE2\xE3\xCF\xD3\n';
  let currentOffset = Buffer.byteLength(header, 'latin1');
  const offsets = [0]; // object 0 offset is always 0

  for (const obj of objects) {
    offsets.push(currentOffset);
    currentOffset += Buffer.byteLength(obj, 'latin1');
  }

  const xrefOffset = currentOffset;
  let xref = `xref\n0 ${objects.length + 1}\n0000000000 65535 f \r\n`;
  for (let i = 1; i <= objects.length; i++) {
    xref += String(offsets[i]).padStart(10, '0') + ' 00000 n \r\n';
  }

  const trailer = `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;

  const fullPdf = header + objects.join('') + xref + trailer;
  return Buffer.from(fullPdf, 'latin1');
}

function escapePdf(text) {
  return String(text)
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)')
    .replace(/[^\x20-\x7E]/g, '?');
}

// Sample Customers Data
const customers = [
  {
    fileName: '01_Rajesh_Verma_Customer_Details.pdf',
    title: 'CUSTOMER PROFILE & LOAN APPLICATION',
    subtitle: 'FinSmart Lending Services - Applicant Reference ID: CUST-2026-081',
    data: [
      {
        category: 'Personal Identification',
        fields: {
          'Full Name': 'Rajesh Verma',
          'Phone Number': '+91 98765 43210',
          'Email': 'rajesh.verma@example.com',
          'Date of Birth': '14-Aug-1988 (Age: 38)',
          'Gender': 'Male',
          'Residential Address': 'Flat 402, Sai Residency, Ameerpet, Hyderabad - 500016',
          'Aadhaar Number': 'XXXX-XXXX-8492',
          'PAN Card': 'ABCDE1234F'
        }
      },
      {
        category: 'Banking Particulars',
        fields: {
          'Bank Name': 'State Bank of India',
          'Account Number': '384920194857',
          'IFSC Code': 'SBIN0000847',
          'Branch': 'Ameerpet Main Branch',
          'Account Holder': 'RAJESH VERMA',
          'Account Status': 'Active / Verified'
        }
      },
      {
        category: 'Employment & Loan Request',
        fields: {
          'Employment Type': 'Salaried - Senior Software Engineer',
          'Employer Name': 'Infosys Technologies Ltd',
          'Monthly Net Income': 'Rs. 85,000',
          'Requested Loan Type': 'Personal Loan',
          'Requested Principal': 'Rs. 2,00,000',
          'Requested Tenure': '12 Months (Monthly EMI)',
          'Assigned Branch': 'Hyderabad City Branch'
        }
      }
    ]
  },
  {
    fileName: '02_Priya_Sharma_Customer_Details.pdf',
    title: 'CUSTOMER PROFILE & LOAN APPLICATION',
    subtitle: 'FinSmart Lending Services - Applicant Reference ID: CUST-2026-082',
    data: [
      {
        category: 'Personal Identification',
        fields: {
          'Full Name': 'Priya Sharma',
          'Phone Number': '+91 98230 11223',
          'Email': 'priya.sharma91@example.com',
          'Date of Birth': '22-Mar-1991 (Age: 35)',
          'Gender': 'Female',
          'Residential Address': 'Plot 18, Road No. 4, Jubilee Hills, Hyderabad - 500033',
          'Aadhaar Number': 'XXXX-XXXX-3341',
          'PAN Card': 'BKWPS9912K'
        }
      },
      {
        category: 'Banking Particulars',
        fields: {
          'Bank Name': 'HDFC Bank',
          'Account Number': '50100482910394',
          'IFSC Code': 'HDFC0000542',
          'Branch': 'Jubilee Hills Branch',
          'Account Holder': 'PRIYA SHARMA',
          'Account Status': 'Active / Verified'
        }
      },
      {
        category: 'Employment & Loan Request',
        fields: {
          'Employment Type': 'Business Owner - Retail Boutique',
          'Business Name': 'Shree Collections & Textiles',
          'Monthly Net Income': 'Rs. 1,20,000',
          'Requested Loan Type': 'Small Business Loan',
          'Requested Principal': 'Rs. 3,50,000',
          'Requested Tenure': '18 Months (Monthly EMI)',
          'Assigned Branch': 'Banjara Hills Branch'
        }
      }
    ]
  },
  {
    fileName: '03_Mohammed_Irfan_Customer_Details.pdf',
    title: 'CUSTOMER PROFILE & LOAN APPLICATION',
    subtitle: 'FinSmart Lending Services - Applicant Reference ID: CUST-2026-083',
    data: [
      {
        category: 'Personal Identification',
        fields: {
          'Full Name': 'Mohammed Irfan',
          'Phone Number': '+91 97000 88991',
          'Email': 'irfan.generalstore@example.com',
          'Date of Birth': '05-Nov-1985 (Age: 41)',
          'Gender': 'Male',
          'Residential Address': 'House 12-2-417, Mehdipatnam, Hyderabad - 500028',
          'Aadhaar Number': 'XXXX-XXXX-9120',
          'PAN Card': 'CZMPM4821N'
        }
      },
      {
        category: 'Banking Particulars',
        fields: {
          'Bank Name': 'Canara Bank',
          'Account Number': '0412101039281',
          'IFSC Code': 'CNRB0000412',
          'Branch': 'Mehdipatnam Branch',
          'Account Holder': 'MOHAMMED IRFAN',
          'Account Status': 'Active'
        }
      },
      {
        category: 'Employment & Loan Request',
        fields: {
          'Employment Type': 'Self-Employed - Kirana & Provisions',
          'Business Name': 'Al-Madina General Store',
          'Daily Cash Flow': 'Rs. 6,000 - 8,000',
          'Requested Loan Type': 'Micro Daily Collection Loan',
          'Requested Principal': 'Rs. 50,000',
          'Requested Tenure': '100 Days (Daily Collection)',
          'Assigned Branch': 'Old City Branch'
        }
      }
    ]
  },
  {
    fileName: '04_Sunita_Reddy_Customer_Details.pdf',
    title: 'CUSTOMER PROFILE & LOAN APPLICATION',
    subtitle: 'FinSmart Lending Services - Applicant Reference ID: CUST-2026-084',
    data: [
      {
        category: 'Personal Identification',
        fields: {
          'Full Name': 'Sunita Reddy',
          'Phone Number': '+91 99490 55667',
          'Email': 'sunita.reddy@example.com',
          'Date of Birth': '19-Jan-1994 (Age: 32)',
          'Gender': 'Female',
          'Residential Address': 'Flat 201, Srinivasa Heights, Kukatpally, Hyderabad - 500072',
          'Aadhaar Number': 'XXXX-XXXX-6712',
          'PAN Card': 'AGVPR7729L'
        }
      },
      {
        category: 'Banking Particulars',
        fields: {
          'Bank Name': 'ICICI Bank',
          'Account Number': '004801592834',
          'IFSC Code': 'ICIC0000048',
          'Branch': 'Kukatpally KPHB Branch',
          'Account Holder': 'SUNITA REDDY',
          'Account Status': 'Active / Verified'
        }
      },
      {
        category: 'Employment & Loan Request',
        fields: {
          'Employment Type': 'Salaried - Marketing Specialist',
          'Employer Name': 'Apollo Healthcare Solutions',
          'Monthly Net Income': 'Rs. 62,000',
          'Requested Loan Type': 'Two-Wheeler Loan',
          'Requested Principal': 'Rs. 95,000',
          'Requested Tenure': '12 Months (Monthly EMI)',
          'Assigned Branch': 'Kukatpally Branch'
        }
      }
    ]
  },
  {
    fileName: '05_Amit_Patel_Customer_Details.pdf',
    title: 'CUSTOMER PROFILE & LOAN APPLICATION',
    subtitle: 'FinSmart Lending Services - Applicant Reference ID: CUST-2026-085',
    data: [
      {
        category: 'Personal Identification',
        fields: {
          'Full Name': 'Amit Patel',
          'Phone Number': '+91 94280 33445',
          'Email': 'amit.patel@example.com',
          'Date of Birth': '30-Jun-1980 (Age: 46)',
          'Gender': 'Male',
          'Residential Address': '34 Green Park Society, Begumpet, Secunderabad - 500003',
          'Aadhaar Number': 'XXXX-XXXX-1983',
          'PAN Card': 'BHZPP6631Q'
        }
      },
      {
        category: 'Banking Particulars',
        fields: {
          'Bank Name': 'Bank of Baroda',
          'Account Number': '28490100019284',
          'IFSC Code': 'BARB0BEGUMP',
          'Branch': 'Begumpet Branch',
          'Account Holder': 'AMIT PATEL',
          'Account Status': 'Active / Verified'
        }
      },
      {
        category: 'Employment & Loan Request',
        fields: {
          'Employment Type': 'Business Owner - Hardware Supplies',
          'Business Name': 'Patel Electricals & Hardware',
          'Monthly Net Income': 'Rs. 1,45,000',
          'Requested Loan Type': 'Equipment & Working Capital Loan',
          'Requested Principal': 'Rs. 5,00,000',
          'Requested Tenure': '24 Months (Monthly EMI)',
          'Assigned Branch': 'Secunderabad Branch'
        }
      }
    ]
  }
];

// Target directory
const targetDir = path.resolve(__dirname, '../sample-customer-pdfs');
if (!fs.existsSync(targetDir)) {
  fs.mkdirSync(targetDir, { recursive: true });
}

// Generate each PDF
console.log(`Writing sample PDFs to: ${targetDir}`);
customers.forEach((c) => {
  const buffer = createPdfBuffer({
    title: c.title,
    subtitle: c.subtitle,
    customerData: c.data
  });
  const filePath = path.join(targetDir, c.fileName);
  fs.writeFileSync(filePath, buffer);
  console.log(`Created: ${c.fileName} (${buffer.length} bytes)`);
});

// Create CSV Import Manifest
const csvHeader = 'Name,Phone,Email,Aadhaar,PAN,Bank_Name,IFSC,Account_Number,Monthly_Income,Loan_Amount,Loan_Type\n';
const csvRows = [
  'Rajesh Verma,9876543210,rajesh.verma@example.com,XXXX-XXXX-8492,ABCDE1234F,State Bank of India,SBIN0000847,384920194857,85000,200000,Personal',
  'Priya Sharma,9823011223,priya.sharma91@example.com,XXXX-XXXX-3341,BKWPS9912K,HDFC Bank,HDFC0000542,50100482910394,120000,350000,Business',
  'Mohammed Irfan,9700088991,irfan.generalstore@example.com,XXXX-XXXX-9120,CZMPM4821N,Canara Bank,CNRB0000412,0412101039281,45000,50000,Daily Collection',
  'Sunita Reddy,9949055667,sunita.reddy@example.com,XXXX-XXXX-6712,AGVPR7729L,ICICI Bank,ICIC0000048,004801592834,62000,95000,Two-Wheeler',
  'Amit Patel,9428033445,amit.patel@example.com,XXXX-XXXX-1983,BHZPP6631Q,Bank of Baroda,BARB0BEGUMP,28490100019284,145000,500000,Working Capital'
].join('\n');

fs.writeFileSync(path.join(targetDir, 'customers_import_manifest.csv'), csvHeader + csvRows, 'utf8');
console.log('Created: customers_import_manifest.csv');

// Create JSON Manifest
fs.writeFileSync(path.join(targetDir, 'customers_data.json'), JSON.stringify(customers, null, 2), 'utf8');
console.log('Created: customers_data.json');

// Create README.md explaining the test files
const readme = `# Sample Customer Details & Import Test Data

This folder contains sample customer profiles and documents formatted for testing FinSmart / LenQredZo customer ingestion and document processing.

## 📄 PDF Customer Profile Documents:
1. **01_Rajesh_Verma_Customer_Details.pdf** - Salaried professional, Personal Loan applicant (SBI Bank).
2. **02_Priya_Sharma_Customer_Details.pdf** - Retail boutique owner, Business Loan applicant (HDFC Bank).
3. **03_Mohammed_Irfan_Customer_Details.pdf** - Kirana store merchant, Daily microloan applicant (Canara Bank).
4. **04_Sunita_Reddy_Customer_Details.pdf** - Marketing executive, Two-wheeler loan applicant (ICICI Bank).
5. **05_Amit_Patel_Customer_Details.pdf** - Hardware enterprise owner, Working capital loan applicant (Bank of Baroda).

## 📊 Accompanying Data Files:
- **customers_import_manifest.csv**: Standard comma-separated table for Excel / CSV bulk customer import.
- **customers_data.json**: Structured JSON manifest with all parsed fields and reference IDs.
`;

fs.writeFileSync(path.join(targetDir, 'README.md'), readme, 'utf8');
console.log('Created: README.md');
console.log('All customer files generated successfully!');
