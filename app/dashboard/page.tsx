'use client'
import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'

export default function Dashboard() {
  const [trips, setTrips] = useState<any[]>([])
  const [customerName, setCustomerName] = useState('')
  const [pickup, setPickup] = useState('')
  const [dropoff, setDropoff] = useState('')

  useEffect(() => {
    fetchTrips()
  }, [])

  const fetchTrips = async () => {
    const { data } = await supabase
      .from('trips')
      .select('*')
      .order('created_at', { ascending: false })
    setTrips(data || [])
  }

  const addTrip = async () => {
    if (!customerName || !pickup || !dropoff) return
    await supabase.from('trips').insert({
      customer_name: customerName,
      pickup_location: pickup,
      dropoff_location: dropoff,
      status: 'pending'
    })
    setCustomerName('')
    setPickup('')
    setDropoff('')
    fetchTrips()
  }

  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <h1 className="text-3xl font-bold mb-8">🚖 Taxi Dashboard</h1>

      {/* Add Trip */}
      <div className="bg-white p-6 rounded shadow mb-8">
        <h2 className="text-xl font-bold mb-4">➕ Add New Trip</h2>
        <input
          className="w-full border p-2 rounded mb-3"
          placeholder="Customer Name"
          value={customerName}
          onChange={(e) => setCustomerName(e.target.value)}
        />
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
        <button
          className="bg-yellow-400 font-bold px-6 py-2 rounded hover:bg-yellow-500"
          onClick={addTrip}
        >
          Add Trip
        </button>
      </div>

      {/* Trips List */}
      <div className="bg-white p-6 rounded shadow">
        <h2 className="text-xl font-bold mb-4">📋 All Trips</h2>
        {trips.length === 0 && <p className="text-gray-500">No trips yet.</p>}
        {trips.map((trip: any) => (
          <div key={trip.id} className="border-b py-3">
            <p className="font-bold">{trip.customer_name}</p>
            <p className="text-sm text-gray-600">📍 {trip.pickup_location} → {trip.dropoff_location}</p>
            <span className={`text-xs px-2 py-1 rounded ${
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