# Pragna UI Design Reference

Use the names in this document when describing changes — no need to specify hex values.

---

## Backgrounds

| Name | Hex | Used for |
|---|---|---|
| **Page background** | `#282828` | Body, page canvas, tile background, sidebar background |
| **Card surface** | `#212121` | Modals, login card, elevated panels |
| **Input surface** | `rgba(255,255,255,0.07)` | Text input fields, password inputs, textareas — translucent white tint so the input reads as slightly raised on any dark surface without a harsh fixed colour |

---

## Brand

| Name | Hex | Used for |
|---|---|---|
| **Copper** | `#c97040` | Primary buttons, active nav items, focus rings, highlights |
| **Copper hover** | `#b5633a` | Hover state on copper elements |
| **Copper tint** | `rgba(201,112,64,0.12)` | Active nav item background, subtle highlights |
| **Copper ring** | `rgba(201,112,64,0.35)` | Focus rings |

---

## Text

| Name | Hex | Used for |
|---|---|---|
| **Primary text** | `#ececea` | Headings, body text, input values |
| **Muted text** | `#737373` | Subtitles, descriptions, helper text |
| **Placeholder text** | `rgba(255,255,255,0.3)` | Input placeholders |
| **White** | `#ffffff` | Nav items, sidebar items |
| **White dim** | `rgba(255,255,255,0.7)` | Inactive nav items |
| **Section label** | `rgba(255,255,255,0.4)` | Sidebar section headers |

---

## Borders

| Name | Value | Used for |
|---|---|---|
| **Subtle border** | `rgba(255,255,255,0.07)` | Sidebar right edge, dividers between sections |
| **Input border** | `rgba(255,255,255,0.12)` | Text input borders at rest |
| **Card border** | `rgba(255,255,255,0.09)` | Modal/card borders |
| **Input border focus** | `#c97040` (Copper) | Input border on focus |

---

## Status

| Name | Hex | Used for |
|---|---|---|
| **Connected green** | `#22c55e` | Connected provider badge background |
| **Connected green border** | `rgba(34,197,94,0.4)` | Connected tile border |
| **Error red** | `#ef4444` | Not-connected badge, error text, danger borders |
| **Error red border** | `rgba(239,68,68,0.4)` | Not-connected tile border |
| **Error surface** | `#1f0d0d` | Error alert background |

---

## Components

| Component | Background | Border | Text |
|---|---|---|---|
| Page | Page background | — | Primary text |
| Sidebar | Page background | Subtle border (right) | White |
| Card / Modal | Card surface | Card border | Primary text |
| Input / Textarea | Input surface | Input border → Copper on focus | Primary text |
| Provider tile | Page background | Green/Red border → Copper on hover | Primary text |
| Button (primary) | Copper | — | White |
| Badge (connected) | Connected green | — | Black |
| Badge (not connected) | Error red | — | White |

---

## Typography

| Property | Value |
|---|---|
| Font family | `-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif` |
| Base size | `14px` |
| Heading weight | `700` (bold) |
| Body weight | `400–500` |

---

## Spacing & Shape

| Name | Value | Used for |
|---|---|---|
| **Input radius** | `8px` | All input fields |
| **Tile radius** | `16px` | Provider tiles |
| **Modal radius** | `18px` | Dialogs, login card |
| **Button radius** | `8px` | All buttons |
| **Logo radius** | `10px` | Provider logo boxes |
| **Input padding** | `10px 13px` | All text inputs |
