import { Router } from 'express';
import { asyncHandler } from '../utils/errorHandler';
import { prisma } from '../index';

export const paymentRoutes = Router();

// Get all payment mappings
paymentRoutes.get('/', asyncHandler(async (req, res) => {
  const { page = 1, limit = 20, status, unallocated } = req.query;
  
  const where: Record<string, unknown> = {};
  if (status) where.status = status;

  const payments = await prisma.paymentMapping.findMany({
    where,
    include: {
      invoices: {
        include: {
          invoice: true
        }
      },
      syncLogs: {
        orderBy: { createdAt: 'desc' },
        take: 5
      }
    },
    orderBy: { createdAt: 'desc' },
    skip: (Number(page) - 1) * Number(limit),
    take: Number(limit)
  });

  // Filter unallocated payments if requested
  let filteredPayments = payments;
  if (unallocated === 'true') {
    filteredPayments = payments.filter(payment => payment.invoices.length === 0);
  }

  const total = await prisma.paymentMapping.count({ where });

  res.json({
    payments: filteredPayments,
    pagination: {
      page: Number(page),
      limit: Number(limit),
      total,
      pages: Math.ceil(total / Number(limit))
    }
  });
}));

// Get payment by ID
paymentRoutes.get('/:id', asyncHandler(async (req, res) => {
  const payment = await prisma.paymentMapping.findUnique({
    where: { id: req.params.id },
    include: {
      invoices: {
        include: {
          invoice: true
        }
      },
      syncLogs: {
        orderBy: { createdAt: 'desc' }
      }
    }
  });

  if (!payment) {
    return res.status(404).json({ error: 'Payment not found' });
  }

  res.json(payment);
}));

// Manual payment allocation
paymentRoutes.post('/:paymentId/allocate', asyncHandler(async (req, res) => {
  const { invoiceId, amount } = req.body;
  const { paymentId } = req.params;

  if (!invoiceId || !amount) {
    return res.status(400).json({ error: 'Invoice ID and amount are required' });
  }

  // Verify payment exists
  const payment = await prisma.paymentMapping.findUnique({
    where: { id: paymentId },
    include: { invoices: true }
  });

  if (!payment) {
    return res.status(404).json({ error: 'Payment not found' });
  }

  // Verify invoice exists
  const invoice = await prisma.invoiceMapping.findUnique({
    where: { id: invoiceId }
  });

  if (!invoice) {
    return res.status(404).json({ error: 'Invoice not found' });
  }

  // Check if allocation already exists
  const existingAllocation = await prisma.invoicePayment.findUnique({
    where: {
      invoiceMappingId_paymentMappingId: {
        invoiceMappingId: invoiceId,
        paymentMappingId: paymentId
      }
    }
  });

  if (existingAllocation) {
    return res.status(400).json({ error: 'Payment already allocated to this invoice' });
  }

  // Calculate current allocations
  const totalAllocated = payment.invoices.reduce((sum, alloc) => {
    return sum + Number(alloc.allocatedAmount);
  }, 0);

  const remainingAmount = Number(payment.amount) - totalAllocated;

  if (Number(amount) > remainingAmount) {
    return res.status(400).json({ 
      error: 'Allocation amount exceeds remaining payment amount',
      remainingAmount 
    });
  }

  // Create allocation
  const allocation = await prisma.invoicePayment.create({
    data: {
      invoiceMappingId: invoiceId,
      paymentMappingId: paymentId,
      allocatedAmount: amount,
      status: 'ALLOCATED'
    },
    include: {
      invoice: true,
      payment: true
    }
  });

  res.json({
    message: 'Payment allocated successfully',
    allocation
  });
}));

// Remove payment allocation
paymentRoutes.delete('/:paymentId/allocate/:invoiceId', asyncHandler(async (req, res) => {
  const { paymentId, invoiceId } = req.params;

  const allocation = await prisma.invoicePayment.findUnique({
    where: {
      invoiceMappingId_paymentMappingId: {
        invoiceMappingId: invoiceId,
        paymentMappingId: paymentId
      }
    }
  });

  if (!allocation) {
    return res.status(404).json({ error: 'Allocation not found' });
  }

  await prisma.invoicePayment.delete({
    where: { id: allocation.id }
  });

  res.json({ message: 'Allocation removed successfully' });
}));