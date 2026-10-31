STATUS: IN_PROGRESS
TASK: Telegram bot that drafts invoices from a voice note
DATE: 2026-10-30T18:10Z
LAST_ACTION: PDF renders with logo and totals (commit 4f2a91c), VAT line still missing
NEXT: add a VAT field to the PDF template and a test with 20% and 0%
BLOCKER: none
DO_NOT_REDO:
- bot registered with BotFather, token in ~/.secrets/invoice-bot.env
- staging deployed 26.10 (fly.io app invoice-bot-staging)
VERIFY_BEFORE_ACT: git log -1; curl -s https://invoice-bot-staging.fly.dev/health
