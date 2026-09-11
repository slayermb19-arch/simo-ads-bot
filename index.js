import "dotenv/config";
import process from "node:process";

const telegramToken = process.env.TELEGRAM_BOT_TOKEN;
const openaiKey = process.env.OPENAI_API_KEY;

if (!telegramToken) {
  console.error("Missing TELEGRAM_BOT_TOKEN. Add it in Railway Variables.");
  process.exit(1);
}

if (!openaiKey) {
  console.error("Missing OPENAI_API_KEY. Add it in Railway Variables.");
  process.exit(1);
}

const TELEGRAM_API = ["https:", "", "api.telegram.org", "bot" + telegramToken].join("/");
const TELEGRAM_FILE_API = ["https:", "", "api.telegram.org", "file", "bot" + telegramToken].join("/");
const OPENAI_API = ["https:", "", "api.openai.com", "v1"].join("/");
const drafts = new Map();
let offset = 0;

const imageVariants = [
  "Clean luxury studio product photo on a light marble surface with soft blue accents and gentle botanical details.",
  "Premium lifestyle product advertisement with elegant bathroom-inspired styling, soft daylight and realistic reflections.",
  "High-end editorial beauty advertisement with a refined colorful background, controlled studio lighting and cinematic depth.",
  "Minimal premium e-commerce hero image with a clean soft background, subtle shadow and strong product focus.",
];

async function telegram(method, body = {}) {
  const response = await fetch(`${TELEGRAM_API}/${method}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await response.json();
  if (!data.ok) throw new Error(`${method}: ${data.description || "Telegram API error"}`);
  return data.result;
}

async function telegramMultipart(method, form) {
  const response = await fetch(`${TELEGRAM_API}/${method}`, {
    method: "POST",
    body: form,
  });
  const data = await response.json();
  if (!data.ok) throw new Error(`${method}: ${data.description || "Telegram API error"}`);
  return data.result;
}

async function openaiJson(endpoint, body) {
  const response = await fetch(`${OPENAI_API}/${endpoint}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${openaiKey}`,
    },
    body: JSON.stringify(body),
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(`OpenAI ${endpoint}: ${data?.error?.message || "API request failed"}`);
  }
  return data;
}

async function downloadProductPhoto(fileId) {
  const file = await telegram("getFile", { file_id: fileId });
  if (!file.file_path) throw new Error("Telegram did not return a photo path");

  const response = await fetch(`${TELEGRAM_FILE_API}/${file.file_path}`);
  if (!response.ok) throw new Error("Could not download the Telegram photo");

  return {
    buffer: Buffer.from(await response.arrayBuffer()),
    mime: response.headers.get("content-type") || "image/jpeg",
  };
}

function extractResponseText(response) {
  if (typeof response.output_text === "string") return response.output_text;
  const parts = [];
  for (const item of response.output || []) {
    for (const content of item.content || []) {
      if (typeof content.text === "string") parts.push(content.text);
    }
  }
  return parts.join("\n").trim();
}

function parseJsonText(text) {
  const cleaned = text.replace(/^```json\s*/i, "").replace(/```$/i, "").trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    return { title: "Product", description: cleaned };
  }
}

async function createProductCopy(photo, price) {
  const imageDataUrl = `data:${photo.mime};base64,${photo.buffer.toString("base64")}`;
  const response = await openaiJson("responses", {
    model: process.env.OPENAI_TEXT_MODEL || "gpt-4.1-mini",
    input: [
      {
        role: "user",
        content: [
          {
            type: "input_text",
            text: `Analyze this product photo and write a concise e-commerce title and description. Price: ${price}. Do not invent medical claims, ingredients, certifications or unsupported facts. Return only valid JSON with keys title and description.`,
          },
          { type: "input_image", image_url: imageDataUrl },
        ],
      },
    ],
  });
  return parseJsonText(extractResponseText(response));
}

async function createAdImage(photo, variant) {
  const form = new FormData();
  form.append("model", process.env.OPENAI_IMAGE_MODEL || "gpt-image-1");
  form.append(
    "prompt",
    `Create a photorealistic premium commercial advertisement using the attached product photo as the strict product reference. Preserve the exact product shape, packaging, logo, colors, label and proportions. Do not redesign or invent the packaging. ${variant} Keep the product sharp and recognizable. Do not add people, hands, extra products, fake logos, medical claims, price, watermark or invented text. High-end e-commerce advertising, vertical composition, realistic lighting and natural shadows.`,
  );
  form.append("size", "1024x1536");
  form.append("quality", "medium");
  form.append("image", new Blob([photo.buffer], { type: photo.mime }), "product.jpg");

  const response = await fetch(`${OPENAI_API}/images/edits`, {
    method: "POST",
    headers: { authorization: `Bearer ${openaiKey}` },
    body: form,
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(`OpenAI image edit: ${data?.error?.message || "API request failed"}`);
  }

  const item = data.data?.[0];
  if (!item?.b64_json) throw new Error("OpenAI returned no image data");
  return Buffer.from(item.b64_json, "base64");
}

async function send(chatId, text) {
  await telegram("sendMessage", { chat_id: chatId, text });
}

async function sendPhoto(chatId, buffer, caption) {
  const form = new FormData();
  form.append("chat_id", String(chatId));
  form.append("caption", caption);
  form.append("photo", new Blob([buffer], { type: "image/png" }), "ad.png");
  await telegramMultipart("sendPhoto", form);
}

async function processProduct(chatId, draft) {
  const photo = await downloadProductPhoto(draft.fileId);
  await send(chatId, "كنوجد العنوان والوصف بـ ChatGPT... ⏳");
  const copy = await createProductCopy(photo, draft.price);

  await send(
    chatId,
    `العنوان المقترح:\n${copy.title}\n\nالوصف:\n${copy.description}\n\nدابا كنوجد 4 صور إعلانية... ⏳`,
  );

  for (let i = 0; i < imageVariants.length; i += 1) {
    const image = await createAdImage(photo, imageVariants[i]);
    await sendPhoto(chatId, image, `Ad ${i + 1}/4`);
  }

  await send(chatId, "كملنا 4 الصور ✅\nالمرحلة الجاية هي APPROVE ثم النشر فـ Shopify والمنصات.");
}

function draftFor(chatId) {
  if (!drafts.has(chatId)) drafts.set(chatId, {});
  return drafts.get(chatId);
}

async function handleMessage(message) {
  const chatId = message?.chat?.id;
  if (!chatId) return;

  if (message.text === "/start" || message.text === "/help") {
    await send(chatId, "مرحبا 👋\n\n/newproduct - بدا منتج جديد\n/testopenai - اختبار OpenAI\n/cancel - إلغاء العملية الحالية");
    return;
  }

  if (message.text === "/testopenai") {
    const response = await openaiJson("responses", {
      model: process.env.OPENAI_TEXT_MODEL || "gpt-4.1-mini",
      input: "Reply with exactly: OPENAI_OK",
    });
    await send(chatId, `OpenAI خدام ✅\n${extractResponseText(response)}`);
    return;
  }

  if (message.text === "/cancel") {
    drafts.delete(chatId);
    await send(chatId, "تلغات العملية ✅");
    return;
  }

  if (message.text === "/newproduct") {
    drafts.set(chatId, { stage: "photo" });
    await send(chatId, "مزيان ✅ صيفط دابا صورة المنتج.");
    return;
  }

  const draft = draftFor(chatId);

  if (message.photo && draft.stage === "photo") {
    const bestPhoto = message.photo.at(-1);
    draft.fileId = bestPhoto.file_id;
    draft.stage = "price";
    await send(chatId, "وصلات الصورة ✅\n\nدخل دابا الثمن، مثال: 299 MAD");
    return;
  }

  if (message.text && draft.stage === "price") {
    draft.price = message.text.trim();
    draft.stage = "processing";
    await send(chatId, "تم تسجيل الثمن ✅ كنبدأ المعالجة دابا... ⏳");
    try {
      await processProduct(chatId, draft);
      drafts.delete(chatId);
    } catch (error) {
      console.error(error);
      draft.stage = "error";
      await send(chatId, `وقع مشكل فـ OpenAI: ${error.message}`);
    }
    return;
  }

  await send(chatId, "استعمل /newproduct باش تبدا منتج جديد.");
}

async function poll() {
  while (true) {
    try {
      const updates = await telegram("getUpdates", {
        offset,
        timeout: 25,
        allowed_updates: ["message"],
      });

      for (const update of updates) {
        offset = update.update_id + 1;
        try {
          await handleMessage(update.message);
        } catch (error) {
          console.error(error);
          if (update.message?.chat?.id) {
            await send(update.message.chat.id, `وقع مشكل: ${error.message}`);
          }
        }
      }
    } catch (error) {
      console.error(error.message);
      await new Promise((resolve) => setTimeout(resolve, 5000));
    }
  }
}

console.log("SIMO Ads Bot with OpenAI is running...");
poll();
