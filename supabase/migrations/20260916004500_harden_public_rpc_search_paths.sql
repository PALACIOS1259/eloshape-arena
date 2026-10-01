-- Harden the remaining public SECURITY DEFINER RPCs against search_path hijacking.
-- All referenced objects inside these functions are schema-qualified already,
-- so they do not need public/private in search_path.

alter function public.get_my_support_requests()
  set search_path = '';

alter function public.staff_create_bracket(uuid, jsonb, jsonb)
  set search_path = '';

alter function public.staff_finalize_tournament(uuid)
  set search_path = '';

alter function public.staff_generate_split_playoffs(uuid, integer, boolean, text)
  set search_path = '';

alter function public.staff_get_split_ops(uuid)
  set search_path = '';

alter function public.staff_list_support_requests()
  set search_path = '';

alter function public.staff_lock_tournament_entries(uuid)
  set search_path = '';

alter function public.staff_replace_withdrawn_qualifier(uuid, uuid)
  set search_path = '';

alter function public.staff_report_match_result(uuid, integer, integer)
  set search_path = '';

alter function public.staff_set_split_status(uuid, text)
  set search_path = '';

alter function public.staff_update_support_request(uuid, text, text)
  set search_path = '';

alter function public.submit_my_support_request(text, text, text)
  set search_path = '';
