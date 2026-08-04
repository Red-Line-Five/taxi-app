'use client'
import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { getMyContext, MyContext } from '../../lib/context'
import { googleMapsLink } from '../../lib/location'

const DOC_TYPES: { key: string; label: string; emoji: string }[] = [
  { key: 'driving_license', label: 'License', emoji: '🪪' },
  { key: 'insurance', label: 'Insurance', emoji: '🛡️' },
  { key: 'car_registration', label: 'Car Registration', emoji: '🔧' },
]

export default function DriverPage() {
  const [ctx, setCtx] = useState<MyContext | null>(null)
  const [memberships, setMemberships] = useState<any[]>([]) // office_drivers rows
  const [trips, setTrips] = useState<any[]>([])
  const [isOnline, setIsOnline] = useState(false)
  const [inviteCode, setInviteCode] = useState('')
  const [message, setMessage] = useState('')
  const [docs, setDocs] = useState<Record<string, string>>({})
  const [expiryAlerts, setExpiryAlerts] = useState<string[]>([])
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [passMessage, setPassMessage] = useState('')

  useEffect(() => {
    (async () => {
      const c = await getMyContext()
      if (!c) { window.location.href = '/'; return }
      if (c.role !== 'driver') { window.location.href = '/dashboard'; return }
      setCtx(c)
      fetchMemberships()
      fetchMyTrips()
      fetchDocuments()
    })()

    const channel = supabase
      .channel('driver-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'trips' }, () => fetchMyTrips())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'office_drivers' }, () => fetchMemberships())
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [])

  const fetchMemberships = async () => {
    const { data } = await supabase
      .from('office_drivers')
      .select('id, status, commission_percent, offices(id, name)')
    setMemberships(data || [])
  }

  const fetchMyTrips = async () => {
    const { data } = await supabase
      .from('trips')
      .select('*')
      .in('status', ['assigned', 'accepted', 'in_progress'])
      .order('created_at', { ascending: false })
    setTrips(data || [])
  }

  const fetchDocuments = async () => {
    const { data } = await supabase.from('driver_documents').select('doc_type, expiry_date')
    const map: Record<string, string> = {}
    ;(data || []).forEach((d: any) => { map[d.doc_type] = d.expiry_date || '' })
    setDocs(map)
    checkExpiryAlerts(map)
  }

  const checkExpiryAlerts = (map: Record<string, string>) => {
    const alerts: string[] = []
    const today = new Date()
    const twoMonths = new Date()
    twoMonths.setMonth(twoMonths.getMonth() + 2)
    DOC_TYPES.forEach(({ key, label }) => {
      const date = map[key]
      if (!date) return
      const d = new Date(date)
      if (d <= twoMonths) {
        const days = Math.ceil((d.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
        alerts.push(days < 0 ? `❌ ${label} EXPIRED!` : `⚠️ ${label} expires in ${days} days`)
      }
    })
    setExpiryAlerts(alerts)
  }

  const saveDocument = async (docType: string, expiryDate: string) => {
    await supabase.from('driver_documents').insert({
      driver_id: ctx?.driver_id,
      doc_type: docType,
      file_url: 'manual-entry', // placeholder until OCR/upload module is built
      expiry_date: expiryDate || null,
      ocr_status: 'manual_override'
    })
    fetchDocuments()
  }

  const joinOffice = async () => {
    setMessage('')
    if (!inviteCode) { setMessage('⚠️ Enter an invite code'); return }
    const { error } = await supabase.rpc('driver_request_join_office', { p_invite_code: inviteCode.trim().toUpperCase() })
    if (error) { setMessage('❌ ' + error.message); return }
    setMessage('✅ Request sent — waiting for office approval.')
    setInviteCode('')
    fetchMemberships()
  }

  const toggleOnline = async () => {
    const activeOffices = memberships.filter((m) => m.status === 'active')
    if (activeOffices.length === 0) {
      setMessage('⚠️ Join an office first (invite code above)')
      return
    }
    const activeTrip = trips.find((t) => t.status === 'in_progress')
    if (isOnline && activeTrip) {
      setMessage('⚠️ Complete your active trip first!')
      return
    }

    if (!isOnline) {
      if (!navigator.geolocation) { setMessage('❌ Geolocation not supported on this device'); return }
      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          const { latitude, longitude } = pos.coords
          for (const m of activeOffices) {
            await supabase.from('driver_locations').upsert({
              driver_id: ctx?.driver_id,
              office_id: m.offices.id,
              lat: latitude,
              lng: longitude,
              is_available: true
            })
          }
          setIsOnline(true)
        },
        () => setMessage('❌ Could not get your location — enable location permission')
      )
    } else {
      for (const m of activeOffices) {
        await supabase.from('driver_locations')
          .update({ is_available: false })
          .eq('driver_id', ctx?.driver_id)
          .eq('office_id', m.offices.id)
      }
      setIsOnline(false)
    }
  }

  const acceptTrip = async (id: string) => { await supabase.rpc('driver_accept_trip', { p_trip_id: id }); fetchMyTrips() }
  const rejectTrip = async (id: string) => { await supabase.rpc('driver_reject_trip', { p_trip_id: id }); fetchMyTrips() }
  const startTrip = async (id: string) => { await supabase.rpc('driver_start_trip', { p_trip_id: id }); fetchMyTrips() }
  const completeTrip = async (id: string) => { await supabase.rpc('driver_complete_trip', { p_trip_id: id }); fetchMyTrips() }

  const changePassword = async () => {
    if (!newPassword || !confirmPassword) { setPassMessage('❌ Please fill both fields'); return }
    if (newPassword !== confirmPassword) { setPassMessage('❌ Passwords do not match'); return }
    if (newPassword.length < 6) { setPassMessage('❌ Password must be at least 6 characters'); return }
    const { error } = await supabase.auth.updateUser({ password: newPassword })
    setPassMessage(error ? '❌ Error: ' + error.message : '✅ Password updated successfully!')
    if (!error) { setNewPassword(''); setConfirmPassword('') }
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    window.location.href = '/'
  }

  const statusColor: Record<string, string> = {
    assigned: 'bg-blue-100 text-blue-800',
    accepted: 'bg-indigo-100 text-indigo-800',
    in_progress: 'bg-purple-100 text-purple-800',
  }

  const pendingMemberships = memberships.filter((m) => m.status === 'pending')

  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold">🚗 {ctx?.driver_name || 'Driver'}</h1>
        <button onClick={handleLogout} className="bg-gray-500 text-white px-4 py-2 rounded hover:bg-gray-600">Logout</button>
      </div>

      {message && <div className="bg-blue-50 border border-blue-200 text-blue-800 p-3 rounded mb-6">{message}</div>}

      {expiryAlerts.length > 0 && (
        <div className="bg-red-50 border border-red-300 p-4 rounded shadow mb-6">
          <h2 className="text-lg font-bold text-red-700 mb-2">🚨 Attention Required!</h2>
          {expiryAlerts.map((a, i) => <p key={i} className="text-red-600 font-bold">{a}</p>)}
        </div>
      )}

      {/* Join office */}
      <div className="bg-white p-6 rounded shadow mb-6">
        <h2 className="text-xl font-bold mb-4">🏢 My Offices</h2>
        {memberships.filter((m) => m.status === 'active').map((m) => (
          <p key={m.id} className="text-green-600 font-bold">✅ {m.offices?.name} ({m.commission_percent}% commission)</p>
        ))}
        {pendingMemberships.map((m) => (
          <p key={m.id} className="text-yellow-600">⏳ {m.offices?.name} — waiting for approval</p>
        ))}
        <div className="flex gap-2 mt-3">
          <input className="flex-1 border p-2 rounded" placeholder="Enter office invite code" value={inviteCode} onChange={(e) => setInviteCode(e.target.value)} />
          <button className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600" onClick={joinOffice}>Join</button>
        </div>
      </div>

      {/* Online toggle */}
      <div className="bg-white p-6 rounded shadow mb-6">
        <h2 className="text-xl font-bold mb-4">Status</h2>
        <div className="flex items-center gap-4">
          <span className={`text-lg font-bold ${isOnline ? 'text-green-500' : 'text-red-500'}`}>{isOnline ? '🟢 Online' : '🔴 Offline'}</span>
          <button onClick={toggleOnline} className={`px-6 py-2 rounded-full font-bold text-white ${isOnline ? 'bg-red-500 hover:bg-red-600' : 'bg-green-500 hover:bg-green-600'}`}>
            {isOnline ? 'Go Offline' : 'Go Online'}
          </button>
        </div>
      </div>

      {/* Trips */}
      <div className="bg-white p-6 rounded shadow mb-6">
        <h2 className="text-xl font-bold mb-4">📋 My Trips</h2>
        {trips.length === 0 && <p className="text-gray-500">No trips right now.</p>}
        {trips.map((trip: any) => (
          <div key={trip.id} className="border-b py-4">
            <p className="font-bold text-lg">{trip.client_name || trip.client_phone}</p>
            <a href={`https://wa.me/${(trip.client_phone || '').replace(/\D/g, '')}`} target="_blank" className="text-sm text-green-600 hover:underline">📱 {trip.client_phone}</a>
            <p className="text-sm text-gray-600 mb-1 mt-1">
              📍 Pickup: {trip.pickup_label || '—'}
              {trip.pickup_lat && (
                <a href={googleMapsLink(trip.pickup_lat, trip.pickup_lng)} target="_blank" className="text-blue-500 hover:underline ml-2 font-bold">🗺️ Navigate</a>
              )}
            </p>
            <p className="text-sm text-gray-600 mb-3">🏁 Dropoff: {trip.dropoff_label || '—'}</p>
            {trip.price && <p className="text-sm text-green-600 mb-2">💵 ${trip.price}</p>}
            <span className={`text-xs px-2 py-1 rounded mr-3 ${statusColor[trip.status]}`}>{trip.status}</span>
            <div className="flex gap-3 mt-3">
              {trip.status === 'assigned' && (
                <>
                  <button className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600" onClick={() => acceptTrip(trip.id)}>✅ Accept</button>
                  <button className="bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600" onClick={() => rejectTrip(trip.id)}>✖ Reject</button>
                </>
              )}
              {trip.status === 'accepted' && (
                <button className="bg-purple-500 text-white px-4 py-2 rounded hover:bg-purple-600" onClick={() => startTrip(trip.id)}>▶ Start</button>
              )}
              {trip.status === 'in_progress' && (
                <button className="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600" onClick={() => completeTrip(trip.id)}>🏁 Complete</button>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Documents */}
      <div className="bg-white p-6 rounded shadow mb-6">
        <h2 className="text-xl font-bold mb-4">📄 Documents</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {DOC_TYPES.map(({ key, label, emoji }) => (
            <div key={key}>
              <label className="text-sm text-gray-500 mb-1 block">{emoji} {label} Expiry</label>
              <input
                type="date"
                className="w-full border p-2 rounded"
                value={docs[key] || ''}
                onChange={(e) => setDocs({ ...docs, [key]: e.target.value })}
                onBlur={(e) => saveDocument(key, e.target.value)}
              />
            </div>
          ))}
        </div>
        <p className="text-xs text-gray-400 mt-2">Automatic scan reading (OCR) is coming later — enter expiry dates manually for now.</p>
      </div>

      {/* Change password */}
      <div className="bg-white p-6 rounded shadow">
        <h2 className="text-xl font-bold mb-4">🔑 Change Password</h2>
        <input type="password" className="w-full border p-2 rounded mb-3" placeholder="New Password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
        <input type="password" className="w-full border p-2 rounded mb-3" placeholder="Confirm Password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} />
        <button className="bg-blue-500 text-white px-6 py-2 rounded hover:bg-blue-600" onClick={changePassword}>Update Password</button>
        {passMessage && <p className={`mt-3 text-sm ${passMessage.includes('✅') ? 'text-green-600' : 'text-red-500'}`}>{passMessage}</p>}
      </div>
    </div>
  )
}
