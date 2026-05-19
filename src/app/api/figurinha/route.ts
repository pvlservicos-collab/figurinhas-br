import { NextRequest, NextResponse } from "next/server";
import OpenAI, { toFile } from "openai";
import { readFileSync } from "fs";
import { join } from "path";
import { randomUUID } from "crypto";
import { put } from "@vercel/blob";
import sharp from "sharp";
import { getDb } from "@/lib/db";

export const maxDuration = 300;

function formatBirthDate(dataNascimento: string): string {
  const birth = new Date(dataNascimento);
  return `${String(birth.getDate()).padStart(2, "0")}-${String(birth.getMonth() + 1).padStart(2, "0")}-${birth.getFullYear()}`;
}

let cachedModeloBuffer: Buffer | null = null;

async function getModeloComprimido(): Promise<Buffer> {
  if (cachedModeloBuffer) return cachedModeloBuffer;
  const modeloPath = join(process.cwd(), "public", "modelo-figurinha.jpg");
  const modeloBuffer = readFileSync(modeloPath);
  cachedModeloBuffer = await sharp(modeloBuffer).resize(512).webp({ quality: 85 }).toBuffer();
  return cachedModeloBuffer;
}

// Rate limit simples em memória
const requestLog = new Map<string, number[]>();
function checkRateLimit(ip: string, maxRequests = 5, windowMs = 60000): boolean {
  const now = Date.now();
  const timestamps = requestLog.get(ip) || [];
  const recent = timestamps.filter(t => now - t < windowMs);
  if (recent.length >= maxRequests) return false;
  recent.push(now);
  requestLog.set(ip, recent);
  return true;
}

// Sanitizar input — só letras, números, espaços, acentos e hífens
function sanitizeInput(value: string, maxLen: number): string {
  return value.replace(/[^a-zA-ZÀ-ÿ0-9\s\-'.]/g, "").slice(0, maxLen).trim();
}

// Pool de API keys — rotaciona se uma falhar (402/429)
function getOpenAIKeys(): string[] {
  const keys: string[] = [];
  if (process.env.OPENAI_API_KEY) keys.push(process.env.OPENAI_API_KEY);
  if (process.env.OPENAI_API_KEY_2) keys.push(process.env.OPENAI_API_KEY_2);
  if (process.env.OPENAI_API_KEY_3) keys.push(process.env.OPENAI_API_KEY_3);
  return keys;
}

export async function POST(req: NextRequest) {
  const apiKeys = getOpenAIKeys();
  if (apiKeys.length === 0) {
    return NextResponse.json({ error: "Serviço indisponível" }, { status: 500 });
  }
  const apiKey = apiKeys[0]; // Começa pela primeira

  // Rate limit por IP
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0] || "unknown";
  if (!checkRateLimit(ip, 10, 60000)) {
    return NextResponse.json({ error: "Muitas requisições. Aguarde 1 minuto." }, { status: 429 });
  }

  let body: { nome: string; dataNascimento: string; email: string; clube: string; jogadorFavorito: string; peso?: string; altura?: string; fotoBase64: string; errorTimestamp?: string; };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Dados inválidos" }, { status: 400 });
  }

  const { nome, dataNascimento, email, clube, jogadorFavorito, peso, altura, fotoBase64, errorTimestamp } = body;
  if (!nome || !dataNascimento || !clube || !fotoBase64) {
    console.error("Dados incompletos:", { nome: !!nome, dataNascimento: !!dataNascimento, clube: !!clube, fotoBase64: !!fotoBase64 });
    return NextResponse.json({ error: "Dados incompletos" }, { status: 400 });
  }

  // Validações server-side
  const nomeSafe = sanitizeInput(nome, 50);
  const clubeSafe = sanitizeInput(clube, 50);
  const jogadorSafe = sanitizeInput(jogadorFavorito || "", 50);

  if (nomeSafe.length < 2 || clubeSafe.length < 2) {
    return NextResponse.json({ error: "Dados inválidos" }, { status: 400 });
  }

  // Validar data
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRegex.test(dataNascimento)) {
    return NextResponse.json({ error: "Data inválida" }, { status: 400 });
  }

  // Validar base64 — máx 5MB decodificado
  if (fotoBase64.length > 7_000_000) {
    return NextResponse.json({ error: "Imagem muito grande" }, { status: 400 });
  }

  let fotoBuffer: Buffer;
  try {
    fotoBuffer = Buffer.from(fotoBase64, "base64");
    if (fotoBuffer.length > 5_000_000) {
      return NextResponse.json({ error: "Imagem muito grande" }, { status: 400 });
    }
  } catch {
    return NextResponse.json({ error: "Imagem inválida" }, { status: 400 });
  }

  const sql = getDb();
  const emailSafe = email ? email.slice(0, 255).trim().toLowerCase() : null;

  // Se é um retry após erro, buscar figurinha criada DEPOIS do erro
  // (pode ter gerado com sucesso mas a conexão caiu antes de retornar)
  if (errorTimestamp && emailSafe) {
    let existing: Record<string, string>[] = [];
    try {
      const ts = new Date(errorTimestamp);
      if (!isNaN(ts.getTime())) {
        existing = await sql`
          SELECT sticker_id, sticker_url FROM pedidos
          WHERE email = ${emailSafe}
            AND sticker_url IS NOT NULL
            AND created_at >= ${ts.toISOString()}
          ORDER BY created_at DESC LIMIT 1
        `;
      }
    } catch (dbErr) {
      console.error("Erro na busca pós-erro:", dbErr);
    }
    if (existing.length > 0) {
      try {
        const blobRes = await fetch(existing[0].sticker_url);
        const blobBuffer = Buffer.from(await blobRes.arrayBuffer());
        console.log(`Retry: figurinha pós-erro encontrada: ${existing[0].sticker_id}`);
        return NextResponse.json({
          imageBase64: blobBuffer.toString("base64"),
          mimeType: "image/png",
          stickerId: existing[0].sticker_id,
        });
      } catch {
        console.log("Retry: figurinha pós-erro não acessível, gerando nova...");
      }
    }
    console.log("Retry: nenhuma figurinha pós-erro, gerando nova...");
  }

  // Salvar rascunho antes de gerar — captura quem sai durante o loading
  let rascunhoId: number | null = null;
  if (emailSafe) {
    try {
      const rows = await sql`
        INSERT INTO pedidos (nome, data_nascimento, clube, jogador_favorito, email, status)
        VALUES (${nomeSafe}, ${dataNascimento}, ${clubeSafe}, ${jogadorSafe}, ${emailSafe}, 'gerando')
        RETURNING id
      `;
      rascunhoId = rows[0]?.id ?? null;
    } catch { /* ignora — não bloqueia a geração */ }
  }

  // Comprimir foto do usuário antes de enviar pra API (reduz upload)
  let fotoBufferComprimido: Buffer;
  try {
    fotoBufferComprimido = await sharp(fotoBuffer).resize(512).jpeg({ quality: 80 }).toBuffer();
  } catch {
    fotoBufferComprimido = fotoBuffer; // fallback: usa original
  }

  const modeloBuffer = await getModeloComprimido();

  const nomeUpper = nomeSafe.toUpperCase();
  const clubeFormatted = clubeSafe.toUpperCase();
  const pesoSafe  = peso  ? sanitizeInput(peso,  10) : null;
  const alturaSafe = altura ? sanitizeInput(altura, 10) : null;
  const infoLine = [
    formatBirthDate(dataNascimento),
    alturaSafe ? `${alturaSafe} m` : null,
    pesoSafe   ? `${pesoSafe} kg` : null,
  ].filter(Boolean).join(" | ");

  // Prompt com dados sanitizados entre delimitadores
  const prompt = `You are given two images:
- Image 1: A photograph of a person (the SUBJECT). This person may be a child or an adult.
- Image 2: A collectible sports sticker card (the TEMPLATE).

TASK: Create a new version of the sticker card (Image 2) featuring the person from Image 1.

INSTRUCTIONS:

1. REMOVE the adult athlete from Image 2 entirely.

2. GENERATE a medium close-up portrait of the person from Image 1: from the chest up, facing forward, arms down. The person must wear the yellow and green Brazil 2026 national team jersey (yellow body #FFDF00, green collar and sleeves #009C3B, CBF badge on the left chest). IMPORTANT: the jersey and body must match the REAL proportions of the person from Image 1. If the subject is a child, draw a child-sized body with a child-sized jersey. If the subject is an adult, draw an adult-sized body. Do NOT put a child's head on an adult body.

3. The person's FACE must be identical to Image 1: same facial features, expression, hair, skin tone, eyes, smile. Do not alter the face in any way.

4. Place this portrait into the card, centered in the same area where the original athlete was.

5. Keep ALL other elements of Image 2 exactly as they are: turquoise background, green "26" graphic, all icons, emblems, flag, vertical text, logos, borders, card edges, bottom text area.

6. Update the text fields with the following data:
[NAME]: ${nomeUpper}
[INFO]: ${infoLine}
[CLUB]: ${clubeFormatted}
${pesoSafe || alturaSafe ? `Player stats for reference: ${[alturaSafe ? `height ${alturaSafe} cm` : null, pesoSafe ? `weight ${pesoSafe} kg` : null].filter(Boolean).join(", ")}.` : ""}

The result must look like a real printed collectible sticker card with a properly proportioned portrait of the person from Image 1.`;

  try {
    console.log("Gerando figurinha...");

    // Pool de keys + retry com backoff
    let imageData = null;
    const BACKOFF_MS = [0, 10000, 20000];

    for (let keyIdx = 0; keyIdx < apiKeys.length; keyIdx++) {
      const currentKey = apiKeys[keyIdx];
      const openai = new OpenAI({ apiKey: currentKey });

      for (let attempt = 0; attempt < 3; attempt++) {
        if (attempt > 0) {
          console.log(`Retry ${attempt}/2 (key ${keyIdx + 1}) - aguardando ${BACKOFF_MS[attempt] / 1000}s...`);
          await new Promise(r => setTimeout(r, BACKOFF_MS[attempt]));
        }

        try {
          const fotoFile = await toFile(fotoBufferComprimido, "foto.jpg", { type: "image/jpeg" });
          const modeloFile = await toFile(modeloBuffer, "modelo.webp", { type: "image/webp" });

          const response = await openai.images.edit({
            model: "gpt-image-2",
            image: [fotoFile, modeloFile],
            prompt,
            size: "1024x1536",
          });

          imageData = response.data?.[0];
          if (imageData?.b64_json) break;
        } catch (apiErr: unknown) {
          const errMsg = apiErr instanceof Error ? apiErr.message : String(apiErr);
          // 429 = rate limit, 402 = sem créditos → tenta próxima key
          if (errMsg.includes("429") || errMsg.includes("rate") || errMsg.includes("402") || errMsg.includes("insufficient") || errMsg.includes("billing") || errMsg.includes("Billing") || errMsg.includes("quota") || errMsg.includes("credit")) {
            console.log(`OpenAI key ${keyIdx + 1} erro (${errMsg.includes("402") ? "sem creditos" : "rate limit"}) tentativa ${attempt + 1}`);
            if (attempt === 2) break; // Sai do retry, tenta próxima key
            continue;
          }
          throw apiErr;
        }
      }

      if (imageData?.b64_json) {
        console.log(`Figurinha gerada com key ${keyIdx + 1}`);
        break;
      }
      console.log(`Key ${keyIdx + 1} esgotada, tentando próxima...`);
    }
    if (!imageData?.b64_json) {
      return NextResponse.json({ error: "Falha na geração" }, { status: 422 });
    }

    // Salvar figurinha no Vercel Blob + criar preview em paralelo
    const stickerId = randomUUID();
    const stickerBuffer = Buffer.from(imageData.b64_json, "base64");

    const createPreview = async (): Promise<Buffer | null> => {
      try {
        const resizedBuf = await sharp(stickerBuffer).resize(400).toBuffer();
        const meta = await sharp(resizedBuf).metadata();
        const w = meta.width || 400;
        const h = meta.height || 600;
        const watermarkSvg = Buffer.from(`<svg width="${w}" height="${h}"><defs><pattern id="wm" x="0" y="0" width="200" height="120" patternUnits="userSpaceOnUse" patternTransform="rotate(-30)"><text x="100" y="40" font-family="Arial" font-size="22" fill="rgba(255,255,255,0.45)" font-weight="900" text-anchor="middle">PREVIEW</text><text x="10" y="70" font-family="Arial, sans-serif" font-size="14" fill="rgba(255,255,255,0.3)">minha-figurinha-copa2026</text></pattern></defs><rect width="100%" height="100%" fill="url(#wm)"/></svg>`);
        return await sharp(resizedBuf).composite([{ input: watermarkSvg, blend: "over" }]).jpeg({ quality: 60 }).toBuffer();
      } catch { return null; }
    };

    const [blob, previewBuffer] = await Promise.all([
      put(`figurinhas/${stickerId}.png`, stickerBuffer, { access: "public", contentType: "image/png" }),
      createPreview(),
    ]);

    // Salvar preview em paralelo com o blob já salvo
    const previewBlob = previewBuffer
      ? await put(`previews/${stickerId}.jpg`, previewBuffer, { access: "public", contentType: "image/jpeg" }).catch(() => null)
      : null;

    const finalPreviewUrl = previewBlob?.url ?? blob.url;

    // Atualizar rascunho 'gerando' → 'pendente', ou inserir novo se não tem rascunho
    if (rascunhoId) {
      sql`UPDATE pedidos SET
            sticker_id = ${stickerId}, sticker_url = ${blob.url}, preview_url = ${finalPreviewUrl}, status = 'pendente'
          WHERE id = ${rascunhoId}`
        .catch(e => console.error("DB update rascunho erro:", e));
    } else {
      sql`INSERT INTO pedidos (nome, data_nascimento, clube, jogador_favorito, email, sticker_id, sticker_url, preview_url, status)
          VALUES (${nomeSafe}, ${dataNascimento}, ${clubeSafe}, ${jogadorSafe}, ${emailSafe}, ${stickerId}, ${blob.url}, ${finalPreviewUrl}, 'pendente')`
        .catch(e => console.error("DB insert erro:", e));
    }

    console.log(`Figurinha salva: ${stickerId} | preview: ${previewBlob?.url ?? "fallback"}`);
    return NextResponse.json({
      imageBase64: imageData.b64_json,
      mimeType: "image/png",
      stickerId,
    });
  } catch (error: unknown) {
    console.error("Erro na geração:", error instanceof Error ? error.message : error);
    return NextResponse.json({ error: "Erro na geração. Tente novamente." }, { status: 500 });
  }
}
