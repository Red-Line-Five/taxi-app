'use client'
import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'

export default function Reports() {
  const [drivers, setDrivers] = useState<any[]>([])
  const [trips, setTrips] = useState<any[]>([])
  const [selectedDriver, setSelectedDriver] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [activeReport, setActiveReport] = useState<1 | 2 | 3>(1)

  useEffect(() => {
    fetchDrivers()
    fetchTrips()
  }, [])

  const fetchDrivers = async () => {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('role', 'driver')
    setDrivers(data || [])
  }

  const fetchTrips = async () => {
    const { data } = await supabase
      .from('trips')
      .select('*')
      .eq('status', 'done')
      .order('created_at', { ascending: false })
    setTrips(data || [])
  }

  // Report 1 — Single driver trips + money + commission
  const getDriverTrips = () => {
    if (!selectedDriver) return []
    return trips.filter((t) => t.assigned_driver_id === selectedDriver)
  }

  const calcTotals = (driverTrips: any[]) => {
    const totalUsd = driverTrips.reduce((s, t) => s + (t.price_usd || 0), 0)
    const totalLbp = driverTrips.reduce((s, t) => s + (t.price_lbp || 0), 0)
    const driver = drivers.find((d) => d.id === selectedDriver)
    const percent = driver?.commission_percent || 10
    const commUsd = (totalUsd * percent) / 100
    const commLbp = (totalLbp * percent) / 100
    return { totalUsd, totalLbp, commUsd, commLbp, percent }
  }

  // Report 2 — All drivers summary
  const getAllDriversSummary = () => {
    return drivers.map((driver) => {
      const driverTrips = trips.filter((t) => t.assigned_driver_id === driver.id)
      const totalUsd = driverTrips.reduce((s, t) => s + (t.price_usd || 0), 0)
      const totalLbp = driverTrips.reduce((s, t) => s + (t.price_lbp || 0), 0)
      const percent = driver.commission_percent || 10
      const commUsd = (totalUsd * percent) / 100
      const commLbp = (totalLbp * percent) / 100
      return {
        ...driver,
        tripCount: driverTrips.length,
        totalUsd,
        totalLbp,
        commUsd,
        commLbp
      }
    })
  }

  // Report 3 — Company income by date range
  const getCompanyReport = () => {
    let filtered = trips
    if (dateFrom) filtered = filtered.filter((t) => t.created_at >= dateFrom)
    if (dateTo) filtered = filtered.filter((t) => t.created_at <= dateTo + 'T23:59:59')
    const totalUsd = filtered.reduce((s, t) => s + (t.price_usd || 0), 0)
    const totalLbp = filtered.reduce((s, t) => s + (t.price_lbp || 0), 0)
    return { filtered, totalUsd, totalLbp }
  }

  const driverTrips = getDriverTrips()
  const driverTotals = calcTotals(driverTrips)
  const allDrivers = getAllDriversSummary()
  const companyReport = getCompanyReport()

  return (
    <div className="min-h-screen bg-gray-100 p-8">

      {/* Header */}
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold text-yellow-500">📊 Reports</h1>
        <button
          onClick={() => window.location.href = '/dashboard'}
          className="bg-gray-500 text-white px-4 py-2 rounded hover:bg-gray-600"
        >
          ← Dashboard
        </button>
      </div>

      {/* Report Tabs */}
      <div className="flex gap-3 mb-8">
        {[
          { id: 1, label: '🚗 Driver Report' },
          { id: 2, label: '👥 All Drivers' },
          { id: 3, label: '🏢 Company Income' },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveReport(tab.id as 1 | 2 | 3)}
            className={`px-6 py-2 rounded-full font-bold ${
              activeReport === tab.id
                ? 'bg-yellow-400 text-black'
                : 'bg-white text-gray-600 hover:bg-gray-200'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Report 1 — Single Driver */}
      {activeReport === 1 && (
        <div className="bg-white p-6 rounded shadow">
          <h2 className="text-xl font-bold mb-4">🚗 Driver Report</h2>
          <select
            className="w-full border p-2 rounded mb-6 text-black"
            value={selectedDriver}
            onChange={(e) => setSelectedDriver(e.target.value)}
          >
            <option value="">-- Select Driver --</option>
            {drivers.map((d) => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </select>

          {selectedDriver && (
            <>
              {/* Summary */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <div className="bg-blue-50 p-4 rounded text-center">
                  <p className="text-2xl font-bold text-blue-600">{driverTrips.length}</p>
                  <p className="text-sm text-gray-500">Total Trips</p>
                </div>
                <div className="bg-green-50 p-4 rounded text-center">
                  <p className="text-2xl font-bold text-green-600">${driverTotals.totalUsd.toFixed(2)}</p>
                  <p className="text-sm text-gray-500">Total USD</p>
                </div>
                <div className="bg-purple-50 p-4 rounded text-center">
                  <p className="text-2xl font-bold text-purple-600">{driverTotals.totalLbp.toLocaleString()}</p>
                  <p className="text-sm text-gray-500">Total LBP</p>
                </div>
                <div className="bg-yellow-50 p-4 rounded text-center">
                  <p className="text-2xl font-bold text-yellow-600">{driverTotals.percent}%</p>
                  <p className="text-sm text-gray-500">Commission</p>
                </div>
              </div>

              {/* Commission */}
              <div className="bg-orange-50 p-4 rounded mb-6 border border-orange-200">
                <p className="font-bold text-orange-800 mb-2">💰 Commission Due</p>
                {driverTotals.commUsd > 0 && (
                  <p className="text-orange-700">💵 ${driverTotals.commUsd.toFixed(2)} USD</p>
                )}
                {driverTotals.commLbp > 0 && (
                  <p className="text-orange-700">🇱🇧 {driverTotals.commLbp.toLocaleString()} LBP</p>
                )}
              </div>

              {/* Trips List */}
              <h3 className="font-bold mb-3">Trip Details</h3>
              {driverTrips.length === 0 && <p className="text-gray-400">No trips found.</p>}
              {driverTrips.map((trip) => (
                <div key={trip.id} className="border-b py-3">
                  <p className="font-bold text-black">{trip.customer_name}</p>
                  <p className="text-sm text-gray-600">📍 {trip.pickup_location} → {trip.dropoff_location}</p>
                  <div className="flex gap-4 mt-1">
                    {trip.price_usd > 0 && <p className="text-sm text-green-600">💵 ${trip.price_usd}</p>}
                    {trip.price_lbp > 0 && <p className="text-sm text-blue-600">🇱🇧 {trip.price_lbp.toLocaleString()} LBP</p>}
                    <p className="text-sm text-gray-400">{new Date(trip.created_at).toLocaleDateString()}</p>
                  </div>
                </div>
              ))}
            </>
          )}
        </div>
      )}

      {/* Report 2 — All Drivers */}
      {activeReport === 2 && (
        <div className="bg-white p-6 rounded shadow">
          <h2 className="text-xl font-bold mb-6">👥 All Drivers Summary</h2>
          {allDrivers.map((driver) => (
            <div key={driver.id} className="border-b py-4">
              <div className="flex justify-between items-center">
                <div>
                  <p className="font-bold text-black text-lg">{driver.name}</p>
                  <p className="text-sm text-gray-500">📞 {driver.phone}</p>
                </div>
                <span className={`px-3 py-1 rounded-full text-sm font-bold ${
                  driver.is_online ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                }`}>
                  {driver.is_online ? '🟢 Online' : '🔴 Offline'}
                </span>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-3">
                <div className="bg-blue-50 p-3 rounded text-center">
                  <p className="font-bold text-blue-600">{driver.tripCount}</p>
                  <p className="text-xs text-gray-500">Trips</p>
                </div>
                <div className="bg-green-50 p-3 rounded text-center">
                  <p className="font-bold text-green-600">${driver.totalUsd.toFixed(2)}</p>
                  <p className="text-xs text-gray-500">USD</p>
                </div>
                <div className="bg-purple-50 p-3 rounded text-center">
                  <p className="font-bold text-purple-600">{driver.totalLbp.toLocaleString()}</p>
                  <p className="text-xs text-gray-500">LBP</p>
                </div>
                <div className="bg-orange-50 p-3 rounded text-center">
                  <p className="font-bold text-orange-600">${driver.commUsd.toFixed(2)}</p>
                  <p className="text-xs text-gray-500">Commission</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Report 3 — Company Income */}
      {activeReport === 3 && (
        <div className="bg-white p-6 rounded shadow">
          <h2 className="text-xl font-bold mb-4">🏢 Company Income</h2>

          {/* Date Filter */}
          <div className="flex gap-4 mb-6">
            <div className="flex-1">
              <label className="text-sm text-gray-500 mb-1 block">From</label>
              <input
                type="date"
                className="w-full border p-2 rounded text-black"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
              />
            </div>
            <div className="flex-1">
              <label className="text-sm text-gray-500 mb-1 block">To</label>
              <input
                type="date"
                className="w-full border p-2 rounded text-black"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
              />
            </div>
          </div>

          {/* Summary */}
          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="bg-blue-50 p-4 rounded text-center">
              <p className="text-2xl font-bold text-blue-600">{companyReport.filtered.length}</p>
              <p className="text-sm text-gray-500">Total Trips</p>
            </div>
            <div className="bg-green-50 p-4 rounded text-center">
              <p className="text-2xl font-bold text-green-600">${companyReport.totalUsd.toFixed(2)}</p>
              <p className="text-sm text-gray-500">Total USD</p>
            </div>
            <div className="bg-purple-50 p-4 rounded text-center">
              <p className="text-2xl font-bold text-purple-600">{companyReport.totalLbp.toLocaleString()}</p>
              <p className="text-sm text-gray-500">Total LBP</p>
            </div>
          </div>

          {/* Trips */}
          {companyReport.filtered.map((trip) => (
            <div key={trip.id} className="border-b py-3">
              <p className="font-bold text-black">{trip.customer_name}</p>
              <p className="text-sm text-gray-600">📍 {trip.pickup_location} → {trip.dropoff_location}</p>
              <div className="flex gap-4 mt-1">
                {trip.price_usd > 0 && <p className="text-sm text-green-600">💵 ${trip.price_usd}</p>}
                {trip.price_lbp > 0 && <p className="text-sm text-blue-600">🇱🇧 {trip.price_lbp.toLocaleString()} LBP</p>}
                <p className="text-sm text-gray-400">{new Date(trip.created_at).toLocaleDateString()}</p>
              </div>
            </div>
          ))}
        </div>
      )}

    </div>
  )
}