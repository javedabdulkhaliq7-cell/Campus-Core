// supabase/functions/create-teacher/index.ts
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Roles this endpoint is allowed to create. Deliberately excludes 'admin' and
// 'super_admin' — this function runs with the service role key (bypasses RLS),
// so the role coming from the request body MUST be checked against an
// allow-list rather than trusted as-is, even though the front-end dropdown
// only ever sends 'teacher' or 'watchman' today. Add 'cook' / 'canteen' /
// 'librarian' here once those roles get their own portal.
const ALLOWED_ROLES = ['teacher', 'watchman'] as const;
type AllowedRole = typeof ALLOWED_ROLES[number];

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { email, password, full_name, school_id, role, class_id, status, permissions } = await req.json();

    if (!email || !password || !full_name || !school_id) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: email, password, full_name, school_id' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const resolvedRole: AllowedRole = role ?? 'teacher'; // default keeps older callers working
    if (!ALLOWED_ROLES.includes(resolvedRole)) {
      return new Response(
        JSON.stringify({ error: `Invalid role "${role}". Allowed: ${ALLOWED_ROLES.join(', ')}` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (password.length < 6) {
      return new Response(
        JSON.stringify({ error: 'Password must be at least 6 characters.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify caller is authenticated
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const callerClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user: callerUser } } = await callerClient.auth.getUser();
    if (!callerUser) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized — invalid token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify caller is admin of this school
    const { data: callerMember } = await callerClient
      .from('school_members')
      .select('role')
      .eq('user_id', callerUser.id)
      .eq('school_id', school_id)
      .single();

    if (!callerMember || callerMember.role !== 'admin') {
      return new Response(
        JSON.stringify({ error: 'Forbidden — only school admins can create staff' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Use service role for admin operations
    const adminClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Create the auth user
    const { data: newUser, error: createError } = await adminClient.auth.admin.createUser({
      email:         email.toLowerCase().trim(),
      password:      password,
      email_confirm: true,
    });

    if (createError || !newUser?.user) {
      return new Response(
        JSON.stringify({ error: createError?.message || 'Failed to create auth user' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const newUserId = newUser.user.id;

    // Tab permissions are a teacher-only concept — a watchman gets a fixed
    // portal (Scan QR, Scan Face, Today's Attendance), nothing configurable.
    // Note: school_members.permissions is NOT NULL in this schema, so
    // non-teacher roles get {} rather than null.
    const memberPermissions = resolvedRole === 'teacher'
      ? (permissions || { tabs: { dashboard: true, students: true, attendance: true, results: true, defaulters: true } })
      : {};

    // Insert into school_members
    const { error: memberError } = await adminClient
      .from('school_members')
      .insert({
        user_id:     newUserId,
        school_id:   school_id,
        role:        resolvedRole,
        full_name:   full_name.trim(),
        status:      status || 'active',
        permissions: memberPermissions,
      });

    if (memberError) {
      // Rollback auth user
      await adminClient.auth.admin.deleteUser(newUserId);
      return new Response(
        JSON.stringify({ error: 'Failed to create member record: ' + memberError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Assign class if provided — teacher-only concept, ignored for watchman
    // even if a stray class_id slipped through.
    if (resolvedRole === 'teacher' && class_id) {
      await adminClient
        .from('classes')
        .update({ teacher_user_id: newUserId })
        .eq('id', class_id)
        .eq('school_id', school_id);
    }

    const roleLabel = resolvedRole === 'watchman' ? 'Watchman' : 'Teacher';
    return new Response(
      JSON.stringify({ success: true, user_id: newUserId, message: `${roleLabel} "${full_name}" created successfully.` }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (err: unknown) {
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});