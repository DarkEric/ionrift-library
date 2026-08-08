# DarkEric Develop Rolling Release — Design

**Date:** 2026-08-08  
**Status:** Approved  
**Repos:** DarkEric forks of `ionrift-library`, `ionrift-respite`, `ionrift-quartermaster`  
**Channel:** GitHub Releases tag `develop` (prerelease, overwritten on each push)

## Goal

Install and update fork builds from Foundry via a stable manifest URL, with LevelDB packs compiled in CI (not empty gitignored stubs).

## Decisions

| Topic | Choice |
|---|---|
| Host | GitHub Releases on `DarkEric/*` |
| Branch | `develop` |
| Publish mode | Rolling prerelease `develop` |
| Pack compile | `@foundryvtt/foundryvtt-cli` from `packs/src` (no private testharness) |
| Version stamp | `<module.json version>-dev.<shortsha>` |

## Manifest URLs (Foundry → Install Module)

- `https://github.com/DarkEric/ionrift-library/releases/download/develop/module.json`
- `https://github.com/DarkEric/ionrift-respite/releases/download/develop/module.json`
- `https://github.com/DarkEric/ionrift-quartermaster/releases/download/develop/module.json`

## CI outline

1. Push / workflow_dispatch on `develop`
2. checkout (lfs: true)
3. setup-node 20 + npm install
4. compile packs via `.github/scripts/compile-packs.mjs` when `packs/src/<packName>` exists  
   (not `tools/` — that path is gitignored on upstream Ionrift modules)
5. stamp `module.json` via `.github/scripts/stamp-develop-manifest.mjs` (version, manifest, download, url; rewrite `ionrift-*` requires to DarkEric develop manifests)
6. zip module
7. delete prior `develop` release+tag; create prerelease with `module.json` + `module.zip`

## Out of scope

- Publishing to upstream `ionrift-gm` releases
- GitLab
- Automatic Foundry package browser listing
