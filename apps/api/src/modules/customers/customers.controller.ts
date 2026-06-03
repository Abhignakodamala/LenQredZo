import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const getAllCustomers = async (req: Request, res: Response) => {
  try {
    const customers = await prisma.customer.findMany({
      include: { loans: true }
    });
    res.json(customers);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error });
  }
};

export const getCustomerById = async (req: Request, res: Response) => {
  try {
    const customer = await prisma.customer.findUnique({
      where: { id: Number(req.params.id) },
      include: { loans: true }
    });
    if (!customer) return res.status(404).json({ message: 'Customer not found' });
    res.json(customer);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error });
  }
};

export const createCustomer = async (req: Request, res: Response) => {
  try {
    const { name, email, phone, address, aadhar, pan, branchId } = req.body;
    const customer = await prisma.customer.create({
      data: { name, email, phone, address, aadhar, pan, branchId }
    });
    res.status(201).json({ message: 'Customer created', customer });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error });
  }
};

export const updateCustomer = async (req: Request, res: Response) => {
  try {
    const customer = await prisma.customer.update({
      where: { id: Number(req.params.id) },
      data: req.body
    });
    res.json({ message: 'Customer updated', customer });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error });
  }
};

export const deleteCustomer = async (req: Request, res: Response) => {
  try {
    await prisma.customer.delete({
      where: { id: Number(req.params.id) }
    });
    res.json({ message: 'Customer deleted' });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error });
  }
};