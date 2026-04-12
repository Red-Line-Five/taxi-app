'use client'
import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'

export default function Dashboard() {
  const [trips, setTrips] = useState<any[]>([])
  const [drivers, setDrivers] = useState<any[]>([])

  // Trip form
  const [customerName, setCustomerName] = useState('')
  const [pickup, setPickup] = useState('')
  const [dropoff, setDropoff] = useState('')
  const [selectedDriver, setSelectedDriver] = useState('')
  const [priceUsd, setPriceUsd] = useState('')
  const [priceLbp, setPriceLbp] = useState('')

  // Client search
  const [searchPhone, setSearchPhone] = useState('')
  const [foundClient, setFoundClient] = useState<any>(null)
  const [searchDone, setSearchDone] = useState(false)

  // Add client
  const [newName, setNewName] = useState('')
  const [newPhone, setNewPhone] = useState('')
  const [newAddress, setNewAddress] = useState('')

  useEffect(() => {
    fetchTrips()
    fetchDrivers()

    const channel = supabase
      .channel('profiles')
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'profiles'
      }, () => fetchDrivers())
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [])

  const fetchTrips = async () => {
    const { data } = await supabase
      .from('trips')
      .select('*')
      .order('created_at', { ascending: false })
    setTrips(data || [])
  }

  const fetchDrivers = async () => {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('role', 'driver')
      .order('is_online', { ascending: false })
    setDrivers(data || [])
  }

const searchClient = async () => {
    if (!searchPhone) return
    const { data } = await supabase
      .from('clients')
      .select('*')
      .eq('phone', searchPhone)
      .single()
    setSearchDone(true)
    if (data) {
      setFoundClient(data)
      setCustomerName(data.name)
      setPickup(data.address || '')
    } else {
      setFoundClient(null)
      // Auto-fill phone in Add Client
      setNewPhone(searchPhone)
    }
  }

const addClient = async () => {
    if (!newName || !newPhone) return
    const { error } = await supabase.from('clients').insert({
      name: newName,
      phone: newPhone,
      address: newAddress
    })
    if (!error) {
      // Auto-fill trip form
      setCustomerName(newName)
      setPickup(newAddress || '')
      alert('✅ Client added!')
      setNewName('')
      setNewPhone('')
      setNewAddress('')
    }
  }

const addTrip = async () => {
  if (!foundClient || !pickup || !dropoff) {
    alert('⚠️ Please select a client first!')
    return
  }
  await supabase.from('trips').insert({
    customer_name: foundClient.name,
    client_id: foundClient.id,
    pickup_location: pickup,
    dropoff_location: dropoff,
    status: 'pending',
    assigned_driver_id: selectedDriver || null,
    price_usd: parseFloat(priceUsd) || 0,
    price_lbp: parseFloat(priceLbp) || 0,
  })
  setPickup('')
  setDropoff('')
  setSelectedDriver('')
  setPriceUsd('')
  setPriceLbp('')
  setFoundClient(null)
  setSearchPhone('')
  setSearchDone(false)
  fetchTrips()
}

  const openWhatsApp = (phone: string) => {
    // Remove spaces and + from phone
    const cleaned = phone.replace(/\D/g, '')
    window.open(`https://wa.me/${cleaned}`, '_blank')
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    window.location.href = '/'
  }

  return (
    <div className="min-h-screen bg-gray-100 p-8">

    {/* Header */}
<div className="flex justify-between items-center mb-8">
  <h1 className="text-3xl font-bold text-yellow-500">🚖 Taxi Dashboard</h1>
  <div className="flex gap-3">
    <button
      onClick={() => window.location.href = '/report'}
      className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
    >
      📊 Reports
    </button>
    <button
      onClick={handleLogout}
      className="bg-gray-500 text-white px-4 py-2 rounded hover:bg-gray-600"
    >
      Logout
    </button>
  </div>
</div>

      {/* 3 sections side by side */}
      <div className="flex flex-col md:flex-row gap-4 mb-8">

        {/* Drivers Status */}
        <div className="bg-white p-4 rounded shadow flex-1">
          <h2 className="text-lg font-bold mb-3">🚗 Drivers</h2>
          {drivers.length === 0 && <p className="text-gray-400 text-black">No drivers.</p>}
          <div className="flex flex-col gap-3">
            {drivers.map((driver: any) => (
              <div
                key={driver.id}
                className={`p-3 rounded-lg border-2 ${
                  driver.is_online
                    ? 'border-green-400 bg-green-50'
                    : 'border-red-300 bg-red-50'
                }`}
              >
                <p className="font-bold">{driver.name}</p>
                <button
                  onClick={() => openWhatsApp(driver.phone)}
                  className="text-black text-green-600 hover:underline"
                >
                  📱 {driver.phone}
                </button>
                <p className={`text-black font-bold mt-1 ${
                  driver.is_online ? 'text-green-600' : 'text-red-500'
                }`}>
                  {driver.is_online ? '🟢 Online' : '🔴 Offline'}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Search Client */}
        <div className="bg-white p-4 rounded shadow flex-1">
          <h2 className="text-lg font-bold mb-3">🔍 Search Client</h2>
          <div className="flex gap-2 mb-3">
            <input
              className="flex-1 border p-2 rounded text-black"
              placeholder="Phone number..."
              value={searchPhone}
              onChange={(e) => setSearchPhone(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && searchClient()}
            />
            <button
              className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 text-black"
              onClick={searchClient}
            >
              Search
            </button>
          </div>

          {foundClient && (
            <div className="p-3 bg-green-50 rounded border border-green-200">
              <p className="font-bold text-green-800">✅ Found!</p>
              <p className="text-black">👤 {foundClient.name}</p>
              <button
                onClick={() => openWhatsApp(foundClient.phone)}
                className="text-black text-green-600 hover:underline"
              >
                📱 {foundClient.phone}
              </button>
              <p className="text-black">📍 {foundClient.address}</p>
              <p className="text-xs text-blue-500 mt-2">✅ Auto-filled in Add Trip!</p>
            </div>
          )}

          {searchDone && !foundClient && (
            <p className="text-red-500 text-black">❌ Client not found</p>
          )}
        </div>

        {/* Add Client */}
        <div className="bg-white p-4 rounded shadow flex-1">
          <h2 className="text-lg font-bold mb-3">➕ Add Client</h2>
          <input
            className="w-full border p-2 rounded mb-2 text-black"
            placeholder="Name"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
          />
          <input
            className="w-full border p-2 rounded mb-2 text-black"
            placeholder="Phone"
            value={newPhone}
            onChange={(e) => setNewPhone(e.target.value)}
          />
          <input
            className="w-full border p-2 rounded mb-3 text-black"
            placeholder="Address"
            value={newAddress}
            onChange={(e) => setNewAddress(e.target.value)}
          />
          <button
            className="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600 w-full text-black"
            onClick={addClient}
          >
            Add Client
          </button>
        </div>

      </div>

      {/* Add Trip */}
      <div className="bg-white p-6 rounded shadow mb-8">
        <h2 className="text-xl font-bold mb-4">🚗 Add New Trip</h2>
        {foundClient ? (
  <div className="w-full border p-3 rounded mb-3 bg-green-50 border-green-300">
    <p className="text-sm text-gray-500">Customer</p>
    <p className="font-bold text-black">👤 {foundClient.name}</p>
    <p className="text-sm text-black">📱 {foundClient.phone}</p>
    <p className="text-sm text-black">📍 {foundClient.address}</p>
  </div>
) : (
  <div className="w-full border p-3 rounded mb-3 bg-yellow-50 border-yellow-300">
    <p className="text-sm text-yellow-700">⚠️ Search or add a client first!</p>
  </div>
)}
        <input
          className="w-full border p-2 rounded mb-3"
          placeholder="Pickup Location"
          value={pickup}
          onChange={(e) => setPickup(e.target.value)}
        />
        <input
          className="w-full border p-2 rounded mb-3"
          placeholder="Dropoff Location"
          value={dropoff}
          onChange={(e) => setDropoff(e.target.value)}
        />
        <select
          className="w-full border p-2 rounded mb-3"
          value={selectedDriver}
          onChange={(e) => setSelectedDriver(e.target.value)}
        >
          <option value="">-- Select Driver --</option>
          {drivers.filter((d) => d.is_online).map((driver: any) => (
            <option key={driver.id} value={driver.id}>
              🟢 {driver.name}
            </option>
          ))}
        </select>
        <div className="flex gap-3 mb-3">
          <div className="flex-1">
            <label className="text-black text-gray-500 mb-1 block">💵 USD</label>
            <input
              className="w-full border p-2 rounded"
              type="number"
              placeholder="0.00"
              value={priceUsd}
              onChange={(e) => setPriceUsd(e.target.value)}
            />
          </div>
          <div className="flex-1">
            <label className="text-black text-gray-500 mb-1 block">🇱🇧 LBP</label>
            <input
              className="w-full border p-2 rounded"
              type="number"
              placeholder="0"
              value={priceLbp}
              onChange={(e) => setPriceLbp(e.target.value)}
            />
          </div>
        </div>
        <button
          className="bg-yellow-400 font-bold px-6 py-2 rounded hover:bg-yellow-500 w-full"
          onClick={addTrip}
        >
          Add Trip 🚖
        </button>
      </div>

      {/* All Trips */}
      <div className="bg-white p-6 rounded shadow">
        <h2 className="text-xl font-bold mb-4">📋 All Trips</h2>
        {trips.length === 0 && <p className="text-gray-500">No trips yet.</p>}
        {trips.map((trip: any) => (
          <div key={trip.id} className="border-b py-3">
            <p className="font-bold">{trip.customer_name}</p>
            <p className="text-black text-gray-600">
              📍 {trip.pickup_location} → {trip.dropoff_location}
            </p>
            <div className="flex gap-4 mt-1">
              {trip.price_usd > 0 && (
                <p className="text-black text-green-600">💵 ${trip.price_usd}</p>
              )}
              {trip.price_lbp > 0 && (
                <p className="text-black text-blue-600">🇱🇧 {trip.price_lbp.toLocaleString()} LBP</p>
              )}
            </div>
            <span className={`text-xs px-2 py-1 rounded mt-1 inline-block ${
              trip.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
              trip.status === 'active' ? 'bg-blue-100 text-blue-800' :
              'bg-green-100 text-green-800'
            }`}>
              {trip.status}
            </span>
          </div>
        ))}
      </div>

    </div>
  )
}