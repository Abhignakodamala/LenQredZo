import logging
import os
from datetime import datetime
from typing import Optional

import httpx
from fastapi import APIRouter, Header, HTTPException
from pydantic import BaseModel

logger = logging.getLogger(__name__)
router = APIRouter()
INTERNAL_KEY = os.getenv("AI_SERVICE_KEY", "")


class MessageRequest(BaseModel):
    whatsapp_token: str
    phone_number_id: str
    customer_phone: str
    customer_name: str
    message_type: str
    loan_id: Optional[str] = None
    emi_amount: Optional[str] = None
    due_date: Optional[str] = None
    paid_amount: Optional[str] = None
    payment_method: Optional[str] = None
    penalty_amount: Optional[str] = None
    company_name: Optional[str] = None
    branch_name: Optional[str] = None
    guarantor_name: Optional[str] = None
    borrower_name: Optional[str] = None
    overdue_amount: Optional[str] = None
    overdue_days: Optional[str] = None
    cheque_number: Optional[str] = None
    cheque_amount: Optional[str] = None
    loan_amount: Optional[str] = None
    interest_rate: Optional[str] = None
    auction_date: Optional[str] = None
    custom_message: Optional[str] = None
    plan_name: Optional[str] = None
    renewal_date: Optional[str] = None


def verify_key(value: str = Header(default="")) -> None:
    if not INTERNAL_KEY or value != INTERNAL_KEY:
        raise HTTPException(status_code=403, detail="Unauthorized")


def build_message(req: MessageRequest) -> str:
    name = req.customer_name
    company = req.company_name or "LenQredzo Finance"
    loan = req.loan_id or "your loan"
    amount = req.overdue_amount or req.emi_amount or "0"
    messages = {
        "pending_emi": f"Dear {name},\n\nYour EMI of ₹{req.emi_amount or '0'} for Loan {loan} is due on {req.due_date or 'the due date'}. Please pay on time to avoid late fees.\n\n{company}",
        "receipt": f"Dear {name},\n\n✅ Payment received!\nAmount: ₹{req.paid_amount or '0'}\nLoan ID: {loan}\nPayment Mode: {req.payment_method or 'Cash'}\nDate: {datetime.now():%d %b %Y}\n\nThank you,\n{company}",
        "late_fee": f"Dear {name},\n\n⚠️ A late fee of ₹{req.penalty_amount or '0'} was applied to Loan {loan}. Total outstanding: ₹{amount}.\n\n{company}",
        "guarantor_alert": f"Dear {req.guarantor_name or name},\n\n{req.borrower_name or name}'s Loan {loan} has ₹{amount} overdue ({req.overdue_days or '0'} days). Please help us resolve this.\n\n{company}",
        "credit_confirmation": f"Dear {name},\n\n🎉 Your loan has been approved and disbursed!\nLoan ID: {loan}\nLoan Amount: ₹{req.loan_amount or '0'}\nInterest Rate: {req.interest_rate or '0'}%\nEMI: ₹{req.emi_amount or '0'}\n\n{company}",
        "welcome": f"Dear {name},\n\nWelcome to {company}! 🙏 Your account has been successfully created.\n\nThank you for choosing us.",
        "greetings": f"Dear {name},\n\nWarm greetings from {company}! 🎊 Wishing you happiness, health, and prosperity.",
        "birthday": f"Dear {name},\n\n🎂 Happy Birthday! Wishing you a wonderful year ahead.\n\n{company}",
        "new_branch": f"Dear {name},\n\n🏢 {company} has opened a new branch at {req.branch_name or 'a new location'}. Visit us for financial services.",
        "alert": f"Dear {name},\n\n⚠️ Important message from {company}:\n\n{req.custom_message or 'Please contact your branch for more information.'}",
        "before_auction": f"Dear {name},\n\n🔔 URGENT: Loan {loan} has ₹{amount} due and is scheduled for auction on {req.auction_date or 'the announced date'}. Please clear your dues immediately.\n\n{company}",
        "after_auction": f"Dear {name},\n\nThe auction for Loan {loan} was completed on {datetime.now():%d %b %Y}. Please contact your branch for settlement details.\n\n{company}",
        "cheque_deposit": f"Dear {name},\n\n✅ Cheque received!\nCheque No: {req.cheque_number or 'N/A'}\nAmount: ₹{req.cheque_amount or '0'}\nLoan ID: {loan}\n\nPayment will be confirmed upon clearance.\n{company}",
        "cheque_return": f"Dear {name},\n\n❌ Cheque {req.cheque_number or 'N/A'} for ₹{req.cheque_amount or '0'} against Loan {loan} was returned unpaid. Please arrange alternative payment.\n\n{company}",
        "receipt_cancel": f"Dear {name},\n\nℹ️ Payment of ₹{req.paid_amount or '0'} on Loan {loan} has been cancelled or reversed. Please contact your branch.\n\n{company}",
        "member_enrolment": f"Dear {name},\n\nWelcome to the {company} team! 👋 Your account has been created successfully.\n\n{company}",
        "membership_renewal": f"Dear {name},\n\n📅 Your {req.plan_name or 'LenQredzo'} plan is due for renewal on {req.renewal_date or 'the renewal date'}.\n\nLenQredzo Team",
        "penalty": f"Dear {name},\n\n⚠️ A penalty of ₹{req.penalty_amount or '0'} was added to Loan {loan}. Total due: ₹{amount}.\n\n{company}",
    }
    try:
        return messages[req.message_type]
    except KeyError as exc:
        raise HTTPException(status_code=400, detail=f"Unknown message_type: {req.message_type}") from exc


@router.post("/whatsapp/send")
async def send_whatsapp(req: MessageRequest, x_internal_key: str = Header(default="")):
    verify_key(x_internal_key)
    url = f"https://graph.facebook.com/v20.0/{req.phone_number_id}/messages"
    payload = {
        "messaging_product": "whatsapp",
        "to": req.customer_phone,
        "type": "text",
        "text": {"body": build_message(req)},
    }
    async with httpx.AsyncClient(timeout=15.0) as client:
        response = await client.post(url, json=payload, headers={"Authorization": f"Bearer {req.whatsapp_token}"})
    try:
        data = response.json()
    except ValueError:
        data = {"detail": response.text}
    if response.status_code != 200:
        logger.error("WhatsApp API error: %s", data)
        raise HTTPException(status_code=502, detail="WhatsApp API request failed")
    return {"success": True, "message_type": req.message_type, "to": req.customer_phone, "whatsapp_response": data}


@router.get("/whatsapp/message-types")
async def list_message_types(x_internal_key: str = Header(default="")):
    verify_key(x_internal_key)
    return {"message_types": [
        {"type": key, "label": key.replace("_", " ").title()}
        for key in ["pending_emi", "receipt", "late_fee", "guarantor_alert", "credit_confirmation", "welcome", "greetings", "birthday", "new_branch", "alert", "before_auction", "after_auction", "cheque_deposit", "cheque_return", "receipt_cancel", "member_enrolment", "membership_renewal", "penalty"]
    ]}
