import { supabase } from './supabase'

export type MyContext = {
  role: 'office_admin' | 'driver' | null
  office_id: string | null
  office_name: string | null
  office_invite_code: string | null
  driver_id: string | null
  driver_name: string | null
}

const EMPTY: MyContext = {
  role: null, office_id: null, office_name: null,
  office_invite_code: null, driver_id: null, driver_name: null
}

// Returns null if nobody is logged in. Returns EMPTY (role: null) if
// logged in but hasn't finished registering as an office or a driver yet.
export async function getMyContext(): Promise<MyContext | null> {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return null

  const { data, error } = await supabase.rpc('my_context')
  if (error || !data || data.length === 0) return EMPTY
  return data[0] as MyContext
}
