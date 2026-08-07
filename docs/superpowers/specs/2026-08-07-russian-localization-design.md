# Russian Localization — Ionrift Suite Design

**Date:** 2026-08-07  
**Modules:** `ionrift-library`, `ionrift-respite`, `ionrift-quartermaster`  
**Status:** Approved for planning

## Goals

Localize the Ionrift Foundry VTT suite for Russian-speaking tables while keeping English intact and merge-friendly with upstream.

**In scope (full player/GM surface):**
- UI: buttons, settings, hints, dialogs, notifications, templates
- Runtime data labels: terrains, events, activities, and similar display strings
- Compendium pack entries (Item / Actor / Journal names and descriptions)

**Out of scope (first pass):**
- README, wiki, CHANGELOG
- Core Foundry / system strings (covered by community module `ru-ru`)
- Changing pack *source* documents to Russian

## Decisions

| Decision | Choice |
|---|---|
| Language model | Foundry i18n: `en.json` + `ru.json`, language from Foundry client settings |
| Implementation style | Incremental extraction (not big-bang, not overlay-only module) |
| Module order | Library → Respite → Quartermaster |
| Compendiums | Leave EN packs as source; translate at runtime via **Babele** |
| Voice / terminology | Formal «вы»; prefer terms aligned with `ru-ru` / official D&D5e & PF2e RU where applicable |
| Test install | `D:\VTT\Data\modules` (Babele, lib-wrapper, ru-ru already present) |

## Architecture

Two translation channels:

1. **UI / settings / notifications / runtime data labels**  
   Standard Foundry `languages` in each `module.json` pointing at `lang/en.json` and `lang/ru.json`.  
   Code uses `game.i18n.localize` / `format`; Handlebars uses `{{localize}}`.  
   Key pattern: `IONRIFT.<MODULE>.<AREA>.<NAME>`  
   Examples: `IONRIFT.LIBRARY.TERRAIN.Forest`, `IONRIFT.RESPITE.REST.PrepareCamp`.

2. **Compendium packs**  
   EN packs unchanged. Babele JSON under `babele/ru/`.  
   Register on `Hooks.once("babele.init")` (same pattern as `ru-ru`).  
   `module.json` `relationships.recommends`: `babele`, `lib-wrapper`.

```
┌─────────────┐     localize/format      ┌──────────────┐
│ UI / JS/HBS │ ───────────────────────► │ lang/ru.json │
└─────────────┘                          └──────────────┘
┌─────────────┐     babele.init          ┌──────────────┐
│ EN packs    │ ───────────────────────► │ babele/ru/*  │
└─────────────┘                          └──────────────┘
```

## File layout (per module)

```
lang/
  en.json
  ru.json
babele/
  ru/
    <moduleId>.<packName>.json
    _packs-folders.json          # when folder labels need translation
scripts/...
templates/...
module.json                      # languages + recommends
```

`ionrift-library` has no packs in phase 1 → `lang/` + shared localize helper only; `babele/` only if packs appear later.

## Content routing

| Content type | Mechanism |
|---|---|
| Buttons, settings, hints, dialogs, notifications | `lang/*.json` |
| Item / Actor / Journal name & description in packs | Babele JSON |
| Runtime data (`data/terrains`, events, activities) | `labelKey` / `nameKey` in JSON; localize when building UI. Stable `id` values stay English |
| `module.json` title / description | Remain English (Foundry package listing) |

**Upstream merge rule:** EN packs and `lang/en.json` track upstream; `ru.json` and `babele/ru/` are fork-owned.

## Data flow and fallbacks

**UI string**
1. Code/template requests a key.
2. Foundry loads the active language file from `languages`.
3. Missing RU key → EN value (Foundry fallback).
4. Missing everywhere → raw key visible (signals incomplete extraction).

**Library helper**
- Thin wrapper around `game.i18n.localize` / `format` (e.g. `Ionrift.localize`).
- No custom language cache; Foundry owns loading.
- Respite / Quartermaster use it for shared Library keys and their own module keys.

**Compendium**
1. Pack source stays EN.
2. On `babele.init`, module registers `{ module, lang: "ru", dir: "babele/ru" }`.
3. When client language is `ru` and Babele is active, names/descriptions/folders are swapped at runtime.
4. If Babele is off or mapping missing → packs remain EN; UI can still be RU.

**Runtime data**
- Prefer `labelKey` over hard-coded display English.
- Localize at read/render time only.
- Do not translate machine ids.

**Errors / diagnostics**
- Prefer checklist or small script: keys referenced in code exist in `en.json`.
- Optional one-time console warn if Babele is recommended but inactive when opening translated packs; do not spam.

## Phased readiness criteria

**Test setup:** modules available under `D:\VTT\Data\modules`, Foundry language = Russian, Babele + lib-wrapper active (`ru-ru` optional but useful for system terms).

### Phase 1 — Library
- [ ] `module.json` registers `en` and `ru`
- [ ] Shared UI strings (settings chrome, terrains, pack registry, roll-request, etc.) use i18n keys
- [ ] EN↔RU switch updates those strings; missing RU keys fall back to EN

### Phase 2 — Respite
- [ ] Module UI screens localized
- [ ] Packs translated via Babele when Babele is on
- [ ] Events / terrains / activities show localized labels
- [ ] Without Babele: packs EN, UI still RU

### Phase 3 — Quartermaster
- [ ] Same criteria as Respite for QM UI, packs, and terrain/cache display strings

### Regression
- [ ] Client language English → behavior matches upstream (EN keys)
- [ ] No console errors from missing `game.i18n` or failed Babele registration

## Non-goals reminder

Do not rewrite upstream English pack binaries to Russian. Do not depend on translating D&D/PF2e system strings inside Ionrift — that remains `ru-ru` / system territory.
