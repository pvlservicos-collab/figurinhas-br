// Utilitário compartilhado de e-mails de abandono de carrinho

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || "https://gerarfigurinhas.vercel.app";
const CHECKOUT_URL = process.env.NEXT_PUBLIC_CHECKOUT_URL || "https://pay.onprofit.com.br/5Sh0FbF4?off=3wCdRS";

function htmlLoading(nome: string): string {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body>
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;background:#FFD700;border-radius:16px;">
      <h1 style="color:#1E3A8A;text-align:center;font-size:28px;margin-bottom:8px;">&#x26BD; Sua figurinha ficou pelo caminho!</h1>
      <p style="font-size:18px;text-align:center;color:#333;margin-bottom:20px;">
        Oi! Você começou a criar a figurinha de <strong style="color:#1E3A8A;">${nome}</strong> mas saiu antes de ver o resultado.<br/><br/>
        É só clicar no botão abaixo e refazer — leva menos de 1 minuto!
      </p>
      <div style="text-align:center;margin:28px 0;">
        <a href="${BASE_URL}" style="display:inline-block;background:#009739;color:white;font-weight:bold;font-size:18px;padding:16px 40px;border-radius:12px;text-decoration:none;letter-spacing:1px;">
          CRIAR MINHA FIGURINHA
        </a>
      </div>
      <hr style="border:1px solid rgba(30,58,138,0.2);margin:24px 0;"/>
      <p style="font-size:14px;text-align:center;">
        <a href="${BASE_URL}" style="color:#1E3A8A;font-weight:bold;">${BASE_URL.replace("https://", "")}</a>
      </p>
    </div>
  </body></html>`;
}

function htmlPreview(nome: string, previewUrl: string, stickerId: string): string {
  const linkVer = `${BASE_URL}/preview?img=${encodeURIComponent(previewUrl)}&nome=${encodeURIComponent(nome)}&id=${stickerId}`;
  return `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body>
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;background:#FFD700;border-radius:16px;">
      <h1 style="color:#1E3A8A;text-align:center;font-size:28px;margin-bottom:8px;">&#x26BD; Última chance!</h1>
      <p style="font-size:18px;text-align:center;color:#333;">
        A figurinha de <strong style="color:#1E3A8A;">${nome}</strong> está prestes a ser excluída,
        mas você ainda pode garantir com desconto especial.
      </p>
      <div style="text-align:center;margin:20px 0;">
        <table cellpadding="0" cellspacing="0" border="0" align="center" style="margin:0 auto;">
          <tr>
            <td style="width:200px;height:300px;background-image:url('${previewUrl}');background-size:cover;background-position:center;border-radius:12px;border:3px solid #1E3A8A;overflow:hidden;">
              <img src="https://gerarfigurinhas.vercel.app/watermark.png" width="200" height="300" alt="" style="display:block;opacity:0.45;"/>
            </td>
          </tr>
        </table>
      </div>
      <div style="text-align:center;margin:20px 0;">
        <p style="font-size:16px;color:#999;text-decoration:line-through;margin:0;">R$12,99</p>
        <p style="font-size:36px;color:#009739;font-weight:900;margin:4px 0;">R$9,99</p>
      </div>
      <p style="font-size:16px;text-align:center;color:#333;margin-bottom:20px;">Aproveite e receba sua figurinha pronta para impressão!</p>
      <div style="text-align:center;">
        <a href="${linkVer}" style="display:inline-block;background:#009739;color:white;font-weight:bold;font-size:18px;padding:16px 40px;border-radius:12px;text-decoration:none;letter-spacing:1px;">
          QUERO MINHA FIGURINHA
        </a>
      </div>
      <hr style="border:1px solid rgba(30,58,138,0.2);margin:24px 0;"/>
      <div style="text-align:center;margin-bottom:12px;">
        <a href="${BASE_URL}" style="color:#1E3A8A;font-weight:bold;font-size:14px;">Criar nova figurinha</a>
      </div>
    </div>
  </body></html>`;
}

export async function enviarEmailAbandono(params: {
  email: string;
  nome: string;
  tipo: "loading" | "preview";
  previewUrl?: string;
  stickerId?: string;
}): Promise<boolean> {
  const gmailScriptUrl = process.env.GMAIL_SCRIPT_URL;
  if (!gmailScriptUrl) return false;

  const { email, nome, tipo, previewUrl, stickerId } = params;

  const html = tipo === "loading"
    ? htmlLoading(nome)
    : htmlPreview(nome, previewUrl!, stickerId!);

  const subject = tipo === "loading"
    ? `Sua figurinha da Copa ficou pelo caminho, ${nome.split(" ")[0]}!`
    : `A figurinha de ${nome} está prestes a ser excluída!`;

  try {
    await fetch(gmailScriptUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify({ email, nome, subject, html }),
      redirect: "follow",
    });
    return true;
  } catch {
    return false;
  }
}
