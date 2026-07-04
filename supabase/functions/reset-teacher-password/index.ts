// supabase/functions/reset-teacher-password/index.ts
// Resets a teacher's password — called from Edit Teacher modal
// Deploy: supabase functions deploy reset-teacher-password

import { serve } from 'https://deno.land/x/supa_edge_runtime@v0.2.0/mod.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { user_id, password } = await req.json();

    if (!user_id || !password) {
      return new Response(
        JSON.stringify({ error: 'Missing user_id or password' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (password.length < 6) {
      return new Response(
        JSON.stringify({ error: 'Password must be at least 6 characters.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify caller is an admin
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

    // Verify caller is admin in same school as the teacher
    const adminClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const { data: callerMember } = await adminClient
      .from('school_members')
      .select('school_id, role')
      .eq('user_id', callerUser.id)
      .single();

    const { data: teacherMember } = await adminClient
      .from('school_members')
      .select('school_id, role')
      .eq('user_id', user_id)
      .single();

    if (
      !callerMember || callerMember.role !== 'admin' ||
      !teacherMember || teacherMember.role !== 'teacher' ||
      callerMember.school_id !== teacherMember.school_id
    ) {
      return new Response(
        JSON.stringify({ error: 'Forbidden — cannot reset this user\'s password' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Reset the password
    const { error } = await adminClient.auth.admin.updateUserById(user_id, { password });
    if (error) {
      return new Response(
        JSON.stringify({ error: error.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ success: true, message: 'Password updated successfully.' }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (err: unknown) {
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
