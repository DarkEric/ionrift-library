# Include GM-owned Primary Party Members — Design

**Date:** 2026-08-08  
**Status:** Approved  
**Modules:** `ionrift-library` (canonical), `ionrift-respite` (UI)

## Goal

On Foundry v14+ dnd5e, optionally include GM-owned characters from the Primary Party in Ionrift party roster consumers (Respite, Quartermaster, etc.).

## Setting

| Key | Module | Default |
|---|---|---|
| `includeGmOwnedPartyMembers` | `ionrift-library` | `false` |

- World, GM-restricted  
- `config: true` only when Foundry generation ≥ 14; otherwise registered with `config: false` (unavailable)  
- Off → `playerCharacters` only (legacy)  
- On → all character-type members of Primary Party (`system.members`)

## UI

- Library Configure Settings: native checkbox (v14+)  
- Respite → Player Restrictions: same toggle (reads/writes library setting; hidden on &lt;14)

## Code

- `DnD5eAdapter.getNativePartyMembers` respects the setting  
- `PartyRoster.getSetupState` empty/warning checks use the same membership set  
- Setting `onChange` fires `ionrift.partyChanged`
