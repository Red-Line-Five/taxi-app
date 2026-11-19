'use client'
import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { getMyContext } from '../../lib/context'

type Range = 'today' | 'week' | 'month' | 'all' | 'custom'

// Local-date helper: YYYY-MM-DD in the user's own timezone (not UTC).
const toYMD = (d: Date) => {
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${m}-${day}`
}

export default function Reports() {
  const [officeName, setOfficeName] = useState('')
  const [members, setMembers] = useState<any[]>([]) // office_drivers rows (+ drivers, + online status)
  const [trips, setTrips] = useState<any[]>([])
  const [selectedDriver, setSelectedDriver] = useState('')
  const [range, setRange] = useState<Range>('month')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [activeReport, setActiveReport] = useState<1 | 2 | 3>(1)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    (async () => {
      const ctx = await getMyContext()
      if (!ctx) { window.location.href = '/'; return }
      if (ctx.role !== 'office_admin') { window.location.href = '/driver'; return }
      setOfficeName(ctx.office_name || '')
      applyRange('month')
      await Promise.all([fetchMembers(), fetchTrips()])
      setLoading(false)
    })()
  }, [])

  const fetchMembers = async () => {
    const { data } = await supabase
      .from('office_drivers')
      .select('id, status, commission_percent, drivers(id, full_name, phone)')
      .neq('status', 'removed')
    const { data: locs } = await supabase.from('driver_locations').select('driver_id, is_available')
    setMembers(
      (data || []).map((m: any) => ({
        ...m,
        isOnline: !!(locs || []).find((l: any) => l.driver_id === m.drivers?.id && l.is_available)
      }))
    )
  }

  // Only completed trips count toward money. RLS already limits this to our office.
  const fetchTrips = async () => {
    const { data } = await supabase
      .from('trips')
      .select('id, driver_id, client_name, client_phone, pickup_label, dropoff_label, price, completed_at, created_at')
      .eq('status', 'completed')
      .order('completed_at', { ascending: false })
    setTrips(data || [])
  }

  const applyRange = (r: Range) => {
    setRange(r)
    const today = new Date()
    if (r === 'today') {
      setDateFrom(toYMD(today)); setDateTo(toYMD(today))
    } else if (r === 'week') {
      const from = new Date(today); from.setDate(from.getDate() - 6)
      setDateFrom(toYMD(from)); setDateTo(toYMD(today))
    } else if (r === 'month') {
      const from = new Date(today); from.setDate(from.getDate() - 29)
      setDateFrom(toYMD(from)); setDateTo(toYMD(today))
    } else if (r === 'all') {
      setDateFrom(''); setDateTo('')
    }
  }

  // Trips inside the chosen date range (by completion time, falling back to creation time).
  const inRange = trips.filter((t) => {
    const when = new Date(t.completed_at || t.created_at)
    if (dateFrom && when < new Date(dateFrom + 'T00:00:00')) return false
    if (dateTo && when > new Date(dateTo + 'T23:59:59')) return false
    return true
  })

  const sum = (list: any[]) => list.reduce((s, t) => s + (Number(t.price) || 0), 0)
  const money = (n: number) => `$${n.toFixed(2)}`

  // Report 1 — one driver
  const member = members.find((m) => m.drivers?.id === selectedDriver)
  const driverTrips = inRange.filter((t) => t.driver_id === selectedDriver)
  const driverTotal = sum(driverTrips)
  const percent = Number(member?.commission_percent ?? 10)
  const driverCommission = (driverTotal * percent) / 100

  // Report 2 — all drivers
  const allDrivers = members.map((m) => {
    const list = inRange.filter((t) => t.driver_id === m.drivers?.id)
    const total = sum(list)
    return { ...m, tripCount: list.length, total, commission: (total * Number(m.commission_percent)) / 100 }
  })

  // Report 3 — company income
  const companyTotal = sum(inRange)
  const companyCommission = allDrivers.reduce((s, d) => s + d.commission, 0)

  const driverName = (id: string) => members.find((m) => m.drivers?.id === id)?.drivers?.full_name || '—'

  const TripRow = ({ trip, showDriver }: { trip: any; showDriver?: boolean }) => (
    <div className="border-b py-3">
      <p className="font-bold text-black">{trip.client_name || trip.client_phone}</p>
      <p className="text-sm text-gray-600">📍 {trip.pickup_label || '—'} → {trip.dropoff_label || '—'}</p>
      <div className="flex gap-4 mt-1 flex-wrap">
        {trip.price > 0 && <p className="text-sm text-green-600">💵 {money(Number(trip.price))}</p>}
        {showDriver && <p className="text-sm text-gray-500">🚗 {driverName(trip.driver_id)}</p>}
        <p className="text-sm text-gray-400">{new Date(trip.completed_at || trip.created_at).toLocaleDateString()}</p>
      </div>
    </div>
  )

  const rangeButtons: { id: Range; label: string }[] = [
    { id: 'today', label: 'Today' },
    { id: 'week', label: '7 days' },
    { id: 'month', label: '30 days' },
    { id: 'all', label: 'All time' },
  ]

  return (
    <div className="min-h-screen bg-gray-100 p-8">

      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold text-yellow-500">📊 Reports</h1>
          {officeName && <p className="text-sm text-gray-500">{officeName}</p>}
        </div>
        <button
          onClick={() => window.location.href = '/dashboard'}
          className="bg-gray-500 text-white px-4 py-2 rounded hover:bg-gray-600"
        >
          ← Dashboard
        </button>
      </div>

      {/* Date range (applies to every report) */}
      <div className="bg-white p-4 rounded shadow mb-6">
        <div className="flex gap-2 flex-wrap mb-3">
          {rangeButtons.map((b) => (
            <button
              key={b.id}
              onClick={() => applyRange(b.id)}
              className={`px-4 py-1 rounded-full text-sm font-bold ${
                range === b.id ? 'bg-yellow-400 text-black' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {b.label}
            </button>
          ))}
        </div>
        <div className="flex gap-4">
          <div className="flex-1">
            <label className="text-sm text-gray-500 mb-1 block">From</label>
            <input type="date" className="w-full border p-2 rounded text-black" value={dateFrom}
              onChange={(e) => { setRange('custom'); setDateFrom(e.target.value) }} />
          </div>
          <div className="flex-1">
            <label className="text-sm text-gray-500 mb-1 block">To</label>
            <input type="date" className="w-full border p-2 rounded text-black" value={dateTo}
              onChange={(e) => { setRange('custom'); setDateTo(e.target.value) }} />
          </div>
        </div>
      </div>

      {/* Report Tabs */}
      <div className="flex gap-3 mb-6 flex-wrap">
        {[
          { id: 1, label: '🚗 Driver Report' },
          { id: 2, label: '👥 All Drivers' },
          { id: 3, label: '🏢 Company Income' },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveReport(tab.id as 1 | 2 | 3)}
            className={`px-6 py-2 rounded-full font-bold ${
              activeReport === tab.id ? 'bg-yellow-400 text-black' : 'bg-white text-gray-600 hover:bg-gray-200'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {loading && <p className="text-gray-500">Loading...</p>}

      {/* Report 1 — Single Driver */}
      {!loading && activeReport === 1 && (
        <div className="bg-white p-6 rounded shadow">
          <h2 className="text-xl font-bold mb-4">🚗 Driver Report</h2>
          <select
            className="w-full border p-2 rounded mb-6 text-black"
            value={selectedDriver}
            onChange={(e) => setSelectedDriver(e.target.value)}
          >
            <option value="">-- Select Driver --</option>
            {members.map((m) => (
              <option key={m.id} value={m.drivers?.id}>{m.drivers?.full_name}</option>
            ))}
          </select>

          {selectedDriver && (
            <>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
                <div className="bg-blue-50 p-4 rounded text-center">
                  <p className="text-2xl font-bold text-blue-600">{driverTrips.length}</p>
                  <p className="text-sm text-gray-500">Total Trips</p>
                </div>
                <div className="bg-green-50 p-4 rounded text-center">
                  <p className="text-2xl font-bold text-green-600">{money(driverTotal)}</p>
                  <p className="text-sm text-gray-500">Total Earned</p>
                </div>
                <div className="bg-yellow-50 p-4 rounded text-center">
                  <p className="text-2xl font-bold text-yellow-600">{percent}%</p>
                  <p className="text-sm text-gray-500">Commission</p>
                </div>
              </div>

              <div className="bg-orange-50 p-4 rounded mb-6 border border-orange-200">
                <p className="font-bold text-orange-800 mb-1">💰 Commission due to the office</p>
                <p className="text-orange-700 text-lg">{money(driverCommission)}</p>
              </div>

              <h3 className="font-bold mb-3">Trip Details</h3>
              {driverTrips.length === 0 && <p className="text-gray-400">No completed trips in this period.</p>}
              {driverTrips.map((trip) => <TripRow key={trip.id} trip={trip} />)}
            </>
          )}
        </div>
      )}

      {/* Report 2 — All Drivers */}
      {!loading && activeReport === 2 && (
        <div className="bg-white p-6 rounded shadow">
          <h2 className="text-xl font-bold mb-6">👥 All Drivers Summary</h2>
          {allDrivers.length === 0 && <p className="text-gray-400">No drivers yet.</p>}
          {allDrivers.map((d) => (
            <div key={d.id} className="border-b py-4">
              <div className="flex justify-between items-center">
                <div>
                  <p className="font-bold text-black text-lg">{d.drivers?.full_name}</p>
                  <p className="text-sm text-gray-500">📞 {d.drivers?.phone}</p>
                </div>
                <div className="flex gap-2 items-center">
                  {d.status !== 'active' && (
                    <span className="px-3 py-1 rounded-full text-xs font-bold bg-gray-200 text-gray-600">{d.status}</span>
                  )}
                  <span className={`px-3 py-1 rounded-full text-sm font-bold ${
                    d.isOnline ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                  }`}>
                    {d.isOnline ? '🟢 Online' : '🔴 Offline'}
                  </span>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3 mt-3">
                <div className="bg-blue-50 p-3 rounded text-center">
                  <p className="font-bold text-blue-600">{d.tripCount}</p>
                  <p className="text-xs text-gray-500">Trips</p>
                </div>
                <div className="bg-green-50 p-3 rounded text-center">
                  <p className="font-bold text-green-600">{money(d.total)}</p>
                  <p className="text-xs text-gray-500">Earned</p>
                </div>
                <div className="bg-orange-50 p-3 rounded text-center">
                  <p className="font-bold text-orange-600">{money(d.commission)}</p>
                  <p className="text-xs text-gray-500">Commission ({d.commission_percent}%)</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Report 3 — Company Income */}
      {!loading && activeReport === 3 && (
        <div className="bg-white p-6 rounded shadow">
          <h2 className="text-xl font-bold mb-4">🏢 Company Income</h2>

          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="bg-blue-50 p-4 rounded text-center">
              <p className="text-2xl font-bold text-blue-600">{inRange.length}</p>
              <p className="text-sm text-gray-500">Total Trips</p>
            </div>
            <div className="bg-green-50 p-4 rounded text-center">
              <p className="text-2xl font-bold text-green-600">{money(companyTotal)}</p>
              <p className="text-sm text-gray-500">Total Fares</p>
            </div>
            <div className="bg-orange-50 p-4 rounded text-center">
              <p className="text-2xl font-bold text-orange-600">{money(companyCommission)}</p>
              <p className="text-sm text-gray-500">Office Commission</p>
            </div>
          </div>

          {inRange.length === 0 && <p className="text-gray-400">No completed trips in this period.</p>}
          {inRange.map((trip) => <TripRow key={trip.id} trip={trip} showDriver />)}
        </div>
      )}

    </div>
  )
}
