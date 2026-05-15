// Módulo centralizado de envio de email
// Ordem: Hostinger SMTP (principal) → Gmail SMTP (fallback) → Resend (último recurso)

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://gerarfigurinhas.vercel.app";

function buildEmailHtml(customerName: string, pdfUrl?: string): string {
  const dlLink = pdfUrl ? `${APP_URL}/api/download?url=${encodeURIComponent(pdfUrl)}&name=figurinha-copa-2026` : "";
  return `<div style="font-family:Arial;max-width:600px;margin:0 auto;padding:20px">
    <h1 style="color:#1E3A8A;text-align:center">GOOLL! ⚽</h1>
    <p style="font-size:18px;text-align:center">Ola <b>${customerName}</b>!</p>
    <p style="font-size:16px;text-align:center">Sua figurinha personalizada da Copa do Mundo 2026 esta pronta!</p>
    ${dlLink ? `<div style="text-align:center;margin:20px 0"><a href="${dlLink}" style="display:inline-block;background:#009739;color:white;font-weight:bold;font-size:18px;padding:16px 40px;border-radius:12px;text-decoration:none">BAIXAR FIGURINHA (PDF)</a></div>` : ""}
    <p style="font-size:14px;color:#666;text-align:center">Em anexo voce encontra a figurinha avulsa (PNG) e o PDF para impressao.</p>
    <hr style="border:1px solid #FFD700;margin:20px 0"/>
    <p style="font-size:16px;text-align:center">Conhece alguem que ia amar ter uma figurinha personalizada?</p>
    <div style="text-align:center;margin:12px 0"><a href="${APP_URL}/" style="display:inline-block;background:#1E3A8A;color:white;font-weight:bold;padding:14px 32px;border-radius:12px;text-decoration:none">CRIAR NOVA FIGURINHA</a></div>
  </div>`;
}

export async function sendEmail(
  to: string,
  customerName: string,
  stickerBytes: Uint8Array,
  pdfBuffer: Buffer,
  pdfUrl?: string
): Promise<boolean> {
  const fileNameBase = customerName.toLowerCase().replace(/\s+/g, "-");
  const subject = "Sua Figurinha da Copa 2026 esta pronta! ⚽";
  const html = buildEmailHtml(customerName, pdfUrl);

  // 1. Hostinger SMTP (principal — domínio próprio, sem spam)
  if (process.env.HOSTINGER_SMTP_HOST && process.env.HOSTINGER_SMTP_USER) {
    try {
      const nodemailer = (await import("nodemailer")).default;
      const transporter = nodemailer.createTransport({
        host: process.env.HOSTINGER_SMTP_HOST,
        port: Number(process.env.HOSTINGER_SMTP_PORT) || 465,
        secure: true,
        auth: { user: process.env.HOSTINGER_SMTP_USER, pass: process.env.HOSTINGER_SMTP_PASS },
      });
      await transporter.sendMail({
        from: `Figurinha Copa 2026 <${process.env.HOSTINGER_SMTP_USER}>`,
        to,
        bcc: process.env.HOSTINGER_SMTP_USER,
        subject,
        html,
        attachments: [
          { filename: `figurinha-${fileNameBase}.png`, content: Buffer.from(stickerBytes) },
          { filename: `figurinhas-impressao-${fileNameBase}.pdf`, content: pdfBuffer },
        ],
      });
      console.log(`Email enviado via Hostinger para ${to}`);
      return true;
    } catch (err) {
      console.error("Hostinger falhou:", err instanceof Error ? err.message : err);
    }
  }

  // 2. Gmail SMTP (fallback)
  if (process.env.SMTP_USER && process.env.SMTP_PASS) {
    try {
      const nodemailer = (await import("nodemailer")).default;
      const transporter = nodemailer.createTransport({
        service: "gmail",
        auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
      });
      await transporter.sendMail({
        from: `Figurinha Copa 2026 <${process.env.SMTP_USER}>`,
        to,
        bcc: process.env.HOSTINGER_SMTP_USER || process.env.SMTP_USER,
        subject,
        html,
        attachments: [
          { filename: `figurinha-${fileNameBase}.png`, content: Buffer.from(stickerBytes) },
          { filename: `figurinhas-impressao-${fileNameBase}.pdf`, content: pdfBuffer },
        ],
      });
      console.log(`Email enviado via Gmail para ${to}`);
      return true;
    } catch (err) {
      console.error("Gmail falhou:", err instanceof Error ? err.message : err);
    }
  }

  // 3. Resend (último recurso)
  if (process.env.RESEND_API_KEY) {
    try {
      const { Resend } = await import("resend");
      const resend = new Resend(process.env.RESEND_API_KEY);
      await resend.emails.send({
        from: "Figurinha Copa 2026 <onboarding@resend.dev>",
        to,
        subject,
        html,
        attachments: [
          { filename: `figurinha-${fileNameBase}.png`, content: Buffer.from(stickerBytes).toString("base64") },
          { filename: `figurinhas-impressao-${fileNameBase}.pdf`, content: pdfBuffer.toString("base64") },
        ],
      });
      console.log(`Email enviado via Resend para ${to}`);
      return true;
    } catch (err) {
      console.error("Resend falhou:", err instanceof Error ? err.message : err);
    }
  }

  console.error(`FALHA TOTAL: nenhum metodo de envio funcionou para ${to}`);
  return false;
}
