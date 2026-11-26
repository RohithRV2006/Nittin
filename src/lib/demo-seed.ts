import {
  CustomerType,
  GrnStatus,
  ItemCategory,
  MovementType,
  PaymentMode,
  PaymentStatus,
  PrismaClient,
  RefType,
  Role,
  UnitType,
} from "@prisma/client";
import bcrypt from "bcryptjs";
import Decimal from "decimal.js";

/**
 * Isolated Section 5 Benchmark Demo Dataset Seeder.
 * Used ONLY in demo/evaluation environments (`ENABLE_DEMO_MODE=true` or `npm run db:seed:demo`).
 * Never imported by production runtime business logic.
 */
export async function runDemoBenchmarkSeed(prisma: PrismaClient) {
  const demoPasswordPlain = process.env.DEMO_USER_PASSWORD || "DemoPass@123";
  const passwordHash = await bcrypt.hash(demoPasswordPlain, 10);

  await prisma.$transaction(async (tx) => {
    await tx.auditLog.deleteMany();
    await tx.passwordResetRequest.deleteMany();
    await tx.stockLedger.deleteMany();
    await tx.stockBatch.deleteMany();
    await tx.payment.deleteMany();
    await tx.supplierPayment.deleteMany();
    await tx.creditNoteItem.deleteMany();
    await tx.creditNote.deleteMany();
    await tx.dispatchChallanItem.deleteMany();
    await tx.dispatchChallan.deleteMany();
    await tx.invoiceItem.deleteMany();
    await tx.invoice.deleteMany();
    await tx.orderItem.deleteMany();
    await tx.order.deleteMany();
    await tx.productionConsumption.deleteMany();
    await tx.productionRun.deleteMany();
    await tx.bOMItem.deleteMany();
    await tx.bOM.deleteMany();
    await tx.goodsReceiptItem.deleteMany();
    await tx.goodsReceipt.deleteMany();
    await tx.purchaseItem.deleteMany();
    await tx.purchase.deleteMany();
    await tx.customerPrice.deleteMany();
    await tx.customer.deleteMany();
    await tx.supplier.deleteMany();
    await tx.item.deleteMany();
    await tx.documentSequence.deleteMany();
    await tx.companySettings.deleteMany();
    await tx.user.deleteMany();

    await tx.companySettings.create({
      data: {
        id: "default",
        companyName: "Nittin Foods Pvt. Ltd.",
        gstin: "33AABCN1234F1Z5",
        state: "Tamil Nadu",
        stateCode: "33",
        address: "Plot 14, SIDCO Industrial Estate, Tiruchirappalli, Tamil Nadu 620015",
        phone: "+91-9876543210",
        bankDetails: "Indian Bank, Trichy Main | A/C: 6543210987 | IFSC: IDIB000T012",
        defaultTolerancePercent: new Decimal("3.00"),
        isConfigured: true,
      },
    });

    const salesmanA = await tx.user.create({
      data: {
        email: "salesman.a@nittin-demo.local",
        password: passwordHash,
        name: "Raja (North Zone)",
        role: Role.SALESMAN,
        phone: "+91-9000000001",
      },
    });

    const salesmanB = await tx.user.create({
      data: {
        email: "salesman.b@nittin-demo.local",
        password: passwordHash,
        name: "Karthik (Interstate)",
        role: Role.SALESMAN,
        phone: "+91-9000000002",
      },
    });

    const admin = await tx.user.create({
      data: {
        email: "admin@nittin-demo.local",
        password: passwordHash,
        name: "Samyuktha",
        role: Role.FACTORY_ADMIN,
        phone: "+91-9000000003",
      },
    });

    const supervisor = await tx.user.create({
      data: {
        email: "supervisor@nittin-demo.local",
        password: passwordHash,
        name: "Varshan",
        role: Role.PRODUCTION_SUPERVISOR,
        phone: "+91-9000000004",
      },
    });

    await tx.user.create({
      data: {
        email: "auditor@nittin-demo.local",
        password: passwordHash,
        name: "Sarathi CA",
        role: Role.AUDITOR,
        phone: "+91-9000000005",
      },
    });

    await tx.user.create({
      data: {
        email: "owner@nittin-demo.local",
        password: passwordHash,
        name: "Rohith",
        role: Role.OWNER,
        phone: "+91-9000000006",
      },
    });

    await tx.customer.create({
      data: {
        name: "Retailer A",
        type: CustomerType.RETAILER,
        gstin: "33AAACR1111A1Z1",
        state: "Tamil Nadu",
        stateCode: "33",
        phone: "919876500001",
        address: "12 Bazaar Road, Thanjavur, Tamil Nadu 613001",
        creditLimit: new Decimal("50000.00"),
        creditDays: 30,
        assignedSalesmanId: salesmanA.id,
      },
    });

    await tx.customer.create({
      data: {
        name: "Distributor B",
        type: CustomerType.DISTRIBUTOR,
        gstin: "29AAACD2222B1Z9",
        state: "Karnataka",
        stateCode: "29",
        phone: "919876500002",
        address: "45 APMC Yard, Yeshwanthpur, Bengaluru, Karnataka 560022",
        creditLimit: new Decimal("200000.00"),
        creditDays: 30,
        assignedSalesmanId: salesmanB.id,
      },
    });

    const supplier = await tx.supplier.create({
      data: {
        name: "Cauvery Flour & Agro Mills",
        gstin: "33AAACC3333C1Z2",
        state: "Tamil Nadu",
        stateCode: "33",
        phone: "+91-9842100011",
        address: "88 Mill Road, Erode, Tamil Nadu 638001",
      },
    });

    const flour = await tx.item.create({
      data: {
        code: "RAW-FLOUR",
        name: "Rice & Besan Flour",
        category: ItemCategory.RAW_MATERIAL,
        unit: UnitType.KG,
        hsnCode: "1102",
        taxRate: new Decimal("5.00"),
        reorderLevel: new Decimal("50.000"),
      },
    });

    const oil = await tx.item.create({
      data: {
        code: "RAW-OIL",
        name: "Cooking Oil",
        category: ItemCategory.RAW_MATERIAL,
        unit: UnitType.LITRE,
        hsnCode: "1512",
        taxRate: new Decimal("5.00"),
        reorderLevel: new Decimal("15.000"),
      },
    });

    const spice = await tx.item.create({
      data: {
        code: "RAW-SPICE",
        name: "Salt and Spice Mix",
        category: ItemCategory.RAW_MATERIAL,
        unit: UnitType.KG,
        hsnCode: "0910",
        taxRate: new Decimal("5.00"),
        reorderLevel: new Decimal("2.000"),
      },
    });

    const pouch = await tx.item.create({
      data: {
        code: "PACK-POUCH-200",
        name: "200 g Pouch",
        category: ItemCategory.PACKAGING,
        unit: UnitType.PIECE,
        hsnCode: "3923",
        taxRate: new Decimal("18.00"),
        reorderLevel: new Decimal("200.000"),
      },
    });

    const carton = await tx.item.create({
      data: {
        code: "PACK-CARTON-20",
        name: "Outer Carton (20 pkts)",
        category: ItemCategory.PACKAGING,
        unit: UnitType.PIECE,
        unitsPerCarton: 20,
        hsnCode: "4819",
        taxRate: new Decimal("18.00"),
        reorderLevel: new Decimal("10.000"),
      },
    });

    const murukku = await tx.item.create({
      data: {
        code: "FG-MURUKKU-200",
        name: "Murukku 200 g",
        category: ItemCategory.FINISHED_GOOD,
        unit: UnitType.PACKET,
        packWeightGrams: new Decimal("200.000"),
        unitsPerCarton: 20,
        hsnCode: "1905",
        taxRate: new Decimal("5.00"),
        sellingPrice: new Decimal("50.00"),
        reorderLevel: new Decimal("40.000"),
      },
    });

    await tx.bOM.create({
      data: {
        finishedItemId: murukku.id,
        name: "Standard Murukku 200 g Recipe",
        batchSizeOutput: new Decimal("200.000"),
        tolerancePercent: new Decimal("3.00"),
        items: {
          create: [
            { itemId: flour.id, standardQty: new Decimal("40.000"), unit: UnitType.KG },
            { itemId: oil.id, standardQty: new Decimal("10.000"), unit: UnitType.LITRE },
            { itemId: spice.id, standardQty: new Decimal("1.200"), unit: UnitType.KG },
            { itemId: pouch.id, standardQty: new Decimal("200.000"), unit: UnitType.PIECE },
            { itemId: carton.id, standardQty: new Decimal("10.000"), unit: UnitType.PIECE },
          ],
        },
      },
    });

    const openingTimestamp = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const daysFromNow = (days: number) =>
      new Date(Date.now() + days * 24 * 60 * 60 * 1000);

    const openingPurchaseInputs = [
      {
        batchNumber: "BATCH-OPEN-FLOUR",
        item: flour,
        qty: new Decimal("100.000"),
        rate: new Decimal("42.00"),
        taxRate: new Decimal("5.00"),
        expiryDate: daysFromNow(90),
      },
      {
        batchNumber: "BATCH-OPEN-OIL",
        item: oil,
        qty: new Decimal("30.000"),
        rate: new Decimal("140.00"),
        taxRate: new Decimal("5.00"),
        expiryDate: daysFromNow(180),
      },
      {
        batchNumber: "BATCH-OPEN-SPICE",
        item: spice,
        qty: new Decimal("5.000"),
        rate: new Decimal("200.00"),
        taxRate: new Decimal("5.00"),
        expiryDate: daysFromNow(240),
      },
      {
        batchNumber: "BATCH-OPEN-POUCH",
        item: pouch,
        qty: new Decimal("500.000"),
        rate: new Decimal("2.50"),
        taxRate: new Decimal("18.00"),
        expiryDate: null,
      },
      {
        batchNumber: "BATCH-OPEN-CARTON",
        item: carton,
        qty: new Decimal("30.000"),
        rate: new Decimal("15.00"),
        taxRate: new Decimal("18.00"),
        expiryDate: null,
      },
    ];

    let openingTaxable = new Decimal("0");
    let openingTax = new Decimal("0");
    for (const line of openingPurchaseInputs) {
      const taxable = line.qty.mul(line.rate).toDecimalPlaces(2);
      const tax = taxable.mul(line.taxRate).div(100).toDecimalPlaces(2);
      openingTaxable = openingTaxable.plus(taxable);
      openingTax = openingTax.plus(tax);
    }
    const halfTax = openingTax.div(2).toDecimalPlaces(2);
    const otherHalfTax = openingTax.minus(halfTax);
    const openingTotal = openingTaxable.plus(openingTax).toDecimalPlaces(2);

    const openingPurchase = await tx.purchase.create({
      data: {
        purchaseNumber: "PUR/2026-27/0000",
        supplierId: supplier.id,
        billNumber: "CFM-OPEN-001",
        purchaseDate: openingTimestamp,
        placeOfSupply: "33",
        taxableAmount: openingTaxable,
        cgstAmount: halfTax,
        sgstAmount: otherHalfTax,
        igstAmount: new Decimal("0.00"),
        totalAmount: openingTotal,
        paidAmount: openingTotal,
        paymentStatus: PaymentStatus.PAID,
        createdById: admin.id,
      },
    });

    await tx.supplierPayment.create({
      data: {
        supplierId: supplier.id,
        purchaseId: openingPurchase.id,
        recordedById: admin.id,
        paymentDate: openingTimestamp,
        amount: openingTotal,
        paymentMode: PaymentMode.BANK_TRANSFER,
        referenceNumber: "NEFT-OPEN-001",
        notes: "Settlement for initial raw & packaging procurement",
      },
    });

    await tx.goodsReceipt.create({
      data: {
        grnNumber: "GRN/2026-27/0000",
        supplierId: supplier.id,
        challanNumber: "CH-CFM-001",
        receivedDate: openingTimestamp,
        status: GrnStatus.VERIFIED,
        notes: "Initial raw material and packaging gate inward",
        receivedById: supervisor.id,
        verifiedById: admin.id,
        verifiedAt: openingTimestamp,
        purchaseId: openingPurchase.id,
        items: {
          create: openingPurchaseInputs.map((line) => ({
            itemId: line.item.id,
            quantity: line.qty,
            unit: line.item.unit,
            batchNumber: line.batchNumber,
            expiryDate: line.expiryDate,
          })),
        },
      },
    });

    for (const line of openingPurchaseInputs) {
      const taxable = line.qty.mul(line.rate).toDecimalPlaces(2);
      const tax = taxable.mul(line.taxRate).div(100).toDecimalPlaces(2);
      const lineTotal = taxable.plus(tax);

      const purchaseItem = await tx.purchaseItem.create({
        data: {
          purchaseId: openingPurchase.id,
          itemId: line.item.id,
          quantity: line.qty,
          unit: line.item.unit,
          unitRate: line.rate,
          taxRate: line.taxRate,
          taxableAmount: taxable,
          taxAmount: tax,
          totalAmount: lineTotal,
          batchNumber: line.batchNumber,
          expiryDate: line.expiryDate,
        },
      });

      const batch = await tx.stockBatch.create({
        data: {
          batchNumber: line.batchNumber,
          itemId: line.item.id,
          purchaseItemId: purchaseItem.id,
          receivedDate: openingTimestamp,
          expiryDate: line.expiryDate,
          initialQty: line.qty,
          remainingQty: line.qty,
          unitRate: line.rate,
        },
      });

      await tx.stockLedger.create({
        data: {
          timestamp: openingTimestamp,
          itemId: line.item.id,
          batchId: batch.id,
          movementType: MovementType.PURCHASE_RECEIPT,
          quantity: line.qty,
          unit: line.item.unit,
          referenceType: RefType.PURCHASE,
          referenceId: openingPurchase.id,
          balanceAfter: line.qty,
          unitRate: line.rate,
          totalValue: taxable,
          createdById: admin.id,
          notes: `Inward purchase ${openingPurchase.purchaseNumber} (${openingPurchase.billNumber})`,
        },
      });
    }

    const fgOpeningQty = new Decimal("50.000");
    const fgOpeningRate = new Decimal("30.00");
    const fgBatch = await tx.stockBatch.create({
      data: {
        batchNumber: "BATCH-OPEN-MURUKKU",
        itemId: murukku.id,
        receivedDate: openingTimestamp,
        expiryDate: daysFromNow(45),
        initialQty: fgOpeningQty,
        remainingQty: fgOpeningQty,
        unitRate: fgOpeningRate,
      },
    });

    await tx.stockLedger.create({
      data: {
        timestamp: openingTimestamp,
        itemId: murukku.id,
        batchId: fgBatch.id,
        movementType: MovementType.OPENING_BALANCE,
        quantity: fgOpeningQty,
        unit: murukku.unit,
        referenceType: RefType.OPENING,
        referenceId: fgBatch.id,
        balanceAfter: fgOpeningQty,
        unitRate: fgOpeningRate,
        totalValue: fgOpeningQty.mul(fgOpeningRate).toDecimalPlaces(2),
        createdById: admin.id,
        notes: "Benchmark opening finished goods stock",
      },
    });
  },
  { maxWait: 10000, timeout: 30000 }
  );
}
