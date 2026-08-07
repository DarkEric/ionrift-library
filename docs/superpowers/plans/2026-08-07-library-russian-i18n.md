# Ionrift Library Russian i18n (Phase 1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire Foundry i18n into `ionrift-library` so shared UI strings switch with client language (`en` / `ru`), with a reusable localize helper for Respite and Quartermaster.

**Architecture:** Register `lang/en.json` + `lang/ru.json` in `module.json`. Add `Ionrift.localize` / `Ionrift.format` wrappers around `game.i18n`. Convert user-visible Library strings (settings menus, terrains, settings chrome, player-facing templates, cooking buff labels, diagnostic UI) to `IONRIFT.LIBRARY.*` keys. Keep machine ids English. No Babele in this phase (Library has no packs).

**Tech Stack:** Foundry VTT v12–14 module APIs, ES modules, Handlebars `{{localize}}`, Vitest for unit tests with a `game.i18n` mock.

**Spec:** `docs/superpowers/specs/2026-08-07-russian-localization-design.md`

**Follow-up (separate plans, do not implement here):** Phase 2 Respite (UI + Babele + data `labelKey`), Phase 3 Quartermaster (same).

## Global Constraints

- Key pattern: `IONRIFT.<MODULE>.<AREA>.<NAME>` (Library → `IONRIFT.LIBRARY.*`)
- Languages: Foundry client setting; always ship both `en.json` and `ru.json`
- Voice: formal «вы»; prefer `ru-ru` / official D&D5e & PF2e RU terms where applicable
- Do not rewrite pack source documents (N/A this phase)
- Do not translate README / wiki / CHANGELOG this phase
- Foundry settings `name` / `hint` / menu labels: pass **i18n keys** (Foundry auto-localizes them)
- Stable ids (`forest`, setting keys, buff type ids) stay English
- Test install reference: `D:\VTT\Data\modules` with language Russian

---

## File map

| File | Responsibility |
|---|---|
| `module.json` | Register `languages` for `en` and `ru` |
| `lang/en.json` | Canonical English strings |
| `lang/ru.json` | Russian translations (same keys) |
| `scripts/utils/I18n.js` | `localize`, `format`, safe fallbacks |
| `scripts/composition/createLibraryContext.js` | Export helper on `game.ionrift` / context |
| `scripts/services/terrain/TerrainRegistry.js` | Base terrains use `labelKey`; resolve label on read |
| `scripts/utils/SettingsLayout.js` | Default menu strings → keys |
| `scripts/main.js` | Debug setting + other config strings → keys |
| `scripts/services/cooking/buffs/BuffTypeRegistry.js` | Buff display labels → keys |
| `templates/partials/_roll-request.hbs` | Player-facing chrome → `{{localize}}` |
| Other apps/templates listed in tasks | Remaining Library UI strings |
| `scripts/tests/vitest.config.js` | Vitest config (referenced by `package.json` but missing) |
| `scripts/tests/i18n/*.test.js` | Unit tests for helper + terrain resolution |

---

### Task 1: Scaffold languages + I18n helper + Vitest

**Files:**
- Create: `lang/en.json`
- Create: `lang/ru.json`
- Create: `scripts/utils/I18n.js`
- Create: `scripts/tests/vitest.config.js`
- Create: `scripts/tests/setup/foundryI18nMock.js`
- Create: `scripts/tests/i18n/I18n.test.js`
- Modify: `module.json` (add `languages` array)
- Modify: `scripts/composition/createLibraryContext.js` (export helper)
- Modify: `scripts/main.js` (attach `game.ionrift.localize` if context pattern requires)

**Interfaces:**
- Consumes: Foundry `game.i18n` at runtime; mock in tests
- Produces:
  - `localize(key: string): string`
  - `format(key: string, data?: Record<string, unknown>): string`
  - Both return the key unchanged if `game` / `game.i18n` is unavailable

- [ ] **Step 1: Write failing Vitest for I18n helper**

Create `scripts/tests/setup/foundryI18nMock.js`:

```js
/** @type {Record<string, string>} */
export const translations = {};

export function installFoundryI18nMock() {
    globalThis.game = {
        i18n: {
            localize(key) {
                return Object.prototype.hasOwnProperty.call(translations, key)
                    ? translations[key]
                    : key;
            },
            format(key, data = {}) {
                let str = this.localize(key);
                for (const [k, v] of Object.entries(data)) {
                    str = str.replaceAll(`{${k}}`, String(v));
                }
                return str;
            }
        }
    };
}

export function resetTranslations(next = {}) {
    for (const k of Object.keys(translations)) delete translations[k];
    Object.assign(translations, next);
}
```

Create `scripts/tests/vitest.config.js`:

```js
import { defineConfig } from "vitest/config";

export default defineConfig({
    test: {
        environment: "node",
        include: ["scripts/tests/**/*.test.js"],
        setupFiles: ["scripts/tests/setup/foundryI18nMock.js"]
    }
});
```

Note: `setupFiles` should call `installFoundryI18nMock()` — either export a side-effect file or add at top of each test. Prefer a tiny `scripts/tests/setup/install.js`:

```js
import { installFoundryI18nMock } from "./foundryI18nMock.js";
installFoundryI18nMock();
```

Point `setupFiles` at `install.js`.

Create `scripts/tests/i18n/I18n.test.js`:

```js
import { describe, it, expect, beforeEach } from "vitest";
import { localize, format } from "../../utils/I18n.js";
import { resetTranslations } from "../setup/foundryI18nMock.js";

describe("I18n", () => {
    beforeEach(() => {
        resetTranslations({
            "IONRIFT.LIBRARY.TEST.Hello": "Hello",
            "IONRIFT.LIBRARY.TEST.HelloName": "Hello, {name}"
        });
    });

    it("localizes known keys", () => {
        expect(localize("IONRIFT.LIBRARY.TEST.Hello")).toBe("Hello");
    });

    it("returns key when missing", () => {
        expect(localize("IONRIFT.LIBRARY.TEST.Missing")).toBe("IONRIFT.LIBRARY.TEST.Missing");
    });

    it("formats interpolations", () => {
        expect(format("IONRIFT.LIBRARY.TEST.HelloName", { name: "GM" })).toBe("Hello, GM");
    });
});
```

- [ ] **Step 2: Run test — expect FAIL (module missing)**

Run: `npm test -- scripts/tests/i18n/I18n.test.js`

Expected: FAIL — cannot resolve `../../utils/I18n.js` or Vitest config missing until created; after config exists, FAIL on missing `I18n.js`.

- [ ] **Step 3: Implement helper + empty lang files + module.json**

`scripts/utils/I18n.js`:

```js
/**
 * Thin Foundry i18n wrappers for Ionrift modules.
 * @param {string} key
 * @returns {string}
 */
export function localize(key) {
    if (typeof game === "undefined" || !game?.i18n?.localize) return key;
    return game.i18n.localize(key);
}

/**
 * @param {string} key
 * @param {Record<string, unknown>} [data]
 * @returns {string}
 */
export function format(key, data = {}) {
    if (typeof game === "undefined" || !game?.i18n?.format) return key;
    return game.i18n.format(key, data);
}
```

`lang/en.json` (starter keys used by later tasks — keep valid JSON):

```json
{
  "IONRIFT.LIBRARY.TEST.Hello": "Hello",
  "IONRIFT.LIBRARY.TEST.HelloName": "Hello, {name}"
}
```

`lang/ru.json`:

```json
{
  "IONRIFT.LIBRARY.TEST.Hello": "Здравствуйте",
  "IONRIFT.LIBRARY.TEST.HelloName": "Здравствуйте, {name}"
}
```

In `module.json`, add after `"styles"` (or at top level alongside other keys):

```json
"languages": [
  { "lang": "en", "name": "English", "path": "lang/en.json" },
  { "lang": "ru", "name": "Russian", "path": "lang/ru.json" }
]
```

In `createLibraryContext.js`, import and attach:

```js
import { localize, format } from "../utils/I18n.js";
// inside ctx:
localize,
format,
```

Ensure whatever assigns `game.ionrift` / library namespace also exposes `localize` and `format` (follow existing export pattern in the same file).

- [ ] **Step 4: Run tests — expect PASS**

Run: `npm test -- scripts/tests/i18n/I18n.test.js`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add module.json lang/en.json lang/ru.json scripts/utils/I18n.js scripts/composition/createLibraryContext.js scripts/tests
git commit -m "feat(i18n): add Foundry languages and Ionrift localize helper"
```

---

### Task 2: Localize base terrains

**Files:**
- Modify: `scripts/services/terrain/TerrainRegistry.js`
- Create: `scripts/tests/i18n/TerrainRegistry.i18n.test.js`
- Modify: `lang/en.json`
- Modify: `lang/ru.json`

**Interfaces:**
- Consumes: `localize` from `scripts/utils/I18n.js`
- Produces: `TerrainDefinition` still has `id`, `label`, `category`; base entries store `labelKey` and resolve `label` via `localize(labelKey)` in `_seed` / `register` / getters so consumers keep reading `.label`

- [ ] **Step 1: Write failing test for localized terrain labels**

```js
import { describe, it, expect, beforeEach } from "vitest";
import { TerrainRegistry } from "../../services/terrain/TerrainRegistry.js";
import { resetTranslations } from "../setup/foundryI18nMock.js";

describe("TerrainRegistry i18n", () => {
    beforeEach(() => {
        resetTranslations({
            "IONRIFT.LIBRARY.TERRAIN.Forest": "Лес",
            "IONRIFT.LIBRARY.TERRAIN.Swamp": "Болото",
            "IONRIFT.LIBRARY.TERRAIN.Desert": "Пустыня",
            "IONRIFT.LIBRARY.TERRAIN.Urban": "Город",
            "IONRIFT.LIBRARY.TERRAIN.Dungeon": "Подземелье"
        });
    });

    it("resolves base terrain labels through i18n", () => {
        const reg = new TerrainRegistry();
        const forest = reg.getBase().find((t) => t.id === "forest");
        expect(forest.label).toBe("Лес");
    });
});
```

- [ ] **Step 2: Run test — expect FAIL**

Run: `npm test -- scripts/tests/i18n/TerrainRegistry.i18n.test.js`

Expected: FAIL — labels still English `"Forest"`.

- [ ] **Step 3: Implement labelKey resolution**

In `TerrainRegistry.js`:

1. Import `localize` from `../../utils/I18n.js` (adjust relative path: from `services/terrain` → `../../utils/I18n.js`).
2. Change `BASE_TERRAINS` to:

```js
const BASE_TERRAINS = [
  { id: "forest",  labelKey: "IONRIFT.LIBRARY.TERRAIN.Forest",  category: "wilderness" },
  { id: "swamp",   labelKey: "IONRIFT.LIBRARY.TERRAIN.Swamp",   category: "wilderness" },
  { id: "desert",  labelKey: "IONRIFT.LIBRARY.TERRAIN.Desert",  category: "wilderness" },
  { id: "urban",   labelKey: "IONRIFT.LIBRARY.TERRAIN.Urban",   category: "built" },
  { id: "dungeon", labelKey: "IONRIFT.LIBRARY.TERRAIN.Dungeon", category: "built" }
];
```

3. Update `_seed` / `register` so stored definition sets:

```js
label: def.labelKey ? localize(def.labelKey) : def.label,
labelKey: def.labelKey ?? null,
```

Keep `register` requiring `id` and (`label` or `labelKey`).

4. Add lang keys (EN/RU) for the five terrains. Remove `IONRIFT.LIBRARY.TEST.*` from lang files once Task 1 tests no longer need them in production files — keep TEST keys only in the Vitest mock, not in shipped `lang/*.json` after Task 1 (delete TEST keys from `lang/en.json` / `ru.json` in this task).

- [ ] **Step 4: Run tests — expect PASS**

Run: `npm test -- scripts/tests/i18n/`

Expected: all PASS (I18n + TerrainRegistry).

- [ ] **Step 5: Commit**

```bash
git add scripts/services/terrain/TerrainRegistry.js scripts/tests/i18n/TerrainRegistry.i18n.test.js lang/en.json lang/ru.json
git commit -m "feat(i18n): localize TerrainRegistry base labels"
```

---

### Task 3: Localize SettingsLayout chrome

**Files:**
- Modify: `scripts/utils/SettingsLayout.js` (defaults for `registerHeader`, `registerPackButton`, `registerFooter`)
- Modify: `lang/en.json`
- Modify: `lang/ru.json`

**Interfaces:**
- Consumes: Foundry auto-localization of setting menu `name` / `label` / `hint` when values are keys
- Produces: default strings replaced with `IONRIFT.LIBRARY.SETTINGS.*` keys

- [ ] **Step 1: Add EN/RU keys for settings chrome**

Add to both lang files (EN shown; RU = natural Russian equivalents):

```json
"IONRIFT.LIBRARY.SETTINGS.AttunementName": "Attunement Protocol",
"IONRIFT.LIBRARY.SETTINGS.AttunementLabel": "Begin Attunement",
"IONRIFT.LIBRARY.SETTINGS.ContentPacksName": "Content Packs",
"IONRIFT.LIBRARY.SETTINGS.ContentPacksLabel": "Manage Packs",
"IONRIFT.LIBRARY.SETTINGS.SupportName": "Get Support",
"IONRIFT.LIBRARY.SETTINGS.SupportLabel": "Join Discord",
"IONRIFT.LIBRARY.SETTINGS.BugReportName": "Bug Report",
"IONRIFT.LIBRARY.SETTINGS.BugReportLabel": "Submit Report",
"IONRIFT.LIBRARY.SETTINGS.DiagnosticsName": "System Diagnostics",
"IONRIFT.LIBRARY.SETTINGS.DiagnosticsLabel": "Run Diagnostics",
"IONRIFT.LIBRARY.SETTINGS.WikiName": "Wiki / Guides",
"IONRIFT.LIBRARY.SETTINGS.WikiLabel": "Open Wiki"
```

Russian examples:

```json
"IONRIFT.LIBRARY.SETTINGS.AttunementName": "Протокол настройки",
"IONRIFT.LIBRARY.SETTINGS.AttunementLabel": "Начать настройку",
"IONRIFT.LIBRARY.SETTINGS.ContentPacksName": "Контент-паки",
"IONRIFT.LIBRARY.SETTINGS.ContentPacksLabel": "Управление паками",
"IONRIFT.LIBRARY.SETTINGS.SupportName": "Поддержка",
"IONRIFT.LIBRARY.SETTINGS.SupportLabel": "Discord",
"IONRIFT.LIBRARY.SETTINGS.BugReportName": "Сообщение об ошибке",
"IONRIFT.LIBRARY.SETTINGS.BugReportLabel": "Отправить отчёт",
"IONRIFT.LIBRARY.SETTINGS.DiagnosticsName": "Диагностика",
"IONRIFT.LIBRARY.SETTINGS.DiagnosticsLabel": "Запустить диагностику",
"IONRIFT.LIBRARY.SETTINGS.WikiName": "Вики / руководства",
"IONRIFT.LIBRARY.SETTINGS.WikiLabel": "Открыть вики"
```

- [ ] **Step 2: Replace hardcoded defaults in SettingsLayout.js**

In `registerHeader`:

```js
name:  options.name  || "IONRIFT.LIBRARY.SETTINGS.AttunementName",
label: options.label || "IONRIFT.LIBRARY.SETTINGS.AttunementLabel",
```

In `registerPackButton`:

```js
name:  options.name  || "IONRIFT.LIBRARY.SETTINGS.ContentPacksName",
label: options.label || "IONRIFT.LIBRARY.SETTINGS.ContentPacksLabel",
```

In `registerFooter` menus, replace `"Get Support"`, `"Join Discord"`, `"Bug Report"`, `"Submit Report"`, `"System Diagnostics"`, `"Run Diagnostics"`, `"Wiki / Guides"`, `"Open Wiki"` with the matching keys above.

Do **not** localize empty `hint: ""` fields.

- [ ] **Step 3: Manual verify in Foundry (checklist)**

1. Symlink or copy `ionrift-library` into `D:\VTT\Data\modules\ionrift-library` if not already the live folder.
2. Set Foundry language to Russian, reload.
3. Open Configure Settings → Ionrift Library.
4. Confirm footer/header menu names appear in Russian.
5. Switch language to English, reload — English labels return.

- [ ] **Step 4: Commit**

```bash
git add scripts/utils/SettingsLayout.js lang/en.json lang/ru.json
git commit -m "feat(i18n): localize SettingsLayout menu chrome"
```

---

### Task 4: Localize Library `main.js` settings + ModuleConfigProfiles dialogs

**Files:**
- Modify: `scripts/main.js` (visible `name`/`hint` on registered settings)
- Modify: `scripts/utils/ModuleConfigProfiles.js` (`Apply` / `Cancel` / notification text)
- Modify: `lang/en.json`
- Modify: `lang/ru.json`

**Interfaces:**
- Consumes: Foundry settings i18n keys; `localize`/`format` for DialogV2 button labels and notifications
- Produces: no new exports

- [ ] **Step 1: Add keys**

```json
"IONRIFT.LIBRARY.SETTINGS.DebugName": "Debug Mode",
"IONRIFT.LIBRARY.SETTINGS.DebugHint": "Enable verbose logging for library functions.",
"IONRIFT.LIBRARY.PROFILES.Apply": "Apply",
"IONRIFT.LIBRARY.PROFILES.Cancel": "Cancel",
"IONRIFT.LIBRARY.PROFILES.Applied": "{label}: {profile} setup applied."
```

RU:

```json
"IONRIFT.LIBRARY.SETTINGS.DebugName": "Режим отладки",
"IONRIFT.LIBRARY.SETTINGS.DebugHint": "Включить подробный журнал функций библиотеки.",
"IONRIFT.LIBRARY.PROFILES.Apply": "Применить",
"IONRIFT.LIBRARY.PROFILES.Cancel": "Отмена",
"IONRIFT.LIBRARY.PROFILES.Applied": "{label}: профиль «{profile}» применён."
```

- [ ] **Step 2: Wire main.js debug setting**

```js
game.settings.register(MODULE_ID, "debug", {
    name: "IONRIFT.LIBRARY.SETTINGS.DebugName",
    hint: "IONRIFT.LIBRARY.SETTINGS.DebugHint",
    scope: "client",
    config: false,
    type: Boolean,
    default: false
});
```

Scan `main.js` for any other `name:` / `hint:` string literals on `game.settings.register` / `registerMenu` and convert the same way (add keys as needed). Leave `config: false` settings without UI labels unchanged if they have no `name`.

- [ ] **Step 3: Wire ModuleConfigProfiles.js**

Import `localize` / `format` from `./I18n.js`.

Replace DialogV2 button labels:

```js
yes: { label: localize("IONRIFT.LIBRARY.PROFILES.Apply"), default: false },
no:  { label: localize("IONRIFT.LIBRARY.PROFILES.Cancel"), default: true }
```

Replace notification:

```js
ui.notifications?.info(format("IONRIFT.LIBRARY.PROFILES.Applied", {
    label,
    profile: profile.label
}));
```

If `profile.label` itself is still English from caller-supplied profile defs, leave as-is this task (callers localize later).

- [ ] **Step 4: Commit**

```bash
git add scripts/main.js scripts/utils/ModuleConfigProfiles.js lang/en.json lang/ru.json
git commit -m "feat(i18n): localize library settings and profile dialogs"
```

---

### Task 5: Localize BuffTypeRegistry labels

**Files:**
- Modify: `scripts/services/cooking/buffs/BuffTypeRegistry.js`
- Modify: `lang/en.json`
- Modify: `lang/ru.json`
- Create: `scripts/tests/i18n/BuffTypeRegistry.i18n.test.js`

**Interfaces:**
- Consumes: `localize`
- Produces: each buff type exposes localized `.label` via `labelKey` at registration/read time (same pattern as terrains)

- [ ] **Step 1: Write failing test**

Pick one known buff id (e.g. temporary HP). Assert that after constructing/looking up the registry entry with RU mock translations, `.label` is Russian.

- [ ] **Step 2: Run — expect FAIL**

- [ ] **Step 3: Add `labelKey` per buff type + EN/RU strings**

Keys: `IONRIFT.LIBRARY.BUFF.<Id>` matching existing buff ids (PascalCase or existing id uppercased — stay consistent with file’s id field). Examples:

```json
"IONRIFT.LIBRARY.BUFF.TempHP": "Temporary HP",
"IONRIFT.LIBRARY.BUFF.Healing": "Healing"
```

RU: `"Временные хиты"`, `"Лечение"`, etc. (align with `ru-ru` dnd5e where possible).

Resolve label with `localize(labelKey)` when the registry object is built or via a getter used by UI.

- [ ] **Step 4: Run tests — PASS**

- [ ] **Step 5: Commit**

```bash
git add scripts/services/cooking/buffs/BuffTypeRegistry.js scripts/tests/i18n/BuffTypeRegistry.i18n.test.js lang/en.json lang/ru.json
git commit -m "feat(i18n): localize cooking buff type labels"
```

---

### Task 6: Localize roll-request partial (player-facing)

**Files:**
- Modify: `templates/partials/_roll-request.hbs`
- Modify: `lang/en.json`
- Modify: `lang/ru.json`

**Interfaces:**
- Consumes: Handlebars `{{localize "KEY"}}` and `{{localize "KEY" hash}}` / `format` via Foundry helpers
- Produces: no JS API change; titles that come from callers remain caller-localized in later tasks

- [ ] **Step 1: Inventory hardcoded chrome in the partial**

Replace at minimum:
- `You passed` / `You failed` / `rolled` / `with`
- `You` pill
- Tooltip strings for pass/fail
- Any static button labels in the same file

Use keys under `IONRIFT.LIBRARY.ROLLREQUEST.*`, e.g.:

```json
"IONRIFT.LIBRARY.ROLLREQUEST.You": "You",
"IONRIFT.LIBRARY.ROLLREQUEST.Passed": "You passed",
"IONRIFT.LIBRARY.ROLLREQUEST.Failed": "You failed",
"IONRIFT.LIBRARY.ROLLREQUEST.PassedWith": "You passed with {total}",
"IONRIFT.LIBRARY.ROLLREQUEST.FailedWith": "You failed with {total}",
"IONRIFT.LIBRARY.ROLLREQUEST.TooltipPassed": "You passed",
"IONRIFT.LIBRARY.ROLLREQUEST.TooltipFailed": "You failed",
"IONRIFT.LIBRARY.ROLLREQUEST.TooltipRolled": "rolled {total}"
```

RU uses «вы» forms: «Вы», «Вы прошли», «Вы провалили», etc.

Leave `DC` as `DC` (universal) unless `ru-ru` uses a fixed abbreviation — then match it.

- [ ] **Step 2: Edit HBS to use localize/format helpers**

Example:

```hbs
<span class="ionrift-roll-participant__you-pill">{{localize "IONRIFT.LIBRARY.ROLLREQUEST.You"}}</span>
```

For strings with totals, prefer building the final string in the JS view model with `format(...)` if Handlebars format helper is awkward — either approach is fine; pick one and stay consistent inside this file.

- [ ] **Step 3: Manual Foundry check**

Trigger any roll-request UI from a dependent module or Library preview; confirm Russian chrome with language = `ru`.

- [ ] **Step 4: Commit**

```bash
git add templates/partials/_roll-request.hbs lang/en.json lang/ru.json
git commit -m "feat(i18n): localize roll-request partial chrome"
```

---

### Task 7: Localize remaining Library apps & templates

**Files (audit and convert user-visible strings):**
- `templates/abstract-welcome.hbs`
- `templates/apps/bug-report.hbs`
- `templates/apps/diagnostic-results.hbs`
- `templates/classifier-validator.hbs`
- `templates/creature-index-setup.hbs`
- `scripts/apps/diagnostics/*.js`
- `scripts/apps/packs/AbstractWelcomeApp.js`
- `scripts/apps/packs/AbstractPackRegistryApp.js`
- `scripts/apps/party/PartyRosterApp.js`
- `scripts/apps/rolls/StoryMomentApp.js`
- `scripts/apps/rolls/RollRequestPromptApp.js`
- `scripts/services/diagnostics/IntegrationStatus.js` (status labels)
- `lang/en.json` / `lang/ru.json`

**Interfaces:**
- Consumes: `localize` / `format` / `{{localize}}`
- Produces: all player/GM-visible Library UI strings keyed under `IONRIFT.LIBRARY.*`

- [ ] **Step 1: Extract strings**

For each file, replace hardcoded English user-facing text with keys. Skip:
- Logger / console-only messages
- Vendor code (`scripts/vendor/**`)
- Pure data tables that are not displayed (`dnd5eData.js` mechanical maps) unless a `label` is shown in UI — if shown, key it

- [ ] **Step 2: Fill `ru.json` in the same commit batch**

Every new `en.json` key must have a `ru.json` entry before commit.

- [ ] **Step 3: Smoke test in Foundry (Russian)**

Open: diagnostics, bug report, classifier validator, creature index setup, pack welcome/registry (if reachable), party roster. Confirm no raw keys and no leftover English chrome on those surfaces.

- [ ] **Step 4: Commit**

```bash
git add templates scripts/apps scripts/services/diagnostics lang/en.json lang/ru.json
git commit -m "feat(i18n): localize remaining Library apps and templates"
```

---

### Task 8: Phase 1 verification gate

**Files:**
- None required (optional: add `scripts/dev/checkI18nKeys.mjs` that greps `IONRIFT.LIBRARY.` in `scripts/` + `templates/` and asserts each key exists in `lang/en.json`)

- [ ] **Step 1: Run unit tests**

Run: `npm test`

Expected: PASS

- [ ] **Step 2: Key parity check**

PowerShell:

```powershell
$en = Get-Content lang/en.json -Raw -Encoding UTF8 | ConvertFrom-Json
$ru = Get-Content lang/ru.json -Raw -Encoding UTF8 | ConvertFrom-Json
$enKeys = $en.PSObject.Properties.Name | Sort-Object
$ruKeys = $ru.PSObject.Properties.Name | Sort-Object
Compare-Object $enKeys $ruKeys
```

Expected: no differences.

- [ ] **Step 3: Foundry regression**

1. Language English → Library UI English (matches former copy).
2. Language Russian → Library UI Russian.
3. Console: no errors from missing `game.i18n` or bad JSON in lang files.

- [ ] **Step 4: Update design checklist**

In `docs/superpowers/specs/2026-08-07-russian-localization-design.md`, mark Phase 1 checkboxes complete.

- [ ] **Step 5: Commit**

```bash
git add docs/superpowers/specs/2026-08-07-russian-localization-design.md
git commit -m "docs: mark Library i18n phase 1 complete"
```

---

## Self-review (plan vs spec)

| Spec requirement | Task |
|---|---|
| `en.json` + `ru.json` + `module.json` languages | Task 1 |
| Shared localize helper | Task 1 |
| Terrains via labelKey / localize | Task 2 |
| Settings / UI chrome | Tasks 3–4, 7 |
| Runtime data labels pattern | Task 2 (+ BuffType Task 5) |
| EN↔RU switch / EN fallback | Tasks 1, 8 |
| Babele | Deferred to Phase 2/3 plans (Library has no packs) |
| Formal «вы» | Tasks 3–7 RU copy |
| Test via `D:\VTT\Data\modules` | Tasks 3, 6, 8 |
| Out of scope README/wiki | Honored |

No TBD placeholders. Helper signatures (`localize`, `format`) consistent across tasks.
