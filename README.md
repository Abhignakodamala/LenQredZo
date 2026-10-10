# LenQredZo

**Lending. Credit. Zero Friction.**

LenQredZo is a multi-tenant SaaS platform for loan and collection management, designed for India's informal lending sector, including finance companies, chit funds, and microfinance operators.

The platform brings customer management, loan servicing, EMI tracking, collections, branch operations, analytics, and AI-assisted portfolio insights into one application.

> **Development status:** Under active development and not deployed to production. Features listed as working have been manually tested locally by the maintainer. Some integrations are not yet verified, and automated test coverage is minimal.

---

## Table of Contents

- [Feature Status](#feature-status)
- [Technology Stack](#technology-stack)
- [Architecture](#architecture)
- [Project Structure](#project-structure)
- [Prerequisites](#prerequisites)
- [Getting Started](#getting-started)
- [WhatsApp Integration](#whatsapp-integration)
- [Security](#security)
- [Known Limitations](#known-limitations)
- [Roadmap](#roadmap)
- [Development Guidelines](#development-guidelines)
- [Reporting Security Issues](#reporting-security-issues)
- [License](#license)

---

## Feature Status

| Status | Meaning |
| --- | --- |
| ✅ Working locally | Built and manually tested in local development |
| 🧪 Built, not fully verified | Code exists, but it needs external credentials or end-to-end testing |
| 🗺️ Planned | Not built yet |

There is currently only a minimal automated test suite (AI service text sanitizing). Loan and EMI calculations, API routes, encryption, and tenant isolation are not covered by automated tests. "Working locally" means manually tested, not production-ready.

### ✅ Working in Local Development

**Organization and access**
- Company-level tenant separation
- Role-based access for owners, administrators, branch managers, loan officers, accountants, collection agents, and recovery officers
- Branch-level data scoping
- Staff and branch management

**Customers**
- Extended KYC customer profiles
- Bulk Excel import with preview and validation

**Loans and EMIs**
- Configurable interest types, tenure, and processing fees
- EMI schedule generation and penalty calculation
- Payment recording and history
- Guarantor management

**Collections and analytics**
- Overdue EMI tracking and NPA monitoring
- Dashboard statistics and analytics charts

**AI insights**
- Portfolio analysis using Google Gemini. AI output should be reviewed before it is used for financial decisions.

**Authentication and security**
- Password login, forgot-password flow, and email verification
- Email OTP login (Brevo)
- Bcrypt password hashing and JWT sessions
- Rate limiting and audit logging
- AES-256 encryption of Aadhaar, PAN, alternate ID, and bank account numbers

**Data export and messaging interface**
- Excel export
- WhatsApp-style chat interface with 18 message types, running in test mode (no real messages sent)

### 🧪 Built, Not Fully Verified

| Feature | Current limitation |
| --- | --- |
| Live WhatsApp messaging | Needs Meta Business and WhatsApp Cloud API credentials; live sending has not been tested |
| SMS OTP login | Needs Twilio credentials |
| Email OTP to any recipient | The Brevo free plan only delivers to the registered sender; a custom sending domain is needed |
| Passkey (WebAuthn) login | Routes exist; the full flow has not been tested end to end |
| Google OAuth login | Route exists; the full flow has not been tested end to end |
| Railway deployment | Configured earlier, currently paused |

### 🗺️ Planned

- Custom email domain for OTP delivery
- TOTP two-factor authentication with QR-code enrollment
- Razorpay payment gateway
- Customer self-service portal
- Offline mobile app with sync
- Maker-checker approvals
- KYC document uploads
- Super Admin console
- Court and defaulter PDF reports
- Automated EMI reminder scheduling
- Comprehensive automated test suite

---

## Technology Stack

| Layer | Technology |
| --- | --- |
| Frontend | Next.js 16, TypeScript |
| Backend API | Node.js, Express, JWT |
| Database | PostgreSQL 16 |
| ORM and migrations | Prisma |
| AI service | Python 3.11, FastAPI, Google Gemini |
| Email | Brevo SMTP via Nodemailer |
| SMS | Twilio |
| Messaging | Meta WhatsApp Cloud API |
| Monorepo | Turborepo |

---

## Architecture

```text
Browser
   |
   v
Next.js frontend (port 3000)
   |
   v
Express REST API (port 5000) ---> PostgreSQL (via Prisma)
   |            |
   |            +---> Brevo SMTP / Twilio
   |
   v
FastAPI AI service (port 8000)
   |
   +---> Google Gemini
   +---> WhatsApp Cloud API
```

- **Frontend:** dashboards, forms, and user interactions
- **API:** authentication, authorization, and business logic
- **AI service:** portfolio analysis and WhatsApp message sending

---

## Project Structure

```text
LenQredZo/
├── apps/
│   ├── web/            # Next.js frontend
│   ├── api/            # Express REST API
│   └── ai-service/     # FastAPI AI and WhatsApp service
├── packages/           # Shared configuration packages
├── prisma/             # Prisma schema and migrations
├── turbo.json
└── package.json
```

---

## Prerequisites

- Node.js 20.9 or newer (required by Next.js 16)
- npm
- PostgreSQL 16
- Python 3.11
- Git

---

## Getting Started

### 1. Clone and install

```bash
git clone https://github.com/Abhignakodamala/LenQredZo.git
cd LenQredZo
npm install
```

### 2. Configure environment variables

Create a `.env` file in the repository root. These are placeholders, so use your own values and never commit this file.

```dotenv
DATABASE_URL="postgresql://postgres:YOUR_PASSWORD@localhost:5432/lenqredzo"
JWT_SECRET="REPLACE_WITH_A_SECURE_RANDOM_SECRET"
SIGNUP_ACCESS_CODE="REPLACE_WITH_YOUR_SIGNUP_CODE"

BREVO_SMTP_HOST="smtp-relay.brevo.com"
BREVO_SMTP_PORT="587"
BREVO_SMTP_USER="YOUR_BREVO_LOGIN"
BREVO_SMTP_PASS="YOUR_BREVO_SMTP_KEY"

TWILIO_ACCOUNT_SID=""
TWILIO_AUTH_TOKEN=""
TWILIO_PHONE_NUMBER=""

AI_SERVICE_URL="http://localhost:8000"
AI_SERVICE_KEY="REPLACE_WITH_AN_INTERNAL_SERVICE_KEY"

WHATSAPP_TEST_MODE="true"
```

For the AI service, copy `apps/ai-service/.env.example` to `apps/ai-service/.env` and add your Google Gemini API key.

### 3. Set up the database

Create a PostgreSQL database named `lenqredzo`, then run:

```bash
npx prisma migrate dev
```

Use a development database only. If you change the schema later, stop the API before running `npx prisma generate`, otherwise Windows may show an EPERM error.

### 4. Run the services

Use a separate terminal for each service.

API:

```bash
cd apps/api
npm run dev
```

Web:

```bash
cd apps/web
npm run dev
```

AI service:

```bash
cd apps/ai-service
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

On macOS or Linux, activate the virtual environment with `source venv/bin/activate` instead.

Open http://localhost:3000.

---

## WhatsApp Integration

Each client company brings its own Meta Business account and dedicated phone number.

**Test mode (default for development)**

```dotenv
WHATSAPP_TEST_MODE="true"
```

No real messages are sent in test mode.

**Live messaging** is not yet verified. To try it:

1. Create a Meta Business account and a WhatsApp Cloud API app.
2. Copy the Phone Number ID and Access Token.
3. Enter them in **Settings → WhatsApp** inside the app.
4. Set `WHATSAPP_TEST_MODE="false"`.
5. Test with authorized recipients only, and check Meta's template and policy requirements.

---

## Security

Mechanisms currently in place:

- Company-level tenant separation, role-based access, and branch-level data scoping
- Bcrypt password hashing and JWT sessions
- AES-256 encryption of specified sensitive customer fields
- Rate limiting and audit logging

These have not been independently audited as a complete system.

Practices to follow:

- Never commit `.env` files, keys, or tokens.
- Use strong, unique secrets for each environment, and rotate any secret that has been exposed.
- Enforce authorization on the server for every sensitive operation.
- Avoid logging passwords, OTPs, tokens, or KYC data.
- Use HTTPS and back up the database before any production use.

This software has not been assessed against Indian financial, lending, or data-protection regulations. Anyone deploying it should get appropriate legal and compliance review.

---

## Known Limitations

- Not deployed to production; the Railway deployment is paused.
- Automated test coverage is minimal (AI service text sanitizing only).
- Live WhatsApp, SMS OTP, passkey login, and Google OAuth are not verified end to end.
- Email OTP to arbitrary recipients needs a custom sending domain.
- Bulk Excel import uses an older `xlsx` package version with known file-parsing vulnerabilities; it should be replaced before handling untrusted uploads in production.
- Not independently security-audited.

---

## Roadmap

**Testing and reliability**
- [ ] Unit tests for financial calculations
- [ ] Integration tests for API routes and database operations
- [ ] Tests for tenant and branch isolation
- [ ] End-to-end tests for critical workflows
- [ ] Continuous integration checks

**Authentication and security**
- [ ] End-to-end passkey and Google OAuth testing
- [ ] TOTP two-factor authentication with QR-code enrollment
- [ ] Replace the `xlsx` package
- [ ] Review session management, secret handling, and authorization boundaries

**Communications and payments**
- [ ] Custom email-sending domain
- [ ] Verify SMS OTP and live WhatsApp messaging
- [ ] Razorpay integration
- [ ] Automated EMI reminders

**Product**
- [ ] Customer self-service portal
- [ ] Offline mobile app with sync
- [ ] Maker-checker approvals
- [ ] KYC document uploads
- [ ] Super Admin console
- [ ] Court and defaulter PDF reports

**Deployment**
- [ ] Resume Railway deployment
- [ ] Production secrets, database backups, and recovery procedures
- [ ] Health checks and monitoring
- [ ] Security and production-readiness review

---

## Development Guidelines

1. Review the existing code before changing it.
2. Make the smallest change that solves the problem.
3. Test affected features manually, and add automated tests where possible.
4. Review `git diff` for unintended changes and exposed secrets.
5. Update this README when setup or behavior changes.

Commit message examples:

```text
feat: add EMI reminder scheduling
fix: handle missing payment records
test: add loan calculation unit tests
docs: update local setup instructions
```

---

## Reporting Security Issues

Please do not post credentials, customer data, or exploit details in public issues. Use GitHub's private vulnerability reporting (the repository's Security tab) to report a suspected vulnerability.

---

## License

**Proprietary software. All rights reserved.**

No permission to use, copy, modify, distribute, or sublicense this software is granted unless explicitly authorized by the copyright holder.
