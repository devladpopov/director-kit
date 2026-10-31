STATUS: IN_PROGRESS
TASK: move DNS to the new registrar
DATE: 2026-10-29T14:00Z
LAST_ACTION: transfer requested, auth code sent to the old registrar
NEXT: when the transfer completes, re-create the MX and TXT records from dns-backup.txt
WAIT_FOR: registrar transfer email (usually 5 days)
BLOCKER: external: old registrar must release the domain
DO_NOT_REDO:
- dns-backup.txt exported 29.10, all 14 records
- transfer requested 29.10 (paid, do not request again)
VERIFY_BEFORE_ACT: dig +short MX example.com; whois example.com | grep -i registrar
