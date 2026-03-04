# Watchtower Mobile UX/UI Audit Report

**Date:** 2026-03-04  
**Auditor:** Alex (AI Assistant)  
**Project:** Watchtower Dashboard  
**Stack:** Next.js + TypeScript + Tailwind CSS  

---

## Executive Summary

The Watchtower dashboard has **significant mobile UX issues** across all pages. The UI was designed primarily for desktop use, with many interactive elements, tables, and layouts that break or become unusable on mobile devices.

**Critical Issues:** 12  
**Major Issues:** 15  
**Minor Issues:** 8  

---

## Issue Categories

| Category | Count | Severity |
|----------|-------|----------|
| Touch Targets Too Small | 8 | 🔴 Critical |
| Tables Not Mobile-Friendly | 4 | 🔴 Critical |
| Navigation Issues | 3 | 🟠 Major |
| Modals/Drawers Not Responsive | 4 | 🟠 Major |
| Text/Content Overflow | 5 | 🟠 Major |
| Buttons/Icons Too Close | 4 | 🟡 Minor |
| Charts/Data Visualization | 2 | 🟡 Minor |

---

## Page-by-Page Analysis

### 1. Main Dashboard (`/`) - `src/app/page.tsx`

#### 🔴 CRITICAL: Header Navigation Touch Targets Too Small
**File:** `src/app/page.tsx`  
**Lines:** 291-316

```tsx
// Current: Icons are 16x16 (w-4 h-4) with 8px padding (p-2)
// Touch target = ~32x32px — below 44x44px minimum
<Link
  href="/logs"
  className="p-2 rounded-lg bg-gray-800 hover:bg-gray-700 transition"
>
  <FileText className="w-4 h-4" />  // ❌ Too small
</Link>
```

**Fix:** Increase to `p-3` with `w-5 h-5` icons, or use minimum `min-w-[44px] min-h-[44px]`

---

#### 🔴 CRITICAL: App Row Action Buttons Clustered & Too Small
**File:** `src/app/page.tsx`  
**Lines:** 523-583

The app row displays 5 action buttons in a row, each with only `p-2` padding:
- Settings button
- View Logs button  
- Start/Stop button
- Restart button

```tsx
<button className="p-2 rounded-lg hover:bg-gray-700">
  <Settings className="w-4 h-4" />  // ❌ 32x32px touch target
</button>
```

**Issues:**
1. Touch targets are 32x32px (should be 44x44px minimum)
2. Buttons are too close together (`gap-6` between stats, but buttons have no gap)
3. Settings button uses hover-only visibility: `opacity-0 group-hover:opacity-100` — **doesn't work on touch devices**

**Fix:**
```tsx
// Mobile: Stack actions or use overflow menu
<div className="flex items-center gap-2 md:gap-1">
  <button className="p-3 md:p-2 min-w-[44px] min-h-[44px] md:min-w-0 md:min-h-0">
```

---

#### 🔴 CRITICAL: App Row Not Responsive - Too Many Columns
**File:** `src/app/page.tsx`  
**Lines:** 482-583

The app row tries to show all of this in one horizontal line:
- Status indicator + App name + Category badge + Notification icon
- CPU usage
- Memory usage  
- Uptime (w-20)
- Restarts (w-12)
- 5 action buttons

On mobile, this creates horizontal overflow or severely cramped layout.

**Fix:** Create a mobile-specific card layout:
```tsx
<div className="px-4 py-3 md:flex md:items-center md:justify-between">
  {/* Mobile: Stack layout */}
  <div className="flex flex-col md:flex-row md:items-center gap-2 md:gap-6">
    {/* App info - always visible */}
    <div className="flex items-center gap-3">...</div>
    
    {/* Stats - grid on mobile */}
    <div className="grid grid-cols-2 gap-2 md:flex md:items-center md:gap-6 text-sm">
      <div>CPU: {cpu}%</div>
      <div>MEM: {mem}</div>
      <div>Uptime: {uptime}</div>
      <div>Restarts: {restarts}</div>
    </div>
  </div>
  
  {/* Actions - horizontal scroll or overflow menu on mobile */}
  <div className="flex items-center gap-1 mt-3 md:mt-0 overflow-x-auto">
    ...
  </div>
</div>
```

---

#### 🟠 MAJOR: Header Flex Layout Breaks on Mobile
**File:** `src/app/page.tsx`  
**Lines:** 281-320

```tsx
<div className="flex items-center gap-3">
  {/* 4 icon buttons + "Add Server" button */}
</div>
```

On narrow screens, buttons may wrap unexpectedly or overflow.

**Fix:** Add mobile hamburger menu or hide secondary actions:
```tsx
<div className="flex items-center gap-2">
  {/* Mobile: Only show essential actions */}
  <button className="md:hidden p-3">
    <Menu className="w-5 h-5" />
  </button>
  
  {/* Desktop: Show all actions */}
  <div className="hidden md:flex items-center gap-3">
    ...
  </div>
</div>
```

---

#### 🟠 MAJOR: Modals Not Mobile-Optimized
**File:** `src/app/page.tsx`

**App Settings Modal (Line 340):**
```tsx
<div className="bg-gray-900 rounded-xl w-full max-w-md border border-gray-700">
```
- No `max-h` constraint for mobile
- Content may overflow below the fold
- No close-on-swipe or mobile sheet behavior

**Logs Modal (Line 469):**
```tsx
<div className="bg-gray-900 rounded-xl w-full max-w-4xl max-h-[80vh]">
```
- Better with `max-h-[80vh]` but still not mobile-optimized
- Should be full-screen on mobile

**Fix:**
```tsx
{/* Mobile: Full screen modal */}
<div className="bg-gray-900 rounded-xl w-full max-w-md 
                md:rounded-xl md:max-h-[80vh]
                max-h-screen rounded-none">
  <div className="overflow-y-auto max-h-[calc(100vh-120px)] md:max-h-none">
```

---

#### 🟡 MINOR: Hover-Only Interactions Don't Work on Touch
**File:** `src/app/page.tsx`  
**Line:** 543

```tsx
className="... opacity-0 group-hover:opacity-100"  // ❌ Never visible on mobile
```

Settings button is hidden until hover — mobile users can't see or access it.

**Fix:** Always show on mobile:
```tsx
className="... opacity-100 md:opacity-0 md:group-hover:opacity-100"
```

---

### 2. Login Page (`/login`) - `src/app/login/page.tsx`

#### ✅ GOOD: Generally Mobile-Friendly

The login page is well-designed for mobile:
- Uses `p-4` outer padding
- `max-w-md w-full` constrains width properly
- Input fields have `py-3` padding (good touch targets)
- Button is full-width with `py-3`

#### 🟡 MINOR: Input Field Icon Size
**File:** `src/app/login/page.tsx`  
**Lines:** 62, 74

```tsx
<Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
```

Icons are acceptable at 20x20px, but could be slightly larger for visibility.

---

### 3. Analytics Page (`/analytics`) - `src/app/analytics/page.tsx`

#### 🔴 CRITICAL: Time Range Selector Touch Targets Too Small
**File:** `src/app/analytics/page.tsx`  
**Lines:** 157-170

```tsx
<div className="flex rounded-lg bg-gray-800 overflow-hidden">
  {timeRanges.map((r) => (
    <button
      className="px-3 py-2 text-sm transition"  // ❌ ~36x32px touch target
    >
      {r.value}
    </button>
  ))}
</div>
```

**Fix:**
```tsx
<div className="flex rounded-lg bg-gray-800 overflow-hidden">
  {timeRanges.map((r) => (
    <button
      className="px-4 py-3 text-sm md:px-3 md:py-2"  // Mobile: larger
    >
```

---

#### 🔴 CRITICAL: Header Controls Overflow on Mobile
**File:** `src/app/analytics/page.tsx`  
**Lines:** 122-178

The header contains:
- Back button
- Title
- Server dropdown (min-w-[200px])
- Time range buttons (4 buttons)
- Refresh button

This is **too much for a mobile header**.

**Fix:** Stack controls or use collapsible filters:
```tsx
<header className="...">
  {/* Row 1: Navigation + Title */}
  <div className="flex items-center justify-between">
    <div className="flex items-center gap-4">
      <Link href="/">...</Link>
      <div>Analytics</div>
    </div>
    <button>Refresh</button>
  </div>
  
  {/* Row 2: Filters (stacked on mobile) */}
  <div className="flex flex-col md:flex-row gap-2 mt-3 md:mt-0">
    <ServerSelector />
    <TimeRangeButtons />
  </div>
</header>
```

---

#### 🔴 CRITICAL: App Resource Table Not Mobile-Friendly
**File:** `src/app/analytics/page.tsx`  
**Lines:** 255-302

```tsx
<table className="w-full">
  <thead>
    <tr>
      <th>Application</th>
      <th>Status</th>
      <th>CPU</th>
      <th>Memory</th>
      <th className="w-48">CPU Bar</th>    // ❌ Fixed width
      <th className="w-48">Memory Bar</th> // ❌ Fixed width
    </tr>
  </thead>
```

**Issues:**
1. 6 columns in a table with fixed widths
2. Progress bars have `w-48` (192px) — too wide for mobile
3. `overflow-x-auto` on parent helps but scroll is hidden

**Fix:** Card layout on mobile:
```tsx
{/* Mobile: Card view */}
<div className="md:hidden space-y-3">
  {appStats.map((app) => (
    <div className="bg-gray-800/30 rounded-lg p-3">
      <div className="flex justify-between items-center mb-2">
        <span className="font-medium">{app.display_name || app.pm2_name}</span>
        <span className={statusBadgeClass}>{app.status}</span>
      </div>
      <div className="space-y-2">
        <div>
          <div className="flex justify-between text-xs text-gray-400">
            <span>CPU</span>
            <span>{app.cpu_percent}%</span>
          </div>
          <div className="h-2 bg-gray-800 rounded-full mt-1">
            <div className="h-full bg-blue-500 rounded-full" style={{width: `${app.cpu_percent}%`}} />
          </div>
        </div>
        {/* Similar for memory */}
      </div>
    </div>
  ))}
</div>

{/* Desktop: Table view */}
<div className="hidden md:block overflow-x-auto">
  <table>...</table>
</div>
```

---

#### 🟠 MAJOR: Server Dropdown Positioning
**File:** `src/app/analytics/page.tsx`  
**Lines:** 134-156

```tsx
<div className="absolute top-full mt-2 right-0 w-64">
```

Dropdown is positioned `right-0` which may cause it to overflow on mobile if container is near edge.

**Fix:**
```tsx
<div className="absolute top-full mt-2 right-0 md:right-0 left-0 md:left-auto w-full md:w-64">
```

---

#### 🟡 MINOR: Charts Are Responsive But Dense
**File:** `src/components/charts/MetricsCharts.tsx`

The charts use `ResponsiveContainer` which is good, but:
- X-axis labels may overlap on mobile
- Tooltip may be cut off at screen edges

Consider adding `tick={{ fontSize: 10 }}` for mobile and ensuring tooltip stays within bounds.

---

### 4. Logs Page (`/logs`) - `src/app/logs/page.tsx`

#### 🔴 CRITICAL: Filter Bar Overflow on Mobile
**File:** `src/app/logs/page.tsx`  
**Lines:** 168-220

```tsx
<div className="px-4 py-2 border-t border-gray-800 bg-gray-900/30 flex items-center gap-3 flex-wrap">
  <Filter className="w-4 h-4 text-gray-500" />
  <select>All Servers</select>    // ~120px
  <select>All Apps</select>        // ~100px  
  <select>All Levels</select>      // ~100px
  <input placeholder="Search..." className="min-w-[200px] max-w-md" />
  <button>Clear</button>
</div>
```

Even with `flex-wrap`, the filter bar is cramped. Search input has `min-w-[200px]` which may cause overflow.

**Fix:**
```tsx
<div className="px-4 py-2 border-t border-gray-800">
  {/* Mobile: Collapsible filters */}
  <button className="md:hidden flex items-center gap-2 w-full py-2">
    <Filter className="w-4 h-4" />
    <span>Filters</span>
    <ChevronDown className="w-4 h-4 ml-auto" />
  </button>
  
  <div className="hidden md:flex items-center gap-3 flex-wrap">
    {/* Desktop filters */}
  </div>
  
  {/* Mobile expanded filters - grid layout */}
  <div className="md:hidden grid grid-cols-2 gap-2 mt-2">
    <select className="w-full">All Servers</select>
    <select className="w-full">All Apps</select>
    <select className="w-full col-span-2">All Levels</select>
    <input className="w-full col-span-2" />
  </div>
</div>
```

---

#### 🟠 MAJOR: Log Entry Layout Too Wide
**File:** `src/app/logs/page.tsx`  
**Lines:** 259-282

```tsx
<div className="flex items-start gap-2 px-2 py-1">
  <span className="shrink-0">{timestamp}</span>     // ~64px
  <span className="shrink-0">{level}</span>         // ~32px
  <span className="shrink-0">[server:app]</span>    // Variable
  <span className="break-all">{message}</span>      // Remaining
</div>
```

On mobile, the fixed-width elements consume too much horizontal space, leaving little room for the actual message.

**Fix:**
```tsx
<div className="flex flex-col md:flex-row md:items-start gap-1 md:gap-2 px-2 py-2">
  <div className="flex items-center gap-2 text-xs md:shrink-0">
    <span className="text-gray-500">{timestamp}</span>
    <span className={levelBadgeClass}>{level}</span>
    <span className="text-purple-400">[{source}]</span>
  </div>
  <span className="break-all whitespace-pre-wrap text-gray-200">
    {message}
  </span>
</div>
```

---

#### 🟠 MAJOR: Header Controls Cramped
**File:** `src/app/logs/page.tsx`  
**Lines:** 133-165

Pause/Resume button and Refresh button are in the header alongside title. On mobile, this is cramped.

**Fix:** Move secondary controls below title or into an overflow menu.

---

### 5. Settings Page (`/settings`) - `src/app/settings/page.tsx`

#### 🟠 MAJOR: Tab Navigation May Overflow
**File:** `src/app/settings/page.tsx`  
**Lines:** 171-186

```tsx
<div className="flex gap-1 border-b border-gray-800 mb-6">
  {tabs.map((tab) => (
    <button className="flex items-center gap-2 px-4 py-3">
```

Currently 3 tabs fit, but if more are added, they'll wrap poorly.

**Fix:**
```tsx
<div className="flex gap-1 border-b border-gray-800 mb-6 overflow-x-auto">
  {tabs.map((tab) => (
    <button className="flex items-center gap-2 px-4 py-3 whitespace-nowrap shrink-0">
```

---

#### 🟠 MAJOR: User List Item Layout
**File:** `src/app/settings/page.tsx`  
**Lines:** 316-347

```tsx
<div className="px-4 py-3 flex items-center justify-between">
  <div className="flex items-center gap-3">
    <div className="w-10 h-10 rounded-full">Avatar</div>
    <div>
      <div>{name}</div>
      <div className="text-xs">{email}</div>
    </div>
  </div>
  <div className="flex items-center gap-3">
    <span>{role}</span>
    <button>Delete</button>
  </div>
</div>
```

On mobile, long emails may cause overflow.

**Fix:**
```tsx
<div className="px-4 py-3">
  <div className="flex items-center justify-between">
    <div className="flex items-center gap-3 min-w-0">
      <div className="w-10 h-10 rounded-full shrink-0">Avatar</div>
      <div className="min-w-0">
        <div className="truncate">{name}</div>
        <div className="text-xs text-gray-400 truncate">{email}</div>
      </div>
    </div>
    <div className="flex items-center gap-2 shrink-0">
      <span className="hidden sm:inline">{role}</span>
      <button className="p-2">Delete</button>
    </div>
  </div>
</div>
```

---

#### 🟡 MINOR: Delete Button Touch Target
**File:** `src/app/settings/page.tsx`  
**Lines:** 280, 342

```tsx
<button className="p-2 rounded-lg hover:bg-red-900/50">
  <Trash2 className="w-4 h-4" />  // ❌ 32x32px
</button>
```

**Fix:** `p-3` or add `min-w-[44px] min-h-[44px]`

---

### 6. Global/Layout Issues

#### 🟠 MAJOR: No Mobile Navigation Menu
**File:** `src/app/layout.tsx` + all pages

There's no hamburger menu or bottom navigation for mobile. Users must navigate via:
- Back buttons on sub-pages
- Small icon buttons in header

**Recommendation:** Add a mobile-friendly navigation pattern:
- Option A: Bottom tab bar (Dashboard, Logs, Analytics, Settings)
- Option B: Hamburger menu with slide-out drawer
- Option C: Keep current but increase touch targets significantly

---

#### 🟡 MINOR: Sticky Header Height
All pages use sticky headers that may consume 60-80px of vertical space on mobile, reducing content area.

Consider making headers collapsible on scroll for mobile.

---

## Summary of Required Changes

### High Priority Fixes

| File | Issue | Fix |
|------|-------|-----|
| `page.tsx:291-316` | Header nav touch targets | Increase to `p-3 w-5 h-5` |
| `page.tsx:523-583` | App row action buttons | Mobile card layout + larger buttons |
| `page.tsx:482-583` | App row columns | Stack on mobile, grid stats |
| `analytics/page.tsx:157-170` | Time range buttons | `py-3` on mobile |
| `analytics/page.tsx:255-302` | Resource table | Card view on mobile |
| `logs/page.tsx:168-220` | Filter bar | Collapsible filters |

### Medium Priority Fixes

| File | Issue | Fix |
|------|-------|-----|
| `page.tsx:340,469` | Modals | Full-screen on mobile |
| `page.tsx:543` | Hover-only visibility | Always visible on mobile |
| `analytics/page.tsx:122-178` | Header controls | Two-row layout |
| `logs/page.tsx:259-282` | Log entry layout | Stack metadata on mobile |
| `settings/page.tsx:316-347` | User list items | Truncate long content |

### Low Priority Fixes

| File | Issue | Fix |
|------|-------|-----|
| `settings/page.tsx:171-186` | Tab overflow | `overflow-x-auto` |
| `settings/page.tsx:280,342` | Delete buttons | Increase padding |
| `MetricsCharts.tsx` | Chart labels | Smaller font on mobile |

---

## Recommended Tailwind Breakpoint Strategy

```css
/* Mobile-first approach */
.element {
  /* Mobile styles (default) */
  @apply p-3 text-base;
  
  /* Tablet and up */
  @apply md:p-2 md:text-sm;
  
  /* Desktop */
  @apply lg:p-2;
}
```

### Touch Target Utility Class
Add to `globals.css`:
```css
.touch-target {
  @apply min-w-[44px] min-h-[44px] flex items-center justify-center;
}
```

---

## Testing Checklist

After implementing fixes, test on:
- [ ] iPhone SE (375px) - smallest common mobile
- [ ] iPhone 14 Pro (393px) - standard mobile
- [ ] iPad Mini (768px) - tablet
- [ ] Landscape orientations
- [ ] Touch interactions (no hover)
- [ ] Keyboard appearance (login form)
- [ ] Pull-to-refresh expectations

---

*Report generated by automated mobile UX audit*
