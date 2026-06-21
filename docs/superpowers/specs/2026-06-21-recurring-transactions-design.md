# Recurring Transactions

**Date:** 2026-06-21
**Status:** Approved

## Problem

User harus input transaksi rutin (kos, gaji, listrik, langganan) satu-satu setiap kali jatuh tempo. Beberapa nominalnya tetap (fixed), beberapa berubah tiap periode (variable).

## Goal

User bisa buat template transaksi rutin. Saat jatuh tempo, OS kirim local notification. Tap notif → buka transaction form yang sudah pre-filled. User konfirmasi (fixed) atau edit nominal dulu (variable), lalu save.

## Scope

- Template CRUD + local notification scheduling
- Pre-fill transaction-form dari tap notif
- Auto-reschedule notif berikutnya setelah transaksi disimpan

**Out of scope:** sync template ke Supabase, background fetch, iOS-specific setup.

---

## Data Model

Tabel baru di SQLite: `recurring_templates` (migration V3).

```sql
CREATE TABLE IF NOT EXISTS recurring_templates (
  id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT NOT NULL,
  label TEXT NOT NULL,
  wallet_id TEXT NOT NULL,
  destination_wallet_id TEXT,
  category_id TEXT NOT NULL,
  transaction_type TEXT NOT NULL CHECK(transaction_type IN ('Income','Expense','Transfer')),
  amount REAL NOT NULL DEFAULT 0,
  notes TEXT,
  recurrence TEXT NOT NULL CHECK(recurrence IN ('daily','weekly','monthly','yearly')),
  day_of_month INTEGER,
  time_hour INTEGER NOT NULL DEFAULT 8,
  time_minute INTEGER NOT NULL DEFAULT 0,
  next_due_at TEXT NOT NULL,
  notification_id TEXT,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT
);
```

**Catatan field:**
- `amount = 0` → variable; form wajib diisi sebelum save
- `day_of_month` dipakai hanya untuk `recurrence = 'monthly'`
- `notification_id` → ID dari `expo-notifications`, dipakai untuk cancel/reschedule
- Tidak ada `dirty`/`server_synced` — tabel ini tidak di-sync ke Supabase

---

## Architecture

### lib/recurring.ts

Satu file untuk semua logic:

- `getRecurringTemplates(userId)` — ambil semua template aktif
- `saveRecurringTemplate(template)` — insert atau update + schedule/reschedule notif
- `deleteRecurringTemplate(id)` — soft-delete + cancel notif
- `toggleTemplateActive(id, isActive)` — pause/resume + cancel atau reschedule notif
- `scheduleNotification(template)` → `Notifications.scheduleNotificationAsync` → return `notification_id`
- `cancelNotification(notification_id)` → `Notifications.cancelScheduledNotificationAsync`
- `computeNextDueAt(template, fromDate)` → hitung ISO timestamp berikutnya berdasarkan recurrence
- `rescheduleAfterConfirm(templateId)` → dipanggil setelah transaksi dari notif disimpan

### Notification Payload

```json
{
  "title": "Waktunya catat: Bayar Kos",
  "body": "Rp 800.000 — Expense",
  "data": {
    "templateId": "uuid",
    "walletId": "uuid",
    "categoryId": "uuid",
    "transactionType": "Expense",
    "amount": 800000,
    "notes": "Kos bulan Juli"
  }
}
```

Kalau `amount = 0`: body menjadi `"Ketuk untuk isi nominal"`.

---

## Screens

### app/(app)/recurring.tsx — Daftar Template

- List semua `recurring_templates` milik user (aktif di atas, non-aktif di bawah)
- Per item: label, badge recurrence (Harian/Mingguan/Bulanan/Tahunan), nominal atau "Variable", toggle aktif
- Tombol `+` → navigasi ke `recurring-form` (mode create)
- Tap item → navigasi ke `recurring-form` (mode edit)
- Diakses dari Profile → menu item "Transaksi Rutin"

### app/(app)/recurring-form.tsx — Form Template

Field:
| Field | Keterangan |
|---|---|
| Label | Nama reminder, e.g. "Bayar Kos" |
| Tipe | Income / Expense / Transfer |
| Wallet | Picker (reuse dari transaction-form) |
| Kategori | Picker (reuse dari transaction-form) |
| Nominal | Angka; kosong/0 = variable |
| Frekuensi | Harian / Mingguan / Bulanan / Tahunan |
| Tanggal mulai | DatePicker (first due date) |
| Jam reminder | TimePicker |
| Aktif | Toggle |

Save → `saveRecurringTemplate()` → kembali ke list.
Delete (mode edit) → `deleteRecurringTemplate()` → kembali ke list.

---

## Notification Flow

```
Template saved
  → scheduleNotification(template)
  → notification_id disimpan ke DB
  → next_due_at disimpan ke DB

OS fires notif (app bisa tertutup)
  → User tap
  → App buka (atau resume)
  → _layout.tsx: addNotificationResponseReceivedListener
  → Extract data dari notification.request.content.data
  → router.push('/transaction-form', { params: prefillData })

User save transaksi
  → transaction-form detect param `recurringTemplateId`
  → panggil rescheduleAfterConfirm(templateId)
  → hitung next_due_at baru
  → scheduleNotification ulang
```

---

## Files Impacted

| File | Perubahan |
|---|---|
| `lib/db/schema.ts` | Tambah migration V3: CREATE TABLE recurring_templates |
| `lib/recurring.ts` | File baru — semua CRUD + notif logic |
| `app/(app)/recurring.tsx` | Screen baru — list templates |
| `app/(app)/recurring-form.tsx` | Screen baru — form create/edit |
| `app/(app)/_layout.tsx` | Tambah route `recurring` dan `recurring-form` |
| `app/(app)/(tabs)/profile.tsx` | Tambah menu item "Transaksi Rutin" |
| `app/_layout.tsx` | Tambah `addNotificationResponseReceivedListener` |
| `app/(app)/transaction-form.tsx` | Terima params pre-fill + trigger reschedule setelah save |

**Library baru:** `expo-notifications` (~56.x) — belum ada di package.json.

---

## Edge Case: Notif Dismiss / App Tertutup Lama

Kalau user dismiss notif tanpa tap (atau app tidak dibuka saat notif fire), reschedule tidak terjadi. Solusi: saat app dibuka/resume, sweep active templates — kalau `next_due_at < now` dan tidak ada notif terjadwal, advance `next_due_at` ke occurrence berikutnya dan schedule ulang. Logic ini masuk ke `rescheduleStaleTemplates(userId)` yang dipanggil di `app/_layout.tsx` pada `AppState change → active`.

---

## Simplifications (ponytail)

- Tidak sync `recurring_templates` ke Supabase — notif sifatnya per-device, tidak masuk akal di-sync. Tambahkan kalau suatu saat butuh multi-device template management.
- Tidak ada background fetch — local notification di-schedule di level OS, tidak butuh app running untuk fire.
- `weekly` disederhanakan: next_due_at = 7 hari dari last confirmed (bukan hari-spesifik dalam minggu).
