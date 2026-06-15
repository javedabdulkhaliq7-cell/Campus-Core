import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY in your .env file.');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export const APP_NAME = 'Campus Core';

// ── Existing Types ───────────────────────────────────────────────

export type School = {
  id: string;
  name: string;
  slug: string;
  is_active: boolean;
};

export type SchoolSettings = {
  id: string;
  school_id: string;
  school_name: string;
  principal_name: string;
  address: string;
  phone: string;
  email: string;
  website: string;
  registration_number: string;
  established_year?: number;
  updated_at?: string;
  logo_url?: string | null;
  weekly_off_days?: number[];
};

export type Student = {
  id: string;
  school_id: string;
  roll_number: string;
  full_name: string;
  father_name: string;
  cnic_or_b_form?: string;
  date_of_birth: string;
  gender: string;
  address: string;
  phone: string;
  parent_phone: string;
  class_id?: string;
  current_grade: number;
  current_section: string;
  enrollment_year: number;
  is_active: boolean;
  photo_url?: string;
  created_at: string;
};

export type Class = {
  id: string;
  school_id: string;
  name: string;
  section: string;
  grade: number;
  academic_year: number;
  class_teacher?: string;
};

export type FeeStructure = {
  id: string;
  school_id: string;
  grade: number;
  academic_year: number;
  monthly_tuition: number;
  admission_fee: number;
  exam_fee: number;
  lab_fee: number;
  sports_fee: number;
  other_fee: number;
};

export type FeeRecord = {
  id: string;
  school_id: string;
  student_id: string;
  fee_month: number;
  fee_year: number;
  tuition_fee: number;
  admission_fee: number;
  exam_fee: number;
  lab_fee: number;
  sports_fee: number;
  other_fee: number;
  total_amount: number;
  amount_paid: number;
  discount: number;
  fine: number;
  status: string;
  payment_date?: string;
  payment_method?: string;
  receipt_number?: string;
  remarks?: string;
  collected_by?: string;
  sms_sent?: boolean;
  created_at: string;
};

export type AttendanceRecord = {
  id: string;
  school_id: string;
  student_id: string;
  attendance_date: string;
  status: string;
  remarks?: string;
  marked_by?: string;
};

export type Announcement = {
  id: string;
  school_id: string;
  title: string;
  content: string;
  type: string;
  is_active: boolean;
  created_at: string;
};

// ── New Subscription Types ───────────────────────────────────────

export type SubscriptionPlan = 'basic' | 'standard' | 'premium';
export type SubscriptionStatus = 'trial' | 'active' | 'pending_payment' | 'expired' | 'suspended';
export type PaymentMethod = 'jazzcash' | 'easypaisa';
export type PaymentStatus = 'pending' | 'verified' | 'failed';

export interface Subscription {
  id: string;
  school_id: string;
  plan: SubscriptionPlan;
  status: SubscriptionStatus;
  student_limit: number;
  amount: number;
  billing_day: number;
  trial_ends_at: string | null;
  current_period_start: string | null;
  current_period_end: string | null;
  payment_due_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface Payment {
  id: string;
  school_id: string;
  subscription_id: string;
  amount: number;
  method: PaymentMethod;
  transaction_id: string | null;
  phone_number: string | null;
  status: PaymentStatus;
  payment_month: number | null;
  payment_year: number | null;
  paid_at: string | null;
  verified_at: string | null;
  verified_by: string | null;
  created_at: string;
}

// ── Plan Config ──────────────────────────────────────────────────

export const PLAN_CONFIG: Record<SubscriptionPlan, {
  label: string;
  amount: number;
  student_limit: number;
  description: string;
  features: string[];
}> = {
  basic: {
    label: 'Basic',
    amount: 1000,
    student_limit: 200,
    description: 'Perfect for small schools',
    features: [
      'Up to 200 students',
      'Fee management',
      'Attendance tracking',
      'Exam results',
      'Basic reports',
    ],
  },
  standard: {
    label: 'Standard',
    amount: 2000,
    student_limit: 500,
    description: 'Ideal for growing schools',
    features: [
      'Up to 500 students',
      'All Basic features',
      'Advanced reports',
      'Document management',
      'Leaving certificates',
    ],
  },
  premium: {
    label: 'Premium',
    amount: 5000,
    student_limit: 999999,
    description: 'For large institutions',
    features: [
      'Unlimited students',
      'All Standard features',
      'Priority support',
      'Custom branding',
      'Future API integrations',
    ],
  },
};

// ── Constants ────────────────────────────────────────────────────

export const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

export const GRADES = Array.from({ length: 12 }, (_, i) => i + 1);
export const SECTIONS = ['A', 'B', 'C', 'D'];
export const CURRENT_YEAR = new Date().getFullYear();
export const DECADE_YEARS = Array.from({ length: 10 }, (_, i) => CURRENT_YEAR - 9 + i);

// ── SMS Helper ───────────────────────────────────────────────────

export async function sendSmsNotification(
  phone: string,
  studentName: string,
  amount: number,
  schoolName: string,
  month: number,
  year: number,
) {
  const apiUrl = `${supabaseUrl}/functions/v1/send-sms`;
  try {
    await fetch(apiUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${supabaseAnonKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ phone, studentName, amount, schoolName, month, year }),
    });
  } catch (e) {
    console.error('SMS notification failed:', e);
  }
}