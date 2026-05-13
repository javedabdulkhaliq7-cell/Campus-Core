# Al-Noor School Management System - Backend Setup & Documentation

## System Overview

A complete school management system built for Pakistani schools with:
- **Principal Dashboard** with real-time analytics
- **Student Management** across a decade (2016-2026)
- **Fee Management** with month-by-month tracking
- **Daily Attendance** marking with quick entry
- **Reports & Analytics** for decision making
- **Secure Authentication** via Supabase

---

## Database Architecture

### Database Provider: Supabase (PostgreSQL)
- **URL**: `https://skrwdpdcbjjwvkmpfkpr.supabase.co`
- **Type**: Postgres with real-time subscriptions
- **Row Level Security (RLS)**: Enabled on all tables

### Tables & Schema

#### 1. **classes** (13 rows seeded for 2026)
Stores class/grade information with teacher assignments
```
- id: UUID (primary key)
- name: Text (e.g., "Class 1")
- grade: Integer (1-12)
- section: Text (A, B, C, D)
- academic_year: Integer (2016-2026)
- class_teacher: Text (optional teacher name)
- created_at: Timestamp
- Unique constraint: (grade, section, academic_year)
```

#### 2. **students** (0 rows initially, add via UI)
Complete student records with enrollment history
```
- id: UUID (primary key)
- roll_number: Text (unique, e.g., "2026-001")
- full_name: Text
- father_name: Text
- cnic_or_b_form: Text (optional)
- date_of_birth: Date (optional)
- gender: Text (Male/Female)
- address: Text (optional)
- phone: Text (optional)
- parent_phone: Text (required)
- current_grade: Integer (1-12)
- current_section: Text
- enrollment_year: Integer (2016-2026 for decade coverage)
- is_active: Boolean (default true)
- photo_url: Text (optional)
- class_id: UUID (foreign key to classes)
- created_at: Timestamp
- updated_at: Timestamp
- Indexes: class_id, is_active, current_grade
```

#### 3. **fee_structures** (24 rows seeded for 2025-2026)
Fee definitions per class per year
```
- id: UUID (primary key)
- grade: Integer (1-12)
- academic_year: Integer
- monthly_tuition: Integer (default 0)
- admission_fee: Integer (default 0)
- exam_fee: Integer (default 0)
- lab_fee: Integer (default 0)
- sports_fee: Integer (default 0)
- other_fee: Integer (default 0)
- created_at: Timestamp
- Unique constraint: (grade, academic_year)
```

#### 4. **fee_records** (0 rows initially)
Individual student fee payment tracking
```
- id: UUID (primary key)
- student_id: UUID (foreign key, references students.id)
- fee_month: Integer (1-12)
- fee_year: Integer
- tuition_fee: Integer (default 0)
- admission_fee: Integer (default 0)
- exam_fee: Integer (default 0)
- lab_fee: Integer (default 0)
- sports_fee: Integer (default 0)
- other_fee: Integer (default 0)
- total_amount: Integer (calculated total)
- amount_paid: Integer (default 0)
- discount: Integer (default 0)
- fine: Integer (default 0)
- status: Text (Paid/Partial/Unpaid)
- payment_date: Date (optional)
- payment_method: Text (Cash/Bank Transfer/Cheque/Online)
- receipt_number: Text (optional)
- remarks: Text (optional)
- collected_by: Text (optional, e.g., "Principal")
- created_at: Timestamp
- updated_at: Timestamp
- Unique constraint: (student_id, fee_month, fee_year)
- Indexes: student_id, fee_year, fee_month
```

#### 5. **attendance_records** (0 rows initially)
Daily attendance per student
```
- id: UUID (primary key)
- student_id: UUID (foreign key, references students.id)
- attendance_date: Date
- status: Text (Present/Absent/Late/Leave)
- remarks: Text (optional)
- marked_by: Text (optional, e.g., "Principal")
- created_at: Timestamp
- updated_at: Timestamp
- Unique constraint: (student_id, attendance_date)
- Indexes: student_id, attendance_date
```

#### 6. **announcements** (0 rows initially)
Principal notices and announcements
```
- id: UUID (primary key)
- title: Text
- content: Text
- type: Text (General/Urgent/Holiday/Exam)
- is_active: Boolean (default true)
- created_at: Timestamp
```

---

## Row Level Security (RLS) Policies

All tables have RLS enabled. Access is controlled by:
- **SELECT**: Authenticated users can read all data
- **INSERT**: Authenticated users can insert new records
- **UPDATE**: Authenticated users can update records
- **DELETE**: Authenticated users can delete records

**Note**: For production deployment, implement stricter policies limiting access to specific roles (e.g., only principal, class teachers).

---

## Authentication

### Supabase Auth Configuration
- **Type**: Email/Password authentication
- **Email confirmation**: Disabled (allows instant signup)
- **Session management**: Automatic via Supabase SDK

### Login Flow
1. Principal creates account or signs in with email + password
2. Supabase returns JWT session
3. Session stored in browser (managed by SDK)
4. All database queries include auth context via JWT
5. Logout clears session

### Key Functions
```typescript
// Sign up
await supabase.auth.signUp({ email, password });

// Sign in
await supabase.auth.signInWithPassword({ email, password });

// Sign out
await supabase.auth.signOut();

// Listen for auth changes
supabase.auth.onAuthStateChange((event, session) => {
  // React to auth changes
});

// Get current session
const { data: { session } } = await supabase.auth.getSession();
```

---

## API Integration Points

All operations use Supabase JavaScript SDK:

### Students
```typescript
// Create
await supabase.from('students').insert({ full_name, father_name, ... });

// Read
await supabase.from('students').select('*').order('full_name');

// Update
await supabase.from('students').update({ is_active: false }).eq('id', studentId);

// Filter
await supabase.from('students').select('*').eq('current_grade', 1).eq('is_active', true);
```

### Fee Records
```typescript
// Upsert (insert or update)
await supabase.from('fee_records').upsert({
  student_id, fee_month, fee_year, ...
}, { onConflict: 'student_id,fee_month,fee_year' });

// Get month's fees
await supabase.from('fee_records').select('*')
  .eq('fee_month', 5)
  .eq('fee_year', 2026);

// Calculate totals
const { data } = await supabase.from('fee_records')
  .select('amount_paid')
  .eq('status', 'Paid')
  .eq('fee_year', 2026);
```

### Attendance
```typescript
// Mark attendance
await supabase.from('attendance_records').upsert({
  student_id, attendance_date, status, ...
}, { onConflict: 'student_id,attendance_date' });

// Get attendance rate
await supabase.from('attendance_records')
  .select('status')
  .gte('attendance_date', '2026-01-01')
  .lte('attendance_date', '2026-12-31');
```

---

## Key Features & Implementation

### 1. Dashboard Analytics
- **Real-time counts**: Total/active students, today's attendance
- **Auto-calculated**: Attendance rate, fee collection %, defaulter count
- **Aggregations**: Monthly revenue, pending dues

**Database queries**: Uses `SELECT COUNT()`, `SUM()`, filtered aggregates

### 2. Fee Collection Tracking
- **Monthly basis**: Stores fee per month per student
- **Flexible payment**: Records partial payments with discount/fine
- **Status tracking**: Paid/Partial/Unpaid with payment method
- **Decade history**: Covers 2016-2026 for historical analysis

### 3. Attendance Management
- **Daily records**: One entry per student per date
- **Status options**: Present, Absent, Late, Leave
- **Quick entry**: Bulk "Mark All" buttons for fast class-wide marking
- **Upsert logic**: Safe re-running of entries (updates existing)

### 4. Reports & Analytics
- **Monthly fee charts**: Visual collection vs pending
- **Class-wise breakdown**: Students, fees, attendance by class
- **Decade selector**: Compare years across 10-year span
- **Attendance rates**: Per-student and per-class calculation

---

## Data Persistence & Safety

### Backup & Recovery
- Supabase provides daily automated backups
- Point-in-time recovery available
- Manual backups can be exported via dashboard

### Data Integrity
- Foreign key constraints enforce referential integrity
- Unique constraints prevent duplicate entries (e.g., attendance per date)
- Soft deletes via `is_active` flag (no data loss)

### Transactions
- No explicit transaction handling in app
- Supabase guarantees ACID compliance per query
- Multiple operations: app handles sequencing (not atomic)

---

## Environment Variables

Required in `.env` file (already configured):
```
VITE_SUPABASE_URL=https://skrwdpdcbjjwvkmpfkpr.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGc...
```

**Frontend**: Uses anon key (public, safe for browser)
**Backend**: Not needed for this SPA (no server-side code)

---

## Performance Considerations

### Indexes
- `students(class_id, is_active, current_grade)` - for filtering
- `fee_records(student_id, fee_year, fee_month)` - for monthly lookups
- `attendance_records(student_id, attendance_date)` - for historical data

### Query Optimization
- Select only needed columns (reduce bandwidth)
- Filter at database level (not in app)
- Use `.maybeSingle()` for single-row queries (no error if none found)
- Avoid N+1 queries via Supabase `.select('*')` with relationships

### Scalability
- Supabase auto-scales with usage
- Expected load: ~500-1000 students, ~50-100MB data
- Sufficient for school of 2000+ students

---

## Testing the Backend

### Prerequisites
1. App must be running (`npm run dev`)
2. User must be logged in with valid Supabase account
3. Database tables fully created with migrations

### Test Workflow

**1. Add a Student**
- Go to Students > Add Student
- Fill form, click Save
- Should appear in table immediately (real-time)

**2. Mark Attendance**
- Go to Attendance
- Select date, class, section
- Click Present/Absent buttons for students
- Click Save Attendance
- Verify records saved (refresh = same data)

**3. Collect Fee**
- Go to Fee Management
- Select month/year, class (optional)
- Click Collect fee button
- Fill amounts, click Save Payment
- Verify status changes to "Paid"

**4. View Dashboard**
- Dashboard refreshes automatically with new data
- Total students, attendance, collected fees should update

**5. Generate Reports**
- Go to Reports & Analytics
- Select year
- View monthly collection bar chart
- Check class-wise breakdown

---

## Debugging Common Issues

### "No data appears"
- Check: Is user logged in? (Check for auth error in console)
- Check: Do database records exist? (Check Supabase dashboard)
- Check: Are RLS policies blocking access? (Check policy on table)
- Solution: Refresh page, sign out/in, check network tab

### "Upsert not working (duplicate key error)"
- Check: Unique constraint columns match query
- Example: `fee_records` unique on `(student_id, fee_month, fee_year)`
- Solution: Pass exact same columns in upsert

### "Session lost after refresh"
- Expected behavior: Supabase SDK auto-restores session from browser storage
- If not working: Check localStorage permissions, incognito mode
- Solution: Manually sign in again

### "Charts not updating"
- Check: Did you actually save data?
- Check: Report year matches data year
- Solution: Refresh page (F5), or select different year

---

## Production Deployment Checklist

- [ ] Update RLS policies (restrict to specific roles)
- [ ] Enable email verification for signup
- [ ] Configure SMTP for password reset emails
- [ ] Set up backups & disaster recovery plan
- [ ] Enable row-level security for multi-user setup
- [ ] Configure CORS for custom domain
- [ ] Set up monitoring & alerting
- [ ] Test with real data volume (1000+ students)
- [ ] Document admin procedures
- [ ] Train staff on system usage

---

## Support & Next Steps

**Current State**: Fully functional demo ready for testing
**Live Data**: All operations save to Supabase immediately
**User Data**: Scoped to logged-in user (auth context)

To extend:
1. Add reports export (PDF/Excel)
2. Multi-user roles (principal, admin, teacher)
3. SMS notifications for fee reminders
4. Mobile app for attendance (React Native)
5. Integration with fee payment gateway
