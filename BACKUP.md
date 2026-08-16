# Backups and restore

Every household's entire financial history is one JSON file inside one
container. This document covers the two scripts that protect it, how to install
them, how to confirm they are still working, and how to get data back.

- `byb-backup.sh` — scheduled backup of every instance, with verification
- `byb-restore.sh` — restore one instance from a backup, with verification

Both are POSIX `sh`. Neither needs `jq`, `python3`, or GNU-specific flags,
because nothing is known about what the TrueNAS host has installed.

---

## What gets backed up

For every container matching `docker ps --filter name=byb`:

| File | Backed up | Why |
|---|---|---|
| `budget.json` | yes | transactions, categories, envelopes, users, the lot |
| `passwords.json` | yes | bcrypt hashes — see below, this one is not optional |
| `sessions.json` | **no** | bearer tokens: useless in a backup, a liability in one |

**`budget.json` and `passwords.json` are a matched pair and both scripts treat
them as one unit.** Restoring one without the other breaks the instance in a
way that is not obvious:

- A user who exists in `budget.json` but has no entry in `passwords.json` is
  treated as a *first sign-in*. `server.js` sets their password to whatever is
  typed at the login screen, and if that is the only password in the file, it
  promotes them to `owner`. Restoring `budget.json` next to an empty or stale
  `passwords.json` therefore hands the household account to whoever logs in
  first.
- A user who has an entry in `passwords.json` but is missing from the restored
  `budget.json` cannot log in at all — login checks the user list in
  `budget.json` before it ever looks at the password file.

Instances are discovered dynamically from the container name filter `byb`. A
household added later is picked up with no edit to any script. Nothing is
hard-coded — this is the specific mistake `update-truenas.sh` made.

---

## Where backups land

The destination is a parameter (`-d`, or `BYB_BACKUP_DIR`) and defaults to
`/mnt/tank/byb-backups`.

**The destination must already exist. The script never creates it.** A missing
destination almost always means the pool name is wrong, and silently creating
it would scatter backups somewhere nobody is watching — quite possibly the
small boot pool. It is also refused outright if it is anywhere under
`/mnt/.ix-apps/`, which is the apps' own storage: losing that pool would take
the data and every copy of it at the same moment.

```
/mnt/tank/byb-backups/
├── last-run.txt                       ← always rewritten; this is your alarm
├── 2026-08-15_030000/
│   ├── BACKUP-OK                      ← only written if EVERYTHING verified
│   ├── MANIFEST.txt                   ← what was copied, and its shape
│   ├── ix-byb-budget-byb-budget-1/
│   │   ├── budget.json
│   │   └── passwords.json
│   ├── ix-byb-trinidad-byb-trinidad-1/
│   ├── ix-byb-tex-byb-tex-1/
│   └── ix-byb-aleem-byb-aleem-1/
└── 2026-08-16_030000/
```

Put this on a data pool, not the boot pool, and ideally replicate the dataset
somewhere else as well. A backup that shares a pool with the thing it is backing
up only protects you from mistakes, not from losing the pool.

---

## How each file is verified

A backup that is never read is a rumour. After copying each file, the script
proves three things about **the bytes that actually landed on disk**, not about
the copy it hoped it made:

1. the file exists and is non-zero;
2. it parses as JSON, and parses to an *object* rather than to `null`, a
   number, or an array;
3. it is **byte-for-byte identical** to the file still inside the container.

The JSON check runs **inside the container**, using the container's own Node.
The host may have no `jq`, no `python3` and no `node`; guessing wrong is exactly
how a backup script quietly stops verifying anything. The container is
guaranteed to have Node (it is `node:20-alpine`) and it has to be running for us
to copy out of it anyway. It is also the runtime that will have to parse the
file during a restore, so it is the right judge of whether the file is usable.
The host's copy is piped in on standard input, so what is validated is the
backup, not the original.

`server.js` writes data with a plain `fs.writeFileSync` — no write-to-temp-then-
rename — so a save landing mid-copy can produce a torn read. The copy-and-verify
pair is therefore retried up to three times before it is called a failure. A
genuinely corrupt source file fails all three and is reported, which is correct:
if the live file is unparseable, you need to know tonight, not in six months.

`MANIFEST.txt` records the shape of every file:

```
instance=ix-byb-budget-byb-budget-1
  OK      budget.json  bytes=194233 keys=9 transactions=430 users=4
  OK      passwords.json  bytes=412 keys=4 transactions=- users=-
```

The `transactions=` count is worth glancing at. A file that silently empties
itself is still valid JSON and still backs up cleanly; a transaction count that
drops from 430 to 0 is the only signal you will get.

---

## Installing as a TrueNAS Cron Job

**1. Copy the scripts onto the NAS**, somewhere on a data pool — they are not on
the NAS just because they are in the repository:

```
/mnt/tank/scripts/byb-backup.sh
/mnt/tank/scripts/byb-restore.sh
```

Copy them as-is. If you edit them on Windows, make sure the line endings stay
LF — a `\r` on the `#!` line produces a baffling "bad interpreter" error. The
repository's `.gitattributes` pins `*.sh` to LF for this reason.

**2. Create the destination dataset**, e.g. `/mnt/tank/byb-backups`. The script
will refuse to run until it exists.

**3. Add the cron job.** In the TrueNAS SCALE UI, find *Cron Jobs* (under
System Settings → Advanced in current releases; search the UI for "cron" if the
menu has moved) and add:

| Field | Value |
|---|---|
| Description | `BYB! Budget nightly backup` |
| Command | `sh /mnt/tank/scripts/byb-backup.sh -d /mnt/tank/byb-backups -k 14` |
| Run As User | `root` |
| Schedule | daily, `0 3 * * *` (3am) |
| Hide Standard Output | **checked** |
| Hide Standard Error | **unchecked** |

The output split is deliberate. Everything that went right goes to stdout and
everything that went wrong goes to stderr, so with those two boxes set that way
a healthy night is completely silent and a bad night emails you the specifics.
If you would rather see a nightly confirmation, leave both unchecked.

`root` is needed to reach the Docker socket.

**4. Add the staleness check as a second cron job** — see below. Do not skip
this one.

**5. Run it once by hand** and read the output before trusting the schedule.

---

## Retention

`-k N` (or `BYB_BACKUP_KEEP`) keeps the newest **N verified** runs. Default 14,
which is a fortnight of nightly backups.

Deleting old backups is the only destructive thing the script does, so the rule
is deliberately one sentence:

> Keep the newest `KEEP` run directories that carry a `BACKUP-OK` marker, and
> delete every timestamped run directory older than the oldest one kept.

Three consequences, all of them the point:

- **A failed run never deletes anything.** Pruning is skipped entirely unless
  the current run succeeded in full, so a bad night cannot spend history it
  failed to add to.
- **A good backup is only ever deleted once `KEEP` newer *verified* backups
  exist.** Fewer than `KEEP` verified runs present means nothing is deleted, no
  matter how many failed runs are lying around.
- **Only timestamped run directories are ever candidates.** Anything else in
  the destination — your own exports, notes, a manual copy — is invisible to
  retention.

Failed runs are kept (without a marker) so you can look at them, and are cleaned
up once they fall outside the retained window.

---

## Confirming it works

On the **first run**, check all four of these:

```sh
sh /mnt/tank/scripts/byb-backup.sh -d /mnt/tank/byb-backups
echo "exit: $?"                                    # must be 0
```

1. **Exit code 0**, and the summary names the number of instances you expect.
   Today that is four. If it says three, a household is missing.
2. **Every household appears** in the run directory:
   ```sh
   ls /mnt/tank/byb-backups/*/
   ```
3. **The manifest is sane** — in particular the transaction counts match
   reality:
   ```sh
   cat /mnt/tank/byb-backups/*/MANIFEST.txt
   ```
4. **A `BACKUP-OK` marker exists** in the run directory. No marker means the run
   did not fully verify, whatever else it printed.

Thereafter, the routine check is one command:

```sh
sh /mnt/tank/scripts/byb-backup.sh -c -d /mnt/tank/byb-backups
```

---

## Telling that it has silently stopped running

This is the failure that actually happens. A backup that stops running produces
no error, no output and no alert — silence looks exactly like success, and you
find out on the day you need it.

`byb-backup.sh` writes `last-run.txt` at the top of the destination on **every**
run, successful or not, and `-c` (check mode) turns a missing or stale one into
a non-zero exit:

```sh
sh /mnt/tank/scripts/byb-backup.sh -c -d /mnt/tank/byb-backups
# byb-backup: OK — last verified backup finished 7h ago (2026-08-16 03:00:11 AEST).
```

It fails, loudly and specifically, when:

- no backup has ever recorded a result there (never ran, or wrong destination);
- the last run's status was not `OK`;
- the last successful run is older than `-a HOURS` (default 36).

**Install this as its own cron job**, on a different schedule from the backup —
a check that only runs when the backup runs cannot notice the backup not
running:

| Field | Value |
|---|---|
| Description | `BYB! Budget backup staleness check` |
| Command | `sh /mnt/tank/scripts/byb-backup.sh -c -d /mnt/tank/byb-backups -a 36` |
| Run As User | `root` |
| Schedule | daily, `0 9 * * *` (9am, well after the 3am backup) |
| Hide Standard Output | checked |
| Hide Standard Error | **unchecked** |

Two more things worth knowing:

- The check only reads `last-run.txt`. If someone points the backup at a
  different destination and forgets to update the check, the check keeps
  reporting on the old location — so change both together.
- A destination that has quietly filled up shows as a failed run, not a stale
  one, because the write itself fails.

---

## Restoring

```sh
# 1. see what you have
ls -d /mnt/tank/byb-backups/*/
cat /mnt/tank/byb-backups/2026-08-16_030000/MANIFEST.txt

# 2. restore one household
sh /mnt/tank/scripts/byb-restore.sh \
   -b /mnt/tank/byb-backups/2026-08-16_030000 \
   -i ix-byb-budget-byb-budget-1
```

It asks for confirmation (type `RESTORE`) unless you pass `-y`, and refuses to
run non-interactively without `-y` so a stray command cannot overwrite a
household.

What it does, in order:

1. **Validates the backup first.** Both files must exist, be non-zero and parse
   as JSON objects. If anything fails, nothing is touched at all — the instance
   is left exactly as it was.
2. Shows you what you are replacing: the backup's transaction count next to the
   instance's current one.
3. Stops the container. (This takes about ten seconds. The app runs as PID 1,
   which does not take the default action on `SIGTERM`, so Docker waits out its
   grace period and then kills it. Nothing is lost — every write the server
   makes is completed synchronously inside its request.)
4. Copies `budget.json` and `passwords.json` in, together.
5. **Empties `sessions.json`.** This is not tidiness; see below. Everyone signs
   in again.
6. Starts the container.
7. **Proves it.** Re-reads both files from inside the container and compares
   them byte-for-byte against the backup. If that fails, so does the script.

Afterwards, tell the household to fully close and reopen the app rather than
carry on in a tab that was open before the restore.

---

## Restore semantics — what actually happens

These were measured against `server.js`, not assumed. They matter because two of
them are counter-intuitive.

**A restored `budget.json` is live immediately. No container restart is needed.**
`server.js` calls `readJSON(DATA_FILE)` inside every request handler and holds
no cached copy, so the very next `GET /api/data` serves the restored file.
Overwriting the file under a running server and re-reading returns the new
contents with the process untouched.

**A browser holding a *newer* `dataVersion` cannot clobber the restore.**
`POST /api/data` rejects any write whose `dataVersion` differs from the one on
disk. A client that loaded at version 57 posting against a file restored to
version 42 gets `409`, and `main.jsx` responds by reloading from the server and
discarding its own in-memory state. This case is safe and self-healing.

**A browser holding the *same* `dataVersion` as the restored file overwrites it
silently.** This is the one that bites. `dataVersion` is a plain counter, not a
content hash, and the guard is an equality test. If the backup was taken when
the file was at version 50, and any client loaded while the file was still at
version 50, that client's next save posts version 50, matches, is accepted, and
writes its own in-memory state over everything you just restored — bumping the
counter to 51 as it goes. No error, no conflict, no trace.

That is not a far-fetched sequence. The backup runs at 3am and the version does
not change again until someone next saves, so any phone that opened the app that
morning is holding exactly the backed-up version. Saves are debounced and also
flushed on `visibilitychange` and `pagehide`, so merely backgrounding the PWA
after an edit is enough to fire one.

**Stopping and starting the container does not prevent this.** The stale client
is still holding version 50 when the container comes back, and the restored file
is still at version 50.

**Emptying `sessions.json` does prevent it.** Every stale client is then answered
`401` on its next save and its pending write is discarded, because `main.jsx`
only acts on `409` and on success. `byb-restore.sh` always performs this step,
which is why a restore costs everyone a fresh sign-in. That is the price of the
restore actually sticking.

If you ever restore by hand instead of using the script, **empty
`sessions.json` as part of it.** Copying `budget.json` in on its own leaves a
window in which the restore can be silently undone.

---

## Exit codes

`byb-backup.sh`

| Code | Meaning |
|---|---|
| 0 | every instance backed up and verified |
| 1 | configuration error — bad arguments, destination unusable, no docker |
| 2 | no containers match the filter at all, not even stopped ones |
| 3 | one or more instances failed; the run is partial, not successful (also: containers exist but none is running, and check-mode failures) |

A container that exists but is **not running** is reported as a failure, not
skipped. `docker ps` only lists running containers, so without that cross-check
a stopped household would be passed over in silence while its data went
unprotected. If a household has genuinely been retired, remove its container and
the run goes green again.

`byb-restore.sh`

| Code | Meaning |
|---|---|
| 0 | restored and verified byte-for-byte |
| 1 | configuration error — bad arguments, no such backup or container |
| 2 | the backup failed validation; **nothing was touched** |
| 3 | the restore was attempted and could not be verified |

---

## Known limitations

- **Not off-site.** Backups land on a pool on the same machine. That covers
  mistakes, corruption and a bad deploy; it does not cover losing the NAS.
  Replicate the destination dataset somewhere else for that.
- **No encryption.** `passwords.json` holds bcrypt hashes, which are not
  plaintext but are worth brute-forcing offline. Keep the destination dataset's
  permissions tight.
- **Crash-consistent, not atomic.** The server writes with a plain
  `writeFileSync`, so a copy can catch a torn file. The script detects that and
  retries; it cannot prevent it.
- **Backups are only as good as the last restore you tested.** Restore into a
  scratch instance once in a while and confirm the household's data is really
  there.
