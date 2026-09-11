import "dotenv/config";
import process from "node:process";

const token = process.env.TELEGRAM_BOT_TOKEN;
if (!token) {
  console.error("Missing TELEGRAM_BOT_TOKEN. Add it in Railway Variables.");
  process.exit(1);
}

const API = ["https:", "", "api.telegram.org", "bot" + token].join("/");
const drafts = new Map();
let offset = 0;

async function telegram(method, body = {}) {
  const response = await fetch(`${API}/${method}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await response.json();
  if (!data.ok) {
    throw new Error(`${method}: ${data.description || "Telegram API error"}`);
  }
  return data.result;
}

function draftFor(chatId) {
  if (!drafts.has(chatId)) drafts.set(chatId, {});
  return drafts.get(chatId);
}

async function send(chatId, text) {
  await telegram("sendMessage", { chat_id: chatId, text });
}

async function handleMessage(message) {
  const chatId = message?.chat?.id;
  if (!chatId) return;

  if (message.text === "/start" || message.text === "/help") {
    await send(
      chatId,
      "مرحبا 👋\n\n/newproduct - بدا منتج جديد\n/cancel - إلغاء العملية الحالية\n\nصيفط الصورة ومن بعد الثمن.",
    );
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
    draft.stage = "review";
    await send(
      chatId,
      `تم تسجيل المنتج ✅\n\nالثمن: ${draft.price}\n\nالمرحلة الجاية: توليد 4 صور بـ ChatGPT وكتابة العنوان والوصف.`,
    );
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
        }
      }
    } catch (error) {
      console.error(error.message);
      await new Promise((resolve) => setTimeout(resolve, 5000));
    }
  }
}

console.log("SIMO Ads Bot is running...");
poll();
