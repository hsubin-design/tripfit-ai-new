# TripFit AI — Design Guidelines v0.7

## Product Personality

TripFit은 AI 자체를 강조하는 서비스가 아니라,
서로 다른 형식의 두 여행 일정을 같은 기준으로 정리해
사용자가 차이를 이해하고 직접 결정할 수 있도록 돕는 여행 비교 도구다.

Design keywords:
- Calm
- Clear
- Trustworthy
- Warm
- Structured
- Travel-friendly

Avoid:
- Futuristic AI aesthetics
- Neon purple/blue gradients
- Glow effects
- Excessive glassmorphism
- Strong shadows
- Visual language implying that AI recommends a winner

## Visual Direction

- Lovable-inspired structural simplicity
- Kraken-inspired restrained purple interaction color
- Airbnb-inspired friendliness and soft shapes
- Apple-inspired hierarchy and restraint

특정 브랜드를 그대로 복제하지 말고 디자인 원칙만 참고한다.

## Color System — Test Palette A: Soft Indigo

Primary: #6757C8
Primary Hover: #5647B7
Primary Soft: #F1EEFB

Background: #FAFAF8
Surface: #FFFFFF
Subtle Surface: #F7F6F9

Text Primary: #202124
Text Secondary: #68666D
Text Muted: #929097

Border: #E7E5EA
Border Strong: #CBC8D1

Error: #C73B4A
Success: #32805F

Purple is used only for:
- Primary CTA
- Selected state
- Focus state
- Active controls
- Small brand accents

Purple must never indicate:
- Which itinerary is better
- AI recommendation
- Winner or preferred plan

Plan A and Plan B must have equal visual weight.

## Typography

font-family:
system-ui, -apple-system, BlinkMacSystemFont, "Pretendard", sans-serif

Page Title:
- Desktop 36px / 600
- Mobile 28px / 600

Section Title:
24px / 600

Card Title:
18px / 600

Body:
16px / 400
line-height 1.55

Caption:
14px / 400

Do not rely on excessive bold weight.
Use size, spacing and contrast for hierarchy.

## Spacing

Base: 8px

Scale:
4 / 8 / 12 / 16 / 24 / 32 / 48 / 64

Mobile horizontal padding:
20–24px

Desktop max content width:
960–1040px

## Radius

Button: 10px
Input / Textarea: 10px
Card: 12px
Large Container: 16px
Chip: full pill

Do not make rectangular buttons full-pill.

## Borders & Elevation

Default:
1px solid #E7E5EA

Cards should primarily use borders instead of shadows.

Avoid:
- heavy drop shadows
- floating SaaS cards
- glass effects

## Button

Primary:
- #6757C8 background
- white text
- minimum height 48px
- radius 10px

Secondary:
- white background
- #202124 text
- #CBC8D1 border

Disabled:
- #ECEAF0 background
- #AAA7B0 text

Back navigation should stay visually quieter than primary CTA.

## Inputs

Background: white
Border: #E7E5EA
Focus: #6757C8
Placeholder: #929097

## Choice Chips

Unselected:
- white
- neutral border

Selected:
- #F1EEFB background
- #6757C8 border/text

Avoid strong filled purple unless necessary.

## Comparison Result

Comparison information itself must remain neutral.

Never:
- visually favor Plan A or Plan B
- use purple as a recommendation signal
- display winner badges
- use success green on one itinerary

Information hierarchy:
1. Key difference summary
2. Fixed comparison criteria
3. Plan A / Plan B details
4. Original text accordion
5. Decision CTA

## Responsive

Mobile-first.

Mobile:
- single column
- 44–48px minimum touch target
- A/B cards stacked

Desktop:
- side-by-side comparison when space permits
- A/B must remain visually equivalent

## Interaction

The product should feel like:
"여행 계획을 차분하게 정리해주는 도구"

Not:
"AI가 답을 알려주는 서비스"

Do not use:
- magic sparkle overload
- robot iconography
- AI gradients
- glowing borders
- "AI recommends" visual language
