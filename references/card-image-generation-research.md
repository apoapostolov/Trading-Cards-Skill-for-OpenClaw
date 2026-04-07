# Card Image Generation Research

This note captures the visual research used to design the modular card-image prompt system.

## What the source material establishes

- Topps Chrome cards use chromium stock and are explicitly described as shiny, metallic, and more durable than paper cards.
- Topps Ripped defines refractors as light-refracting parallels with prism or rainbow-like shine.
- Topps Ripped defines `True Refractor` as the standard refractor treatment that mirrors the base layout while changing the finish.
- Topps Ripped describes `Chrome Sapphire` as a premium treatment with blue highlights and sapphire refractor foil boards.
- Topps Ripped notes that numbered cards can show the serial either on the front or the back.
- Topps Ripped distinguishes `On-Card Auto` from `Sticker Auto`.
- Topps Ripped defines `Slabbing` as grading and notes that slabbed cards are graded cards.
- Topps Ripped defines `Standard Card Size` as 2.5 by 3.5 inches.
- Cardboard Connection’s 2024-25 Prizm review lists the main Prizm rainbow families: Silver, Hyper, Red, Blue, Purple Ice, Orange, Mojo, Gold, Gold Vinyl, Black, plus retail/fanatics/h2 exclusives.
- The same Prizm review also highlights Fireworks-style holofoil inserts and gold-on-dark premium autograph treatments.

## Design inferences used by the builder

- Chrome-family parallels should feel like mirrored metal with rainbow bloom, not flat silver.
- Prizm-family parallels should feel patterned and energetic, with visible foil geometry.
- Dark parallels should lean into black-stock depth, prismatic shard breaks, or void-like surfaces.
- Sapphire should read as premium blue gemstone chrome, not merely a blue tint.
- Numbering should be a deliberate visual element, either etched into the card in a credit-card style font or presented as a security sticker / foil stamp.
- Graded cards should be rendered inside a clear magnetic slab case, while raw cards should remain unencased.
- Standard portrait cards should use a centered hero subject, lower-third title zone, and small identifier rail.
- Landscape, booklet, die-cut, oversized, and acetate cards need distinct layout treatments rather than the same portrait framing copied across formats.

## Prompt module mapping

- `general`:
  - High-level render instruction for the image model.
- `card base`:
  - Card ratio, title zone, identifier rail, and basic frame language.
- `card variant`:
  - Foil family and surface treatment for the parallel.
- `card type`:
  - Autograph, relic, booklet, variation, or novelty-specific layout behavior.
- `physical properties`:
  - Stock, thickness, edge treatment, slab state, and tactile finish.
- `card condition`:
  - Graded vs raw presentation, including the magnetic case rule for graded cards.
- `card serialization`:
  - Etched serial, hologram sticker, foil stamp, or printing plate treatment.
- `card image`:
  - The actual subject art prompt, front or back.

## Source links

- [Topps Ripped - Chrome / Sapphire / refractor / auto / slab terminology](https://ripped.topps.com/definition/retrofractor/)
- [Topps Ripped PDF snippet showing numbered cards and refractor terminology](https://ripped.topps.com/wp-content/uploads/2025/11/Topps25_MVP-Buyback-MLB_Mail-In-Form_Rd3.pdf)
- [Topps Ripped PDF snippet showing Topps Chrome gold etch autograph terminology](https://ripped.topps.com/wp-content/uploads/2023/04/REDEMPTION-REPORT-4-7-23.pdf)
- [Cardboard Connection - 2024-25 Panini Prizm NBA review](https://www.cardboardconnection.com/2024-25-panini-prizm-nba-set-review-and-checklist)
- [PSA autograph encapsulation submission agreement](https://resources.psacard.com/PSADNA-Autograph-Encapsulation-Submission-Form.pdf)

## Implementation note

The repo already stores card-level fields like `parallel`, `sn`, `serStr`, `plate`, `cardTypeName`, `graded`, `grade`, and `quality.hints` in the collection JSON. The new prompt builder uses those fields as inputs instead of re-deriving them from scratch.
