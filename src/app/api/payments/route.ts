/**
 * Garfix ERP — Payments API (المدفوعات)
 */
import { db } from "@/lib/db";
import { jsonErr } from "@/lib/erp";

export async function GET() {
  try {
    const payments = await db.payment.findMany({
      include: {
        invoice: {
          select: { number: true, client: { select: { name: true, company: true } } },
        },
      },
      orderBy: { date: "desc" },
    });
    const methodLabels: Record<string, string> = {
      cash: "نقدي",
      bank: "تحويل بنكي",
      wallet: "محفظة إلكترونية",
      cheque: "شيك",
    };
    return Response.json(
      payments.map((p) => ({
        id: p.id,
        invoiceId: p.invoiceId,
        invoiceNumber: p.invoice.number,
        clientName: p.invoice.client.company || p.invoice.client.name,
        amount: p.amount,
        method: p.method,
        methodLabel: methodLabels[p.method] || p.method,
        date: p.date,
        reference: p.reference,
      }))
    );
  } catch (e) {
    return jsonErr((e as Error).message, 500);
  }
}
