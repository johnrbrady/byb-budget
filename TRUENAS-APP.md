# TrueNAS app package

BYB! Budget now includes a contribution-ready TrueNAS 25.10 community app at
`truenas-app/ix-dev/community/byb-budget` and publishes a versioned container
image (`ghcr.io/johnrbrady/byb-budget:1.0.0`).

## Why this is not installed automatically

TrueNAS 25.10 uses the official Docker Compose catalog and lets administrators
select its trains; it does not provide the old UI workflow for adding one small
third-party catalog alongside the official catalog. Replacing the entire catalog
location with a private fork would also take ownership of every catalog update,
so BYB! deliberately does not do that.

The supported route to the normal **Update** button is:

1. submit the included definition to the official `truenas/apps` community train;
2. wait for catalog review and publication;
3. take and verify a fresh BYB! backup;
4. install one BYB! catalog app per household, using that household's existing
   data directory as the Host Path;
5. verify login, balances, data version, and phone behaviour before retiring the
   old custom app.

An existing Custom App does not turn into a catalog app merely because the image
name is the same. Do not remove an old instance or its dataset during migration.

## Current deployment limitation

Publishing to GitHub builds the image, but GitHub cannot operate the private
TrueNAS UI or supply its local administrator session. A production rollout still
requires an authenticated TrueNAS session (or an already-authorized API/SSH
credential), then the documented backup, update, and verification sequence for
John, Trinidad, Tex, and Aleem.
