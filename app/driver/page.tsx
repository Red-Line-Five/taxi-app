'use client'
import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'

export default function DriverPage() {

  const [trips, setTrips] = useState<any[]>([])

  useEffect(() => {
    fetchTrips()
  }, [])

const fetchTrips = async () => {
    const { data } = await supabase
      .from('trips')
      .select('*')
      .in('status', ['pending', 'active'])
      .order('created_at', { ascending: false })
    setTrips(data || [])
  }

  const acceptTrip = async (id: string) => {
    await supabase
      .from('trips')
      .update({ status: 'active' })
      .eq('id', id)
    fetchTrips()
  }

  const completeTrip = async (id: string) => {
    await supabase
      .from('trips')
      .update({ status: 'done' })
      .eq('id', id)
    fetchTrips()
  }

  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <h1 className="text-3xl font-bold mb-8">🚗 Driver Page</h1>

      {trips.length === 0 && (
        <p className="text-gray-500">No pending trips.</p>
      )}

      {trips.map((trip: any) => (
        <div key={trip.id} className="bg-white p-6 rounded shadow mb-4">
          <p className="font-bold text-lg">{trip.customer_name}</p>
          <p className="text-sm text-gray-600 mb-1">
            📍 Pickup: {trip.pickup_location}
          </p>
          <p className="text-sm text-gray-600 mb-4">
            🏁 Dropoff: {trip.dropoff_location}
          </p>
          <div className="flex gap-3">
            <button
              className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
              onClick={() => acceptTrip(trip.id)}
            >
              ✅ Accept
            </button>
            <button
              className="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600"
              onClick={() => completeTrip(trip.id)}
            >
              🏁 Complete
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}