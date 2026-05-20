import { NextRequest, NextResponse } from "next/server";
import OpenAI, { toFile } from "openai";
import { readFileSync } from "fs";
import { join } from "path";
import { randomUUID } from "crypto";
import { put } from "@vercel/blob";
import sharp from "sharp";
import postgres from "postgres";
import { getDb } from "@/lib/db";

export const maxDuration = 300;

function formatBirthDate(dataNascimento: string): string {
  const birth = new Date(dataNascimento);
  return `${String(birth.getDate()).padStart(2, "0")}-${String(birth.getMonth() + 1).padStart(2, "0")}-${birth.getFullYear()}`;
}

let cachedModeloBuffer: Buffer | null = null;

async function getModeloComprimido(): Promise<Buffer> {
  if (cachedModeloBuffer) return cachedModeloBuffer;

  let rawBuffer: Buffer;
  try {
    const modeloPath = join(process.cwd(), "public", "modelo-figurinha.jpg");
    rawBuffer = readFileSync(modeloPath);
    console.log("modelo: carregado do filesystem");
  } catch (fsErr) {
    // Fallback para ambientes serverless onde o filesystem pode não ter o public/
    const host = process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : process.env.NEXT_PUBLIC_URL ?? "http://localhost:3000";
    console.log(`modelo: filesystem falhou (${fsErr instanceof Error ? fsErr.message : fsErr}), buscando via HTTP de ${host}`);
    const res = await fetch(`${host}/modelo-figurinha.jpg`);
    if (!res.ok) throw new Error(`HTTP ${res.status} ao buscar modelo-figurinha.jpg`);
    rawBuffer = Buffer.from(await res.arrayBuffer());
  }

  cachedModeloBuffer = await sharp(rawBuffer).resize(512).webp({ quality: 85 }).toBuffer();
  return cachedModeloBuffer;
}

// Migração: adiciona colunas de tracking se não existirem
let _migrated = false;
async function ensureColumns(sql: ReturnType<typeof postgres>) {
  if (_migrated) return;
  try {
    await sql`ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS api_key_used SMALLINT`;
    await sql`ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS generation_ms INT`;
  } catch { /* ignora */ }
  _migrated = true;
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

// Pool de API keys — cada clique do cliente usa a próxima key na fila
function getOpenAIKeys(): string[] {
  const keys: string[] = [];
  if (process.env.OPENAI_API_KEY)   keys.push(process.env.OPENAI_API_KEY);
  if (process.env.OPENAI_API_KEY_2) keys.push(process.env.OPENAI_API_KEY_2);
  if (process.env.OPENAI_API_KEY_3) keys.push(process.env.OPENAI_API_KEY_3);
  if (process.env.OPENAI_API_KEY_4) keys.push(process.env.OPENAI_API_KEY_4);
  return keys;
}

export async function POST(req: NextRequest) {
  const apiKeys = getOpenAIKeys();
  if (apiKeys.length === 0) {
    return NextResponse.json({ error: "Serviço indisponível" }, { status: 500 });
  }
  // Rate limit por IP
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0] || "unknown";
  if (!checkRateLimit(ip, 10, 60000)) {
    return NextResponse.json({ error: "Muitas requisições. Aguarde 1 minuto." }, { status: 429 });
  }

  let body: { nome: string; dataNascimento: string; telefone?: string; clube: string; jogadorFavorito: string; peso?: string; altura?: string; fotoBase64: string; errorTimestamp?: string; retryAttempt?: number; };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Dados inválidos" }, { status: 400 });
  }

  const { nome, dataNascimento, telefone, clube, jogadorFavorito, peso, altura, fotoBase64, errorTimestamp, retryAttempt } = body;
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
  await ensureColumns(sql);
  const telefoneSafe = telefone ? telefone.replace(/\D/g, "").slice(0, 20) : null;

  // Se é um retry após erro, buscar figurinha criada DEPOIS do erro
  if (errorTimestamp && telefoneSafe) {
    let existing: Record<string, string>[] = [];
    try {
      const ts = new Date(errorTimestamp);
      if (!isNaN(ts.getTime())) {
        existing = await sql`
          SELECT sticker_id, sticker_url FROM pedidos
          WHERE telefone = ${telefoneSafe}
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

  // Salvar rascunho antes de gerar
  let rascunhoId: number | null = null;
  if (telefoneSafe) {
    try {
      const rows = await sql`
        INSERT INTO pedidos (nome, data_nascimento, clube, jogador_favorito, telefone, status)
        VALUES (${nomeSafe}, ${dataNascimento}, ${clubeSafe}, ${jogadorSafe}, ${telefoneSafe}, 'gerando')
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

  const nomeUpper = nomeSafe.toUpperCase();
  const clubeFormatted = clubeSafe.toUpperCase();
  const pesoSafe  = peso  ? sanitizeInput(peso,  10) : null;
  const alturaSafe = altura ? sanitizeInput(altura, 10) : null;
  const infoLine = [
    formatBirthDate(dataNascimento),
    alturaSafe ? `${alturaSafe} m` : null,
    pesoSafe   ? `${pesoSafe} kg` : null,
  ].filter(Boolean).join(" | ");

  const prompt = `You are given two images:
- Image 1: A photograph of a person (the SUBJECT).
- Image 2: A collectible sports sticker card (the TEMPLATE).

TASK: Create a new version of the sticker card (Image 2) featuring the person from Image 1.

BEFORE STARTING — ANALYZE Image 1:
Carefully observe the subject's face, head size, shoulder width, and overall body frame. Determine whether this person is a child or an adult. This observation governs everything you draw.

INSTRUCTIONS:

1. REMOVE the adult athlete from Image 2 entirely.

2. GENERATE a chest-up portrait of the subject wearing the yellow and green Brazil 2026 national team jersey (yellow body #FFDF00, green collar and sleeves #009C3B, CBF badge on left chest), facing forward, arms down.

   BODY PROPORTIONS — CRITICAL:
   - Use the subject's FACE from Image 1 as your scale anchor. The shoulders, torso, and jersey must be sized to fit that face naturally.
   - If the subject is a child: draw narrow child-sized shoulders, small torso, jersey scaled to a child's frame. The head-to-shoulder ratio must match real child anatomy — wide head relative to narrow shoulders.
   - If the subject is an adult: draw standard adult proportions.
   - NEVER place a child's face on adult-width shoulders. If the face in Image 1 is small and round (child), the body must also be small. Anatomical correctness for the subject's actual age is mandatory.

3. FACE: reproduce the subject's face from Image 1 exactly — same features, expression, hair, skin tone, eyes. Do not alter it.

4. Place the portrait centered where the original athlete was in the card.

5. Keep ALL other card elements unchanged: turquoise background, green "26" graphic, icons, emblems, flag, vertical text, logos, borders, card edges, bottom text area.

6. Update the text fields:
[NAME]: ${nomeUpper}
[INFO]: ${infoLine}
[CLUB]: ${clubeFormatted}
${pesoSafe || alturaSafe ? `Player stats for reference: ${[alturaSafe ? `height ${alturaSafe} cm` : null, pesoSafe ? `weight ${pesoSafe} kg` : null].filter(Boolean).join(", ")}.` : ""}

The result must look like a real printed collectible sticker card. The portrait must be anatomically correct for the subject's real age and body type as shown in Image 1.`;

  try {
    // Carregar modelo dentro do try para capturar erros de filesystem
    const modeloBuffer = await getModeloComprimido();

    const randomBase = Math.floor(Math.random() * apiKeys.length);
    const startIdx = typeof retryAttempt === "number" && retryAttempt > 0
      ? (randomBase + retryAttempt) % apiKeys.length
      : randomBase;

    let imageData = null;
    let successKeyIdx = -1;
    const genStart = Date.now();
    let attempt = 0;
    const TIMEOUT_MS = 250_000;

    console.log(`Gerando figurinha — ${apiKeys.length} key(s), começando pela key ${startIdx + 1}...`);

    while (!imageData && (Date.now() - genStart) < TIMEOUT_MS) {
      const keyIdx = (startIdx + attempt) % apiKeys.length;
      const openai = new OpenAI({ apiKey: apiKeys[keyIdx] });
      try {
        // Recriar os files a cada tentativa — evita stream consumido em iterações anteriores
        const fotoFile = await toFile(fotoBufferComprimido, "foto.jpg", { type: "image/jpeg" });
        const modeloFile = await toFile(modeloBuffer, "modelo.webp", { type: "image/webp" });

        const response = await openai.images.edit({
          model: "gpt-image-2",
          image: [fotoFile, modeloFile],
          prompt,
          size: "1024x1536",
        });
        imageData = response.data?.[0];
        if (imageData?.b64_json) {
          successKeyIdx = keyIdx;
          console.log(`Gerado com key ${keyIdx + 1} na tentativa ${attempt + 1} (${Date.now() - genStart}ms)`);
        }
      } catch (apiErr: unknown) {
        const errMsg = apiErr instanceof Error ? apiErr.message : String(apiErr);
        console.log(`Key ${keyIdx + 1} tentativa ${attempt + 1} falhou: ${errMsg.slice(0, 100)}`);
      }
      attempt++;
    }

    const generationMs = Date.now() - genStart;

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
            sticker_id = ${stickerId}, sticker_url = ${blob.url}, preview_url = ${finalPreviewUrl},
            status = 'pendente', api_key_used = ${successKeyIdx + 1}, generation_ms = ${generationMs}
          WHERE id = ${rascunhoId}`
        .catch(e => console.error("DB update rascunho erro:", e));
    } else {
      sql`INSERT INTO pedidos (nome, data_nascimento, clube, jogador_favorito, telefone, sticker_id, sticker_url, preview_url, status, api_key_used, generation_ms)
          VALUES (${nomeSafe}, ${dataNascimento}, ${clubeSafe}, ${jogadorSafe}, ${telefoneSafe}, ${stickerId}, ${blob.url}, ${finalPreviewUrl}, 'pendente', ${successKeyIdx + 1}, ${generationMs})`
        .catch(e => console.error("DB insert erro:", e));
    }

    console.log(`Figurinha salva: ${stickerId} | preview: ${previewBlob?.url ?? "fallback"}`);
    return NextResponse.json({
      imageBase64: imageData.b64_json,
      mimeType: "image/png",
      stickerId,
    });
  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : String(error);
    const errStack = error instanceof Error ? error.stack : undefined;
    console.error("OUTER CATCH — erro na geração:", errMsg, errStack ?? "");
    return NextResponse.json({ error: "Erro na geração. Tente novamente." }, { status: 500 });
  }
}
