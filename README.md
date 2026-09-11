# SIMO Ads Bot

This is the corrected first-stage Telegram bot.

## Included flow

- `/start`
- `/newproduct`
- Receive one product photo
- Receive the price
- Confirm the draft
- `/cancel`

## Railway / GitHub structure

Upload the CONTENTS of this folder, not the ZIP file itself. The repository root must contain:

```
package.json
index.js
```

Railway can use the default start command from `package.json`:

```
npm start
```

You can also set the Railway Start Command to:

```
node index.js
```

## Railway variable

Add this in Railway Variables:

```
TELEGRAM_BOT_TOKEN=your_BotFather_token
```

Never commit `.env` or any API key to GitHub.

OpenAI, image generation, Shopify, Facebook, Instagram and TikTok are intentionally not connected in this first test stage. They will be added after Telegram intake is confirmed.
