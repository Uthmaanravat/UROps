# Fable 37 Prospect Seed File

`fable37-prospects.json` is the versioned master copy of the 37 core prospects — your moat. Keep it committed to git so it is backed up and version-controlled.

## How it works

- On every load of the Drone Operations page, the app checks which seed `id`s are missing from the database for your company and inserts only those (source: `fable_37`).
- Already-imported prospects are **never overwritten** — your statuses, notes, and contact logs are safe.
- Fable-37 prospects cannot be deleted from the UI; new discoveries can.

## Adding or amending prospects

All 37 core prospects are in the file. To add future entries, append to the `fable_37_prospects` array using the same shape:

```json
{
  "id": "unique-kebab-case-id",
  "name": "Building Name",
  "location": "Suburb/Area",
  "owners_entity": "Property Company",
  "property_manager_name": null,
  "property_manager_email": null,
  "property_manager_phone": null,
  "receptionist_email": null,
  "company_main_phone": null,
  "category": "Water Facing | No Gondola | Heritage | Rooftop Solar | Multiplier | Niche",
  "access_moat": "Why rope/scaffold fails for this building",
  "why_drones_matter": "2-3 sentence pitch specific to this property",
  "estimated_value": "low | medium | high | strategic_multiplier",
  "notes": ""
}
```

Save the file and reload the drone dashboard — the new entries import automatically.

## Fixing a seed entry after import

Editing this file does not update prospects already in the database (by design, so it never clobbers your tracking data). To correct contact details after import, edit the prospect in the UI instead.
