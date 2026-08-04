'use client'
import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { getMyContext, MyContext } from '../../lib/context'

export default function Dashboard() {
  const [ctx, setCtx] = useState<MyContext | null>(null)
  const [pendingRequests, setPendingRequests] = useState<any[]>([])
  const [activeDrivers, setActiveDrivers] = useState<any[]>([])
  const [trips, setTrips] = useState<any[]>([])

  // create trip form
  const [clientName, setClientName] = useState('')
  const [clientPhone, setClientPhone] = useState('')
  const [pickupLabel, setPickupLabel] = useState('')
  const [pickupLat, setPickupLat] = useState('')
  const [pickupLng, setPickupLng] = useState('')
  const [dropoffLabel, setDropoffLabel] = useState('')
  const [dropoffLat, setDropoffLat] = useState('')
  const [dropoffLng, setDropoffLng] = useState('')
  const [manualPrice, setManualPrice] = useState('')

  // nearby driver search, scoped to a specific just-created trip
  const [nearbyFor, setNearbyFor] = useState<string | null>(null)
  const [nearbyDrivers, setNearbyDrivers] = useState<any[]>([])
  const [message, setMessage] = useState('')

  useEffect(() => {
    (async () => {
      const c = await getMyContext()
      if (!c) { window.location.href = '/'; return }
      if (c.role !== 'office_admin') { window.location.href = '/driver'; return }
      setCtx(c)
      fetchPendingRequests()
      fetchActiveDrivers()
      fetchTrips()
    })()

    const channel = supabase
      .channel('dashboard-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'trips' }, () => fetchTrips())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'office_drivers' }, () => {
        fetchPendingRequests(); fetchActiveDrivers()
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'driver_locations' }, () => fetchActiveDrivers())
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [])

  const fetchPendingRequests = async () => {
    const { data } = await supabase
      .from('office_drivers')
      .select('id, status, commission_percent, joined_at, drivers(id, full_name, phone)')
      .eq('status', 'pending')
      .order('joined_at', { ascending: false })
    setPendingRequests(data || [])
  }

  const fetchActiveDrivers = async () => {
    const { data } = await supabase
      .from('office_drivers')
      .select('id, commission_percent, drivers(id, full_name, phone)')
      .eq('status', 'active')
    const list = data || []
    // attach latest location for each driver, if any
    const { data: locs } = await supabase.from('driver_locations').select('*')
    const withLoc = list.map((row: any) => ({
      ...row,
      location: (locs || []).find((l: any) => l.driver_id === row.drivers?.id)
    }))
    setActiveDrivers(withLoc)
  }

  const fetchTrips = async () => {
    const { data } = await supabase
      .from('trips')
      .select('*, drivers(full_name, phone)')
      .order('created_at', { ascending: false })
      .limit(50)
    setTrips(data || [])
  }

  const approveRequest = async (id: string) => {
    await supabase.from('office_drivers').update({ status: 'active' }).eq('id', id)
    fetchPendingRequests(); fetchActiveDrivers()
  }

  const rejectRequest = async (id: string) => {
    await supabase.from('office_drivers').update({ status: 'removed' }).eq('id', id)
    fetchPendingRequests()
  }

  const createTrip = async () => {
    setMessage('')
    if (!clientPhone) { setMessage('⚠️ Client phone is required'); return }
    const { data, error } = await supabase.rpc('create_trip', {
      p_client_phone: clientPhone,
      p_client_name: clientName || null,
      p_pickup_lat: pickupLat ? parseFloat(pickupLat) : null,
      p_pickup_lng: pickupLng ? parseFloat(pickupLng) : null,
      p_pickup_label: pickupLabel || null,
      p_dropoff_lat: dropoffLat ? parseFloat(dropoffLat) : null,
      p_dropoff_lng: dropoffLng ? parseFloat(dropoffLng) : null,
      p_dropoff_label: dropoffLabel || null,
      p_manual_price: manualPrice ? parseFloat(manualPrice) : null
    })
    if (error) { setMessage('❌ ' + error.message); return }

    setClientName(''); setClientPhone('')
    setPickupLabel(''); setPickupLat(''); setPickupLng('')
    setDropoffLabel(''); setDropoffLat(''); setDropoffLng('')
    setManualPrice('')
    fetchTrips()

    // if we have pickup coordinates, immediately look for nearby drivers for this trip
    if (pickupLat && pickupLng) {
      findNearby(data.id, parseFloat(pickupLat), parseFloat(pickupLng))
    } else {
      setMessage('✅ Trip created. Add pickup coordinates to see nearby drivers, or assign manually below.')
    }
  }

  const findNearby = async (tripId: string, lat: number, lng: number) => {
    const { data, error } = await supabase.rpc('nearby_available_drivers', {
      p_lat: lat, p_lng: lng, p_radius_km: 8
    })
    if (error) { setMessage('❌ ' + error.message); return }
    setNearbyFor(tripId)
    setNearbyDrivers(data || [])
  }

  const assignDriver = async (tripId: string, driverId: string) => {
    const { error } = await supabase.rpc('assign_trip', { p_trip_id: tripId, p_driver_id: driverId })
    if (error) { setMessage('❌ ' + error.message); return }
    setNearbyFor(null); setNearbyDrivers([])
    fetchTrips()
  }

  const cancelTrip = async (tripId: string) => {
    await supabase.rpc('office_cancel_trip', { p_trip_id: tripId })
    fetchTrips()
  }

  const openWhatsApp = (phone: string) => {
    const cleaned = (phone || '').replace(/\D/g, '')
    window.open(`https://wa.me/${cleaned}`, '_blank')
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    window.location.href = '/'
  }

  const statusColor: Record<string, string> = {
    pending: 'bg-yellow-100 text-yellow-800',
    assigned: 'bg-blue-100 text-blue-800',
    accepted: 'bg-indigo-100 text-indigo-800',
    in_progress: 'bg-purple-100 text-purple-800',
    completed: 'bg-green-100 text-green-800',
    cancelled: 'bg-gray-200 text-gray-600'
  }

  return (
    <div className="min-h-screen bg-gray-100 p-8">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold text-yellow-500">🚖 {ctx?.office_name || 'Taxi Dashboard'}</h1>
          {ctx?.office_invite_code && (
            <p className="text-sm text-gray-500 mt-1">
              Invite code for drivers: <span className="font-mono font-bold bg-gray-200 px-2 py-0.5 rounded">{ctx.office_invite_code}</span>
            </p>
          )}
        </div>
        <div className="flex gap-3">
          <button onClick={() => window.location.href = '/report'} className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600">📊 Reports</button>
          <button onClick={() => window.location.href = '/drivers'} className="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600">👥 Drivers</button>
          <button onClick={handleLogout} className="bg-gray-500 text-white px-4 py-2 rounded hover:bg-gray-600">Logout</button>
        </div>
      </div>

      {message && <div className="bg-blue-50 border border-blue-200 text-blue-800 p-3 rounded mb-6">{message}</div>}

      {/* Pending driver requests */}
      {pendingRequests.length > 0 && (
        <div className="bg-white p-4 rounded shadow mb-6 border-2 border-yellow-300">
          <h2 className="text-lg font-bold mb-3">🔔 Pending Driver Requests ({pendingRequests.length})</h2>
          {pendingRequests.map((r: any) => (
            <div key={r.id} className="flex justify-between items-center border-b py-2">
              <div>
                <p className="font-bold">{r.drivers?.full_name}</p>
                <button onClick={() => openWhatsApp(r.drivers?.phone)} className="text-sm text-green-600 hover:underline">📱 {r.drivers?.phone}</button>
              </div>
              <div className="flex gap-2">
                <button onClick={() => approveRequest(r.id)} className="bg-green-500 text-white px-3 py-1 rounded text-sm hover:bg-green-600">✅ Approve</button>
                <button onClick={() => rejectRequest(r.id)} className="bg-red-500 text-white px-3 py-1 rounded text-sm hover:bg-red-600">✖ Reject</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Active drivers */}
      <div className="bg-white p-4 rounded shadow mb-6">
        <h2 className="text-lg font-bold mb-3">🚗 Active Drivers ({activeDrivers.length})</h2>
        {activeDrivers.length === 0 && <p className="text-gray-400">No active drivers yet. Share your invite code.</p>}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {activeDrivers.map((row: any) => (
            <div key={row.id} className={`p-3 rounded-lg border-2 ${row.location?.is_available ? 'border-green-400 bg-green-50' : 'border-red-300 bg-red-50'}`}>
              <p className="font-bold">{row.drivers?.full_name}</p>
              <button onClick={() => openWhatsApp(row.drivers?.phone)} className="text-sm text-green-600 hover:underline">📱 {row.drivers?.phone}</button>
              <p className={`text-sm font-bold mt-1 ${row.location?.is_available ? 'text-green-600' : 'text-red-500'}`}>
                {row.location?.is_available ? '🟢 Online' : '🔴 Offline'}
              </p>
              {row.location && (
                <p className="text-xs text-gray-500">📍 {row.location.lat.toFixed(4)}, {row.location.lng.toFixed(4)}</p>
              )}
              <p className="text-xs text-gray-400">Commission: {row.commission_percent}%</p>
            </div>
          ))}
        </div>
      </div>

      {/* Create trip */}
      <div className="bg-white p-6 rounded shadow mb-6">
        <h2 className="text-xl font-bold mb-4">☎️ New Client Call</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
          <input className="border p-2 rounded" placeholder="Client name (optional)" value={clientName} onChange={(e) => setClientName(e.target.value)} />
          <input className="border p-2 rounded" placeholder="Client phone" value={clientPhone} onChange={(e) => setClientPhone(e.target.value)} />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">
          <input className="border p-2 rounded" placeholder="Pickup label" value={pickupLabel} onChange={(e) => setPickupLabel(e.target.value)} />
          <input className="border p-2 rounded" placeholder="Pickup lat" value={pickupLat} onChange={(e) => setPickupLat(e.target.value)} />
          <input className="border p-2 rounded" placeholder="Pickup lng" value={pickupLng} onChange={(e) => setPickupLng(e.target.value)} />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">
          <input className="border p-2 rounded" placeholder="Dropoff label" value={dropoffLabel} onChange={(e) => setDropoffLabel(e.target.value)} />
          <input className="border p-2 rounded" placeholder="Dropoff lat" value={dropoffLat} onChange={(e) => setDropoffLat(e.target.value)} />
          <input className="border p-2 rounded" placeholder="Dropoff lng" value={dropoffLng} onChange={(e) => setDropoffLng(e.target.value)} />
        </div>
        <input className="w-full border p-2 rounded mb-3" placeholder="Manual price (optional — overrides per-km pricing)" value={manualPrice} onChange={(e) => setManualPrice(e.target.value)} />
        <button className="bg-yellow-400 font-bold px-6 py-2 rounded hover:bg-yellow-500 w-full" onClick={createTrip}>
          Create Trip & Find Nearby Drivers 🚖
        </button>

        {nearbyFor && (
          <div className="mt-4 border-t pt-4">
            <h3 className="font-bold mb-2">Nearby available drivers</h3>
            {nearbyDrivers.length === 0 && <p className="text-gray-400 text-sm">No available drivers found within 8km.</p>}
            {nearbyDrivers.map((d: any) => (
              <div key={d.driver_id} className="flex justify-between items-center border-b py-2">
                <p>{d.full_name} — <span className="text-gray-500 text-sm">{d.distance_km.toFixed(1)} km away</span></p>
                <button onClick={() => assignDriver(nearbyFor, d.driver_id)} className="bg-blue-500 text-white px-3 py-1 rounded text-sm hover:bg-blue-600">Assign</button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Trips list */}
      <div className="bg-white p-6 rounded shadow">
        <h2 className="text-xl font-bold mb-4">📋 Trips</h2>
        {trips.length === 0 && <p className="text-gray-500">No trips yet.</p>}
        {trips.map((trip: any) => (
          <div key={trip.id} className="border-b py-3">
            <div className="flex justify-between items-start">
              <div>
                <p className="font-bold">{trip.client_name || trip.client_phone}</p>
                <p className="text-gray-600 text-sm">📍 {trip.pickup_label || '—'} → {trip.dropoff_label || '—'}</p>
                {trip.price && <p className="text-green-600 text-sm">💵 ${trip.price}</p>}
                {trip.drivers && <p className="text-sm text-gray-500">Driver: {trip.drivers.full_name}</p>}
              </div>
              <div className="text-right">
                <span className={`text-xs px-2 py-1 rounded inline-block ${statusColor[trip.status] || 'bg-gray-100'}`}>{trip.status}</span>
                {trip.status === 'pending' && (
                  <div className="mt-2">
                    <button
                      onClick={() => trip.pickup_lat ? findNearby(trip.id, trip.pickup_lat, trip.pickup_lng) : setMessage('⚠️ No pickup coordinates on this trip')}
                      className="text-xs bg-blue-500 text-white px-2 py-1 rounded hover:bg-blue-600 mr-2"
                    >Find drivers</button>
                    <button onClick={() => cancelTrip(trip.id)} className="text-xs bg-red-500 text-white px-2 py-1 rounded hover:bg-red-600">Cancel</button>
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
