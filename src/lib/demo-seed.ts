import {
  CustomerType,
  ItemCategory,
  MovementType,
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
        companyName: "Nittin Traditional Foods Pvt. Ltd.",
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
        name: "Salesman A (Raja)",
        role: Role.SALESMAN,
        phone: "+91-9000000001",
      },
    });

    const salesmanB = await tx.user.create({
      data: {
        email: "salesman.b@nittin-demo.local",
        password: passwordHash,
        name: "Salesman B (Karthik)",
        role: Role.SALESMAN,
        phone: "+91-9000000002",
      },
    });

    const admin = await tx.user.create({
      data: {
        email: "admin@nittin-demo.local",
        password: passwordHash,
        name: "Factory Admin (Samyuktha)",
        role: Role.FACTORY_ADMIN,
        phone: "+91-9000000003",
      },
    });

    await tx.user.create({
      data: {
        email: "supervisor@nittin-demo.local",
        password: passwordHash,
        name: "Floor Supervisor (Varshan)",
        role: Role.PRODUCTION_SUPERVISOR,
        phone: "+91-9000000004",
      },
    });

    await tx.user.create({
      data: {
        email: "auditor@nittin-demo.local",
        password: passwordHash,
        name: "Auditor (Sarathi CA)",
        role: Role.AUDITOR,
        phone: "+91-9000000005",
      },
    });

    await tx.user.create({
      data: {
        email: "owner@nittin-demo.local",
        password: passwordHash,
        name: "Owner (Rohith)",
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

    await tx.supplier.create({
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
    const openingLines = [
      {
        batchNumber: "BATCH-OPEN-FLOUR",
        item: flour,
        qty: new Decimal("100.000"),
        rate: new Decimal("42.00"),
      },
      {
        batchNumber: "BATCH-OPEN-OIL",
        item: oil,
        qty: new Decimal("30.000"),
        rate: new Decimal("140.00"),
      },
      {
        batchNumber: "BATCH-OPEN-SPICE",
        item: spice,
        qty: new Decimal("5.000"),
        rate: new Decimal("200.00"),
      },
      {
        batchNumber: "BATCH-OPEN-POUCH",
        item: pouch,
        qty: new Decimal("500.000"),
        rate: new Decimal("2.50"),
      },
      {
        batchNumber: "BATCH-OPEN-CARTON",
        item: carton,
        qty: new Decimal("30.000"),
        rate: new Decimal("15.00"),
      },
      {
        batchNumber: "BATCH-OPEN-MURUKKU",
        item: murukku,
        qty: new Decimal("50.000"),
        rate: new Decimal("30.00"),
      },
    ];

    for (const entry of openingLines) {
      const batch = await tx.stockBatch.create({
        data: {
          batchNumber: entry.batchNumber,
          itemId: entry.item.id,
          receivedDate: openingTimestamp,
          initialQty: entry.qty,
          remainingQty: entry.qty,
          unitRate: entry.rate,
        },
      });

      await tx.stockLedger.create({
        data: {
          timestamp: openingTimestamp,
          itemId: entry.item.id,
          batchId: batch.id,
          movementType: MovementType.OPENING_BALANCE,
          quantity: entry.qty,
          unit: entry.item.unit,
          referenceType: RefType.OPENING,
          referenceId: batch.id,
          balanceAfter: entry.qty,
          unitRate: entry.rate,
          totalValue: entry.qty.mul(entry.rate).toDecimalPlaces(2),
          createdById: admin.id,
          notes: "Benchmark opening stock balance",
        },
      });
    }
  },
  { maxWait: 10000, timeout: 30000 }
  );
}
