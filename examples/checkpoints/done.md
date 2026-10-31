STATUS: COMPLETED
TASK: nightly backups of the home server to object storage
DATE: 2026-10-28T07:15Z
LAST_ACTION: restore test passed: 3 random files restored and diffed clean
NEXT: await user input
BLOCKER: none
DO_NOT_REDO:
- bucket created, lifecycle 30 days
- systemd timer backup.timer enabled
- restore test 28.10 passed
VERIFY_BEFORE_ACT: systemctl list-timers backup.timer; restic snapshots --latest 1
