import "dotenv/config";
import process from "node:process";

const telegramToken = process.env.TELEGRAM_BOT_TOKEN;
const openaiKey = process.env.OPENAI_API_KEY;
const geminiKey = process.env.GEMINI_API_KEY;
const aiEnabled = process.env.AI_ENABLED === "true";
const openaiBaseUrl = (process.env.OPENAI_BASE_URL || "https://api.openai.com/v1").replace(/\/+$/, "");
const openaiImageModel = process.env.OPENAI_IMAGE_MODEL || "gpt-image-1";
const geminiTextModel = process.env.GEMINI_TEXT_MODEL || "gemini-2.5-flash";

if (!telegramToken) {
  console.error("Missing TELEGRAM_BOT_TOKEN. Add it in Railway Variables.");
  process.exit(1);
}

if (aiEnabled && !openaiKey) {
  console.error("AI_ENABLED=true but OPENAI_API_KEY is missing. ChatGPT is used for images.");
  process.exit(1);
}

if (aiEnabled && !geminiKey) {
  console.error("AI_ENABLED=true but GEMINI_API_KEY is missing. Gemini is used for title, description and SEO.");
  process.exit(1);
}

const TELEGRAM_API = ["https:", "", "api.telegram.org", "bot" + telegramToken].join("/");
const TELEGRAM_FILE_API = ["https:", "", "api.telegram.org", "file", "bot" + telegramToken].join("/");
const drafts = new Map();
let offset = 0;

const imageVariants = [
  "Use the same locked background and set. Vary only the camera angle and product placement: premium studio hero composition.",
  "Use the same locked background and set. Vary only the camera distance and crop: elegant lifestyle composition.",
  "Use the same locked background and set. Vary only the product position and perspective: clean e-commerce composition.",
  "Use the same locked background and set. Vary only the framing and depth: cinematic social-ad composition.",
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
  const response = await fetch(`${TELEGRAM_API}/${method}`, { method: "POST", body: form });
  const data = await response.json();
  if (!data.ok) throw new Error(`${method}: ${data.description || "Telegram API error"}`);
  return data.result;
}

async function geminiText(photo, price, prompt) {
  const url = ["https:", "", "generativelanguage.googleapis.com", "v1beta", "models", geminiTextModel].join("/") + ":generateContent";
  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json", "x-goog-api-key": geminiKey },
    body: JSON.stringify({
      contents: [{
        role: "user",
        parts: [
          { text: `${prompt}\nPrice: ${price}` },
          { inline_data: { mime_type: photo.mime, data: photo.buffer.toString("base64") } },
        ],
      }],
      generationConfig: { responseMimeType: "application/json" },
    }),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(`Gemini: ${data?.error?.message || "API request failed"}`);
  return data?.candidates?.[0]?.content?.parts?.map((part) => part.text || "").join("").trim() || "";
}

async function openaiImage(photo, variant) {
  const form = new FormData();
  form.append("model", openaiImageModel);
  form.append("prompt", `Create one vertical 9:16 photorealistic product advertisement from the attached product image. Preserve the exact product shape, packaging, logo, colors, label and proportions. Keep the background identical to the approved reference style across all four images. ${variant} No writing, no price, no CTA, no watermark, no extra products, no people, no fake text and no invented claims. The product must be sharp, recognizable and commercially accurate.`);
  form.append("size", "1024x1536");
  form.append("quality", "medium");
  form.append("image", new Blob([photo.buffer], { type: photo.mime }), "product.jpg");

  const response = await fetch(`${openaiBaseUrl}/images/edits`, {
    method: "POST",
    headers: { authorization: `Bearer ${openaiKey}` },
    body: form,
  });
  const data = await response.json();
  if (!response.ok) throw new Error(`ChatGPT image: ${data?.error?.message || "API request failed"}`);
  const item = data.data?.[0];
  if (!item?.b64_json) throw new Error("ChatGPT returned no image data");
  return Buffer.from(item.b64_json, "base64");
}

async function downloadProductPhoto(fileId) {
  const file = await telegram("getFile", { file_id: fileId });
  if (!file.file_path) throw new Error("Telegram did not return a photo path");
  const response = await fetch(`${TELEGRAM_FILE_API}/${file.file_path}`);
  if (!response.ok) throw new Error("Could not download the Telegram photo");
  return { buffer: Buffer.from(await response.arrayBuffer()), mime: response.headers.get("content-type") || "image/jpeg" };
}

function parseJsonText(text) {
  const cleaned = text.replace(/^```json\s*/i, "").replace(/```$/i, "").trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    return { title: "Product", description: cleaned, seo_title: "", meta_description: "", keywords: [], slug: "" };
  }
}

async function createProductCopy(photo, price) {
  const prompt = `Create an honest e-commerce title, description and SEO fields for this product photo. Use only visible or provided information. Do not invent ingredients, certifications, medical claims or unsupported benefits. Write in clear French for Moroccan customers. Return only valid JSON with exactly these keys: title, description, seo_title, meta_description, keywords, slug. SEO title max 60 characters when possible. Meta description approximately 150-160 characters. Keywords should be an array of 8-12 natural phrases. Slug must be lowercase Latin words separated by hyphens.`;
    const text = await geminiText(testPhoto, "0", "Reply with exactly the word GEMINI_OK. Do not use an image.");
  return parseJsonText(text);
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
  await send(chatId, "Gemini كيوجد Title وDescription وSEO... ⏳");
  const copy = await createProductCopy(photo, draft.price);
  await send(chatId, `Title: ${copy.title}\n\nDescription: ${copy.description}\n\nSEO Title: ${copy.seo_title || ""}\nMeta Description: ${copy.meta_description || ""}\nKeywords: ${Array.isArray(copy.keywords) ? copy.keywords.join(", ") : copy.keywords || ""}\nSlug: ${copy.slug || ""}\n\nChatGPT كيوجد 4 صور بلا كتابة وبنفس الخلفية... ⏳`);

  for (let i = 0; i < imageVariants.length; i += 1) {
    const image = await openaiImage(photo, imageVariants[i]);
    await sendPhoto(chatId, image, `Ad ${i + 1}/4`);
  }
  await send(chatId, "كملنا Gemini للنصوص وChatGPT للصور ✅");
}

function draftFor(chatId) {
  if (!drafts.has(chatId)) drafts.set(chatId, {});
  return drafts.get(chatId);
}

async function handleMessage(message) {
  const chatId = message?.chat?.id;
  if (!chatId) return;

  if (message.text === "/start" || message.text === "/help") {
    await send(chatId, "مرحبا 👋\n\n/newproduct - بدا منتج جديد\n/testai - اختبار Gemini وChatGPT\n/cancel - إلغاء العملية الحالية");
    return;
  }

  if (message.text === "/testai") {
    if (!aiEnabled) {
      await send(chatId, "AI مخليّاه معطل مؤقتاً ✅");
      return;
    }
    const testPhoto = { mime: "image/jpeg", buffer: Buffer.from("") };
    const text = await geminiText(testPhoto, "0", "Reply with exactly the word GEMINI_OK. Do not use an image.");
    await send(chatId, `Gemini خدام ✅\n${text}`);
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
    if (!aiEnabled) {
      drafts.delete(chatId);
      await send(chatId, `تم تسجيل المنتج ✅\n\nالثمن: ${draft.price}\n\nAI مخليّاه معطل حالياً. منين نفعّلوه: Gemini للنصوص وChatGPT للصور.`);
      return;
    }
    draft.stage = "processing";
    await send(chatId, "تم تسجيل الثمن ✅ كنبدأ المعالجة دابا... ⏳");
    try {
      await processProduct(chatId, draft);
      drafts.delete(chatId);
    } catch (error) {
      console.error(error);
      draft.stage = "error";
      await send(chatId, `وقع مشكل فـ AI: ${error.message}`);
    }
    return;
  }

  await send(chatId, "استعمل /newproduct باش تبدا منتج جديد.");
}

async function poll() {
  while (true) {
    try {
      const updates = await telegram("getUpdates", { offset, timeout: 25, allowed_updates: ["message"] });
      for (const update of updates) {
        offset = update.update_id + 1;
        try {
          await handleMessage(update.message);
        } catch (error) {
          console.error(error);
          if (update.message?.chat?.id) await send(update.message.chat.id, `وقع مشكل: ${error.message}`);
        }
      }
    } catch (error) {
      console.error(error.message);
      await new Promise((resolve) => setTimeout(resolve, 5000));
    }
  }
}

console.log(`SIMO Ads Bot is running. AI enabled: ${aiEnabled}`);
poll();
