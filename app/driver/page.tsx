'use client'
import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'

export default function DriverPage() {
  const [trips, setTrips] = useState<any[]>([])
  const [isOnline, setIsOnline] = useState(false)
  const [userId, setUserId] = useState<string | null>(null)
  const [driverName, setDriverName] = useState('')

  useEffect(() => {
    getDriverInfo()
    fetchTrips()

    // Real-time — iza trip jdide byibyin automatically
    const channel = supabase
      .channel('trips')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'trips'
      }, () => {
        fetchTrips()
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  const getDriverInfo = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    setUserId(user.id)

    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single()

    if (profile) {
      setIsOnline(profile.is_online)
      setDriverName(profile.name)
    }
  }

  const toggleOnline = async () => {
    if (!userId) return
    const newStatus = !isOnline
    setIsOnline(newStatus)

    await supabase
      .from('profiles')
      .update({ is_online: newStatus })
      .eq('id', userId)
  }

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

  const handleLogout = async () => {
    // Set offline before logout
    if (userId) {
      await supabase
        .from('profiles')
        .update({ is_online: false })
        .eq('id', userId)
    }
    await supabase.auth.signOut()
    window.location.href = '/'
  }

  return (
    <div className="min-h-screen bg-gray-100 p-8">

      {/* Header */}
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold">🚗 {driverName || 'Driver'}</h1>
        <button
          onClick={handleLogout}
          className="bg-gray-500 text-white px-4 py-2 rounded hover:bg-gray-600"
        >
          Logout
        </button>
      </div>

      {/* Online/Offline Toggle */}
      <div className="bg-white p-6 rounded shadow mb-8">
        <h2 className="text-xl font-bold mb-4">Status</h2>
        <div className="flex items-center gap-4">
          <span className={`text-lg font-bold ${isOnline ? 'text-green-500' : 'text-red-500'}`}>
            {isOnline ? '🟢 Online' : '🔴 Offline'}
          </span>
          <button
            onClick={toggleOnline}
            className={`px-6 py-2 rounded-full font-bold text-white transition-all ${
              isOnline
                ? 'bg-red-500 hover:bg-red-600'
                : 'bg-green-500 hover:bg-green-600'
            }`}
          >
            {isOnline ? 'Go Offline' : 'Go Online'}
          </button>
        </div>
      </div>

      {/* Trips */}
      <div className="bg-white p-6 rounded shadow">
        <h2 className="text-xl font-bold mb-4">📋 Available Trips</h2>

        {!isOnline && (
          <p className="text-gray-400 italic">You are offline — go online to see trips.</p>
        )}

        {isOnline && trips.length === 0 && (
          <p className="text-gray-500">No trips available.</p>
        )}

        {isOnline && trips.map((trip: any) => (
          <div key={trip.id} className="border-b py-4">
            <p className="font-bold text-lg">{trip.customer_name}</p>
            <p className="text-sm text-gray-600 mb-1">📍 Pickup: {trip.pickup_location}</p>
            <p className="text-sm text-gray-600 mb-3">🏁 Dropoff: {trip.dropoff_location}</p>
            <span className={`text-xs px-2 py-1 rounded mr-3 ${
              trip.status === 'pending'
                ? 'bg-yellow-100 text-yellow-800'
                : 'bg-blue-100 text-blue-800'
            }`}>
              {trip.status}
            </span>
            <div className="flex gap-3 mt-3">
              {trip.status === 'pending' && (
                <button
                  className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
                  onClick={() => acceptTrip(trip.id)}
                >
                  ✅ Accept
                </button>
              )}
              {trip.status === 'active' && (
                <button
                  className="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600"
                  onClick={() => completeTrip(trip.id)}
                >
                  🏁 Complete
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}