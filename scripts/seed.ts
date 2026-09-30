/**
 * Garfix ERP — Seed Script
 * يولّد بيانات تجريبية واقعية لسوق مصري (آخر 6 أشهر)
 */
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

const EGP = (n: number) => Math.round(n * 100) / 100;

function daysAgo(n: number) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}

async function main() {
  console.log("🧹 Clearing old data...");
  await db.agentRun.deleteMany();
  await db.activityLog.deleteMany();
  await db.supplierPayment.deleteMany();
  await db.purchaseItem.deleteMany();
  await db.purchase.deleteMany();
  await db.supplier.deleteMany();
  await db.payment.deleteMany();
  await db.invoiceItem.deleteMany();
  await db.invoice.deleteMany();
  await db.expense.deleteMany();
  await db.product.deleteMany();
  await db.client.deleteMany();
  await db.setting.deleteMany();

  console.log("⚙️ Seeding settings...");
  await db.setting.createMany({
    data: [
      { key: "company_name", value: "شركة جارفكس للحلول التجارية" },
      { key: "company_phone", value: "+20 100 123 4567" },
      { key: "company_email", value: "info@garfix.app" },
      { key: "company_address", value: "٢٤ شارع التحرير، وسط البلد، القاهرة" },
      { key: "currency", value: "EGP" },
      { key: "vat_rate", value: "14" },
      { key: "invoice_prefix", value: "INV-" },
      { key: "fiscal_year_start", value: "01-01" },
    ],
  });

  console.log("👥 Seeding clients...");
  const clientsData = [
    { name: "أحمد محمود السيد", company: "مكتب النور للمقاولات", phone: "01001234567", email: "ahmed@alnoor-eg.com", city: "القاهرة", status: "active" },
    { name: "منى عبد الرحمن", company: "شركة الأمل للتوريدات", phone: "01112345678", email: "mona@amal-supplies.com", city: "الجيزة", status: "active" },
    { name: "خالد إبراهيم فهمي", company: "مجموعة الدلتا التجارية", phone: "01223456789", email: "khaled@delta-group.com", city: "المنصورة", status: "active" },
    { name: "سارة حسن توفيق", company: "بوتيك روز للملابس", phone: "01098765432", email: "sara@rose-boutique.com", city: "الإسكندرية", status: "active" },
    { name: "محمود الشناوي", company: "مطاعم البيت الشامي", phone: "01187654321", email: "mahmoud@shami.com", city: "القاهرة", status: "active" },
    { name: "هالة مصطفى", company: "عيادة ابتسامة لطب الأسنان", phone: "01234567890", email: "hala@smile-clinic.com", city: "طنطا", status: "active" },
    { name: "عمرو رمضان", company: "توكيلات النيل للسيارات", phone: "01011122333", email: "amr@nile-auto.com", city: "الإسكندرية", status: "inactive" },
    { name: "ياسمين فؤاد", company: "أكاديمية المستقبل للدورات", phone: "01122233444", email: "yasmin@future-acad.com", city: "القاهرة", status: "lead" },
    { name: "طارق النجار", company: "مصنع الشرق للبلاستيك", phone: "01233344555", email: "tarek@sharq-plastic.com", city: "العاشر من رمضان", status: "active" },
    { name: "نهى عادل", company: "صيدليات الحياة", phone: "01055566777", email: "noha@hayat-pharma.com", city: "الفيوم", status: "active" },
  ];
  const clients = await Promise.all(
    clientsData.map((c) =>
      db.client.create({
        data: { ...c, address: `${c.city} — العنوان التفصيلي مسجل بالنظام` },
      })
    )
  );

  console.log("📦 Seeding products...");
  const productsData = [
    { name: "لاب توب Dell Latitude 5440", sku: "LAP-001", category: "إلكترونيات", price: 32500, cost: 28000, stock: 12, minStock: 5, unit: "قطعة" },
    { name: "شاشة سامسونج 27 بوصة", sku: "MON-002", category: "إلكترونيات", price: 8900, cost: 7200, stock: 3, minStock: 6, unit: "قطعة" },
    { name: "طابعة HP LaserJet Pro", sku: "PRN-003", category: "إلكترونيات", price: 12500, cost: 10300, stock: 8, minStock: 4, unit: "قطعة" },
    { name: "كرسي مكتبي طبي Ergonomic", sku: "FRN-004", category: "أثاث مكتبي", price: 4200, cost: 3100, stock: 25, minStock: 10, unit: "قطعة" },
    { name: "مكتب خشبي 160سم", sku: "FRN-005", category: "أثاث مكتبي", price: 7800, cost: 5900, stock: 9, minStock: 5, unit: "قطعة" },
    { name: "ورق تصوير A4 (كرتونة)", sku: "STA-006", category: "قرطاسية", price: 1350, cost: 1100, stock: 2, minStock: 15, unit: "كرتونة" },
    { name: "حبر طابعة HP 26A", sku: "STA-007", category: "قرطاسية", price: 2850, cost: 2300, stock: 18, minStock: 8, unit: "قطعة" },
    { name: "راوتر TP-Link AX1500", sku: "NET-008", category: "شبكات", price: 3400, cost: 2700, stock: 4, minStock: 6, unit: "قطعة" },
    { name: "كابل شبكة CAT6 (متر)", sku: "NET-009", category: "شبكات", price: 45, cost: 30, stock: 500, minStock: 200, unit: "متر" },
    { name: "كاميرا مراقبة Hikvision 2MP", sku: "SEC-010", category: "أنظمة أمنية", price: 1950, cost: 1500, stock: 14, minStock: 8, unit: "قطعة" },
    { name: "جهاز حضور وانصراف ZKTeco", sku: "SEC-011", category: "أنظمة أمنية", price: 6800, cost: 5400, stock: 6, minStock: 3, unit: "قطعة" },
    { name: "مكيف شارب 1.5 حصان", sku: "APP-012", category: "أجهزة منزلية", price: 21000, cost: 18000, stock: 5, minStock: 4, unit: "قطعة" },
  ];
  const products = await Promise.all(productsData.map((p) => db.product.create({ data: p })));

  console.log("🧾 Seeding invoices (last 6 months)...");
  const VAT = 0.14;
  const monthPlans = [
    { monthsAgo: 5, count: 5, statuses: ["paid", "paid", "paid", "paid", "paid"] },
    { monthsAgo: 4, count: 6, statuses: ["paid", "paid", "paid", "paid", "partial", "cancelled"] },
    { monthsAgo: 3, count: 7, statuses: ["paid", "paid", "paid", "paid", "paid", "partial", "paid"] },
    { monthsAgo: 2, count: 8, statuses: ["paid", "paid", "paid", "paid", "paid", "paid", "partial", "sent"] },
    { monthsAgo: 1, count: 9, statuses: ["paid", "paid", "paid", "paid", "partial", "sent", "paid", "draft", "sent"] },
    { monthsAgo: 0, count: 7, statuses: ["paid", "partial", "sent", "draft", "draft", "sent", "partial"] },
  ];

  let invSeq = 1000;
  let invIndex = 0;

  for (const plan of monthPlans) {
    for (let i = 0; i < plan.count; i++) {
      const client = clients[(invIndex * 3 + plan.monthsAgo) % clients.length];
      const itemCount = 1 + ((invIndex + plan.monthsAgo) % 3);
      const items: {
        productId: string | null;
        description: string;
        quantity: number;
        unitPrice: number;
        total: number;
      }[] = [];

      for (let j = 0; j < itemCount; j++) {
        const product = products[(invIndex * 2 + j * 3 + 1) % products.length];
        const qty = 1 + ((invIndex + j * 2) % 5);
        items.push({
          productId: product.id,
          description: product.name,
          quantity: qty,
          unitPrice: product.price,
          total: EGP(qty * product.price),
        });
      }

      const subtotal = EGP(items.reduce((s, it) => s + it.total, 0));
      const vatAmount = EGP(subtotal * VAT);
      const total = EGP(subtotal + vatAmount);

      const issueDate = daysAgo(plan.monthsAgo * 30 + (i * 3 + 2));
      const dueDate = new Date(issueDate);
      dueDate.setDate(dueDate.getDate() + 30);

      const status = plan.statuses[i];
      let paidAmount = 0;

      if (status === "paid") {
        paidAmount = total;
      } else if (status === "partial") {
        paidAmount = EGP(total * (0.3 + ((invIndex % 4) * 0.15)));
      }

      const invoice = await db.invoice.create({
        data: {
          number: `INV-${invSeq + invIndex}`,
          clientId: client.id,
          issueDate,
          dueDate,
          status,
          subtotal,
          vatRate: 14,
          vatAmount,
          total,
          paidAmount,
          items: { create: items },
        },
      });

      if (paidAmount > 0) {
        const payDate = new Date(issueDate);
        payDate.setDate(payDate.getDate() + 3 + (invIndex % 10));
        const method = ["cash", "bank", "wallet", "cheque"][invIndex % 4];
        if (status === "partial") {
          await db.payment.create({
            data: { invoiceId: invoice.id, amount: EGP(paidAmount * 0.6), method, date: payDate, reference: `PAY-${invSeq + invIndex}-1` },
          });
          const payDate2 = new Date(payDate);
          payDate2.setDate(payDate2.getDate() + 10);
          await db.payment.create({
            data: { invoiceId: invoice.id, amount: EGP(paidAmount * 0.4), method, date: payDate2, reference: `PAY-${invSeq + invIndex}-2` },
          });
        } else {
          await db.payment.create({
            data: { invoiceId: invoice.id, amount: paidAmount, method, date: payDate, reference: `PAY-${invSeq + invIndex}` },
          });
        }
      }

      invIndex++;
    }
  }

  console.log("💸 Seeding expenses (last 6 months)...");
  const expenseTemplates = [
    { category: "rent", description: "إيجار المقر الرئيسي", amount: 18000, vendor: "مالك العقار" },
    { category: "salaries", description: "رواتب الفريق الشهرية", amount: 96000, vendor: "فريق جارفكس" },
    { category: "purchases", description: "مصروفات نثرية للمشتريات", amount: 45000, vendor: "موردون متنوعون" },
    { category: "marketing", description: "حملات إعلانية رقمية", amount: 12000, vendor: "Meta & Google Ads" },
    { category: "utilities", description: "كهرباء وإنترنت ومياه", amount: 5500, vendor: "شركات المرافق" },
    { category: "other", description: "مصروفات تشغيلية متنوعة", amount: 4000, vendor: "متنوع" },
  ];
  for (let m = 5; m >= 0; m--) {
    for (const t of expenseTemplates) {
      const d = daysAgo(m * 30 + 5);
      const variance = 1 + ((m % 3) * 0.08) - 0.04;
      await db.expense.create({
        data: { category: t.category, description: t.description, amount: EGP(t.amount * variance), date: d, vendor: t.vendor },
      });
    }
  }

  // ===== المرحلة 6: الموردون والمشتريات =====
  console.log("🏭 Seeding suppliers...");
  const suppliersData = [
    { name: "حسام الدين مرسي", company: "النيل للتوزيع التقني", phone: "01100334455", email: "husam@nile-tech.com", city: "القاهرة", taxId: "220-114-887", status: "active", categories: ["إلكترونيات"] },
    { name: "عماد زكي", company: "مصنع الدلتا للأثاث المكتبي", phone: "01055667788", email: "emad@delta-furn.com", city: "المنصورة", taxId: "310-982-445", status: "active", categories: ["أثاث مكتبي"] },
    { name: "سامح عبد العال", company: "مكتبة الأمانة للقرطاسية", phone: "01277889900", email: "sameh@amana-books.com", city: "الجيزة", taxId: "412-455-663", status: "active", categories: ["قرطاسية"] },
    { name: "محمود قنديل", company: "شركة الفيبر للشبكات", phone: "01099887766", email: "mahmoud@fiber-net.com", city: "الإسكندرية", taxId: "503-776-221", status: "active", categories: ["شبكات", "أنظمة أمنية"] },
    { name: "أحمد الشناوي", company: "الشرق للأجهزة المنزلية", phone: "01144556677", email: "ahmed@sharq-app.com", city: "العاشر من رمضان", taxId: "604-331-990", status: "active", categories: ["أجهزة منزلية"] },
    { name: "فاطمة الزهراء", company: "مؤسسة الوفاق للتوريدات العامة", phone: "01233445566", email: "fatma@wefaq-supplies.com", city: "طنطا", taxId: "705-220-118", status: "inactive", categories: [] },
  ];
  const suppliers = await Promise.all(
    suppliersData.map((s) =>
      db.supplier.create({
        data: {
          name: s.name,
          company: s.company,
          phone: s.phone,
          email: s.email,
          city: s.city,
          taxId: s.taxId,
          status: s.status,
          address: `${s.city} — منطقة المستودعات التجارية`,
          notes: s.categories.length ? `متخصص: ${s.categories.join(" / ")}` : "مورّد عام",
        },
      })
    )
  );

  console.log("🚚 Seeding purchases (last 6 months)...");
  // مزود يرجّع المورد المناسب حسب تصنيف المنتج
  const supplierByCategory: Record<string, number> = {
    "إلكترونيات": 0,
    "أثاث مكتبي": 1,
    "قرطاسية": 2,
    "شبكات": 3,
    "أنظمة أمنية": 3,
    "أجهزة منزلية": 4,
  };
  const supplierFor = (product: { category: string | null }) =>
    suppliers[supplierByCategory[product.category || ""] ?? 5] ?? suppliers[5];

  const purchasePlans = [
    { monthsAgo: 5, count: 3, statuses: ["paid", "paid", "received"] },
    { monthsAgo: 4, count: 3, statuses: ["paid", "paid", "partial"] },
    { monthsAgo: 3, count: 4, statuses: ["paid", "paid", "paid", "partial"] },
    { monthsAgo: 2, count: 4, statuses: ["paid", "paid", "partial", "received"] },
    { monthsAgo: 1, count: 4, statuses: ["paid", "partial", "received", "ordered"] },
    { monthsAgo: 0, count: 3, statuses: ["received", "ordered", "draft"] },
  ];

  let purSeq = 2000;
  let purIndex = 0;
  for (const plan of purchasePlans) {
    for (let i = 0; i < plan.count; i++) {
      const status = plan.statuses[i];
      // نختار منتجات متنوعة لكل فاتورة شراء
      const itemCount = 1 + (purIndex % 3);
      const items: {
        productId: string | null;
        description: string;
        quantity: number;
        unitCost: number;
        total: number;
      }[] = [];
      const supplierProduct = products[(purIndex * 2 + 1) % products.length];
      const supplier = supplierFor(supplierProduct);

      for (let j = 0; j < itemCount; j++) {
        const product = products[(purIndex * 2 + j * 4 + 1) % products.length];
        // تكلفة المورد أقل قليلاً من تكلفة النظام (هامش المورد)
        const costFactor = 0.9 + ((purIndex + j) % 4) * 0.03;
        const qty = 2 + ((purIndex + j * 3) % 8);
        items.push({
          productId: product.id,
          description: product.name,
          quantity: qty,
          unitCost: EGP(product.cost * costFactor),
          total: EGP(qty * product.cost * costFactor),
        });
      }

      const applyVat = purIndex % 3 === 0; // ثلث الفواتير بضريبة المورد
      const subtotal = EGP(items.reduce((s, it) => s + it.total, 0));
      const vatAmount = applyVat ? EGP(subtotal * VAT) : 0;
      const total = EGP(subtotal + vatAmount);

      const issueDate = daysAgo(plan.monthsAgo * 30 + (i * 4 + 3));
      const dueDate = new Date(issueDate);
      dueDate.setDate(dueDate.getDate() + 15);

      let paidAmount = 0;
      if (status === "paid") paidAmount = total;
      else if (status === "partial") paidAmount = EGP(total * 0.5);

      const purchase = await db.purchase.create({
        data: {
          number: `PUR-${purSeq + purIndex}`,
          supplierId: supplier.id,
          issueDate,
          dueDate,
          status,
          subtotal,
          vatRate: applyVat ? 14 : 0,
          vatAmount,
          total,
          paidAmount,
          notes: purIndex % 4 === 0 ? "تسليم بمستودع الشركة — تم فحص الكميات" : null,
          items: { create: items },
        },
      });

      if (paidAmount > 0) {
        const payDate = new Date(issueDate);
        payDate.setDate(payDate.getDate() + 7 + (purIndex % 5));
        const method = ["bank", "cash", "cheque"][purIndex % 3];
        if (status === "partial") {
          await db.supplierPayment.create({
            data: { purchaseId: purchase.id, amount: EGP(paidAmount), method, date: payDate, reference: `SPAY-${purSeq + purIndex}-1` },
          });
        } else {
          await db.supplierPayment.create({
            data: { purchaseId: purchase.id, amount: paidAmount, method, date: payDate, reference: `SPAY-${purSeq + purIndex}` },
          });
        }
      }

      purIndex++;
    }
  }

  console.log("📝 Seeding activity log...");
  await db.activityLog.createMany({
    data: [
      { action: "seed", entity: "system", detail: "تم تهيئة النظام بالبيانات التجريبية" },
    ],
  });

  const count = {
    clients: await db.client.count(),
    products: await db.product.count(),
    invoices: await db.invoice.count(),
    payments: await db.payment.count(),
    expenses: await db.expense.count(),
    suppliers: await db.supplier.count(),
    purchases: await db.purchase.count(),
    supplierPayments: await db.supplierPayment.count(),
  };
  console.log("✅ Seed done:", count);
}

main()
  .catch((e) => {
    console.error("❌ Seed failed:", e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
