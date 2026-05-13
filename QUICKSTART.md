# Quick Start Guide - Al-Noor School Management System

## Getting Started (5 minutes)

### 1. Launch the Application
The app is already built and ready. When you access it:
- You'll see the **Principal Login** page
- Create a new account with any email/password
- Or use test credentials

### 2. Login Credentials (First Time)
```
- Email: Any valid email (e.g., principal@school.edu)
- Password: Any secure password (min 6 characters)
- Create account or Sign In
```

After login → You're in the **Dashboard**

---

## Dashboard Overview (Your Control Center)

### Key Metrics (Live Data)
- **Active Students**: Count of enrolled students
- **Today's Attendance**: Real-time attendance rate
- **Monthly Fee Collected**: This month's revenue
- **Fee Defaulters**: Students with unpaid fees

### Quick Actions
- **Mark Attendance** → Daily attendance entry
- **Collect Fee** → Record payment
- **Add Student** → Enroll new student
- **View Reports** → Analytics

---

## Common Workflows

### Workflow 1: Add a Student (2 minutes)

1. Click **Students** in sidebar
2. Click **Add Student** button
3. Fill form:
   - Full Name: Required
   - Father's Name: Required
   - Roll Number: Unique ID (e.g., 2026-001)
   - Class: Select 1-12
   - Parent Phone: Required (e.g., 03XX-XXXXXXX)
   - Other fields: Optional
4. Click **Save Student**
5. Student appears in table immediately

**Tip**: You can add 100+ students; system supports decade data (2016-2026)

---

### Workflow 2: Mark Today's Attendance (3 minutes)

1. Click **Attendance** in sidebar
2. **Date**: Pre-filled with today (can change)
3. **Class**: Select (e.g., Class 5)
4. **Section**: Select (A, B, C, D)
5. Students load automatically
6. Click **Attendance buttons** for each student:
   - **P** (Green) = Present
   - **A** (Red) = Absent
   - **L** (Yellow) = Late
   - **LV** (Gray) = Leave
7. Use **Mark All Present** to mark entire class quickly
8. Click **Save Attendance**
9. ✓ Records saved to database

**Tip**: Can mark different dates by changing the date selector

---

### Workflow 3: Collect Student Fee (4 minutes)

1. Click **Fee Management** in sidebar
2. **Select Month**: e.g., May
3. **Select Year**: e.g., 2026
4. **Select Class**: Optional (or view all)
5. Student list shows with fee status:
   - Green badge = Already Paid
   - Red badge = Unpaid
   - Yellow badge = Partial payment
6. Click **Collect** or **Edit** button
7. **Fee Collection Modal** opens:
   - Auto-filled: Tuition, Lab, Sports fees from class structure
   - Enter: Amount paid, Payment method, Date
   - Auto-calculates: Total due, balance
8. Click **Save Payment**
9. ✓ Status changes to "Paid"

**Tip**: See total collected at top (Rs. XXXXX)

---

### Workflow 4: View Reports (3 minutes)

1. Click **Reports & Analytics** in sidebar
2. **Select Year**: Use dropdown (e.g., 2026)
3. **Three tabs** available:
   - **Overview**: Summary cards + monthly chart
   - **Fees**: Monthly collection bar chart (blue = collected, red = pending)
   - **Attendance**: Class-wise breakdown with attendance %
4. Hover over chart bars for exact amounts
5. View class-wise data (scroll table)

**Tip**: Compare years by selecting different years

---

### Workflow 5: Manage Classes & Fee Structure (2 minutes)

1. Click **Classes & Fee Structure** in sidebar
2. **Classes tab**:
   - Shows all classes (Class 1-12)
   - Click Edit to change teacher name
   - Click Add Class to create new section
3. **Fee Structures tab**:
   - Shows tuition, exam, lab, sports fees per class
   - Click Edit to modify fees
   - Annual total auto-calculated

**Tip**: Set up fee structure BEFORE adding students for auto-population

---

### Workflow 6: Post Notices (1 minute)

1. Click **Notices** in sidebar
2. Click **New Notice**
3. Fill:
   - **Title**: e.g., "Exam Date Changed"
   - **Type**: General / Urgent / Holiday / Exam
   - **Content**: Full message
4. Click **Post Notice**
5. ✓ Posted (can deactivate anytime)

**Tip**: Use **Urgent** type for important announcements

---

## Dashboard Metrics Explained

| Metric | What It Shows | How Updated |
|--------|---------------|------------|
| **Active Students** | Count of enrolled students | Real-time when add/deactivate |
| **Today's Attendance %** | Percentage marked present today | Updates when you save attendance |
| **Monthly Fee Collected** | Total received this month | Updates when you record payment |
| **Fee Defaulters** | Count of unpaid students | Real-time as you save payments |
| **Total Classes** | Count of classes (1-12 + sections) | Real-time |

**Auto-refresh**: Click Refresh button or reload page

---

## Data You Can See

All data is organized by **Academic Year** (2016-2026):

### Students Section
- Search by name, roll number, father name
- Filter by class or status (active/inactive)
- View full profile: B-Form, phone, address, etc.

### Fees Section
- Month-by-month breakdown
- Filter by class
- See payment history across 10 years
- Track discounts and fines

### Attendance Section
- Daily records per student
- Select any date/class
- View historical attendance
- Calculate attendance rate

### Reports Section
- Annual fee collection trends
- Class-wise comparisons
- Attendance rates per class
- Decade overview (2016-2026)

---

## Tips & Tricks

### Speed Up Data Entry
- Use **bulk actions**:
  - Attendance: "Mark All Present" button
  - Fees: Sort by unpaid to collect efficiently

### Avoid Data Loss
- **Soft delete**: "Deactivate" student (keeps data, hides from view)
- **Never delete** important records - always deactivate

### Keep Data Organized
- Use **Roll Numbers** consistently (e.g., YYYY-###)
- Set **Class sections** before adding students
- Define **Fee structure** at year start

### Efficient Workflow
- **Morning**: Mark attendance for all classes
- **Week**: Collect outstanding fees
- **Month-end**: Run reports for summary
- **Year-end**: Archive and plan next year

---

## Troubleshooting

### "I'm logged out"
- Your session expired
- Click "Sign In" and log back in
- System auto-saves your work

### "Data not showing"
- Refresh page (Ctrl+R or Cmd+R)
- Check internet connection
- Verify you're logged in

### "Can't save student"
- All required fields filled? (Name, Father, Phone, Class)
- Roll number already exists? (Must be unique)
- Check browser console for error (F12)

### "Attendance not saving"
- Date, class, section selected?
- Did you click "Save Attendance" (bottom right)?
- Try refresh page, re-select class

### "Fee collection disappeared"
- Might be filtered (check month/year/class selectors)
- Scroll right if needed (mobile view)
- Check Reports for historical data

---

## What's Happening Behind the Scenes

✓ **Database**: Supabase PostgreSQL (secure, reliable)
✓ **Authentication**: Email/password login (instant signup)
✓ **Real-time**: All data saves instantly to database
✓ **Backup**: Supabase auto-backups daily
✓ **Scale**: Supports 1000+ students easily

**Your data** is stored securely in encrypted database. Only you can access your account.

---

## Need Help?

### Common Issues & Solutions

**Login Problems**
- Use correct email format
- Password must be 6+ characters
- Try creating new account if forgot password

**Missing Data**
- Check filters (date, month, year, class)
- Click Refresh button
- Reload page

**Performance Slow**
- Close other browser tabs
- Check internet speed
- Try different browser

**Browser Compatibility**
- Works best: Chrome, Edge, Firefox, Safari
- Mobile: Full responsive design

---

## Next Steps

1. **Test the system**: Add 5 students, mark attendance
2. **Explore reports**: View analytics for insights
3. **Collect fees**: Record payments for demo data
4. **Customize**: Update school name in Settings
5. **Go live**: Invite staff to create accounts

---

## Feature Summary

✓ Student management (add, edit, filter, deactivate)
✓ Fee collection (track monthly payments, discounts, fines)
✓ Attendance marking (daily, bulk, historical)
✓ Reports & analytics (monthly trends, class breakdown)
✓ Notices board (post announcements)
✓ Secure login (email/password authentication)
✓ Decade history (2016-2026 data preservation)

**System Status**: Ready for live use

---

**Made for Pakistan Schools** • Al-Noor School Management System v1.0
