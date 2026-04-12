'use client'
import { useState, useEffect } from 'react'
import { supabase, anonKey } from '../../lib/supabase'


export default function DriversManagement() {
  const [drivers, setDrivers] = useState<any[]>([])
  const [newEmail, setNewEmail] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [newName, setNewName] = useState('')
  const [newPhone, setNewPhone] = useState('')
  const [newCommission, setNewCommission] = useState('10')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    fetchDrivers()
  }, [])

  const fetchDrivers = async () => {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('role', 'driver')
      .order('name')
    setDrivers(data || [])
  }

const addDriver = async () => {
    if (!newEmail || !newPassword || !newName || !newPhone) {
      setMessage('❌ Please fill all fields')
      return
    }
    setLoading(true)

const response = await fetch(
  'https://zfmpwqyntyadprmnogfj.supabase.co/functions/v1/create-driver',
  {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${anonKey || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`
    },
    body: JSON.stringify({
      email: newEmail,
      password: newPassword,
      name: newName,
      phone: newPhone,
      commission: parseFloat(newCommission) || 10,
      company_id: null
    })
  }
)

    const result = await response.json()

    if (result.error) {
      setMessage('❌ ' + result.error)
    } else {
      setMessage('✅ Driver added!')
      setNewEmail('')
      setNewPassword('')
      setNewName('')
      setNewPhone('')
      setNewCommission('10')
      fetchDrivers()
    }
    setLoading(false)
  }

  const deleteDriver = async (id: string, name: string) => {
    if (!confirm(`Delete driver ${name}?`)) return
    await supabase.from('profiles').delete().eq('id', id)
    setMessage('✅ Driver deleted!')
    fetchDrivers()
  }

  const updateCommission = async (id: string, percent: number) => {
    await supabase
      .from('profiles')
      .update({ commission_percent: percent })
      .eq('id', id)
    fetchDrivers()
  }

  return (
    <div className="min-h-screen bg-gray-100 p-8">

      {/* Header */}
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold text-yellow-500">👥 Drivers Management</h1>
        <button
          onClick={() => window.location.href = '/dashboard'}
          className="bg-gray-500 text-white px-4 py-2 rounded hover:bg-gray-600"
        >
          ← Dashboard
        </button>
      </div>

      {/* Add Driver */}
      <div className="bg-white p-6 rounded shadow mb-8">
        <h2 className="text-xl font-bold mb-4">➕ Add New Driver</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <input
            className="border p-2 rounded text-black"
            placeholder="Full Name"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
          />
          <input
            className="border p-2 rounded text-black"
            placeholder="Phone"
            value={newPhone}
            onChange={(e) => setNewPhone(e.target.value)}
          />
          <input
            className="border p-2 rounded text-black"
            placeholder="Email"
            type="email"
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
          />
          <input
            className="border p-2 rounded text-black"
            placeholder="Password"
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
          />
          <input
            className="border p-2 rounded text-black"
            placeholder="Commission %"
            type="number"
            value={newCommission}
            onChange={(e) => setNewCommission(e.target.value)}
          />
        </div>
        <button
          className="mt-4 bg-yellow-400 font-bold px-6 py-2 rounded hover:bg-yellow-500 disabled:opacity-50"
          onClick={addDriver}
          disabled={loading}
        >
          {loading ? 'Adding...' : 'Add Driver'}
        </button>
        {message && (
          <p className={`mt-3 text-sm ${message.includes('✅') ? 'text-green-600' : 'text-red-500'}`}>
            {message}
          </p>
        )}
      </div>

      {/* Drivers List */}
      <div className="bg-white p-6 rounded shadow">
        <h2 className="text-xl font-bold mb-4">🚗 All Drivers ({drivers.length})</h2>
        {drivers.length === 0 && <p className="text-gray-400">No drivers yet.</p>}
        {drivers.map((driver) => (
          <div key={driver.id} className="border-b py-4">
            <div className="flex justify-between items-start">
              <div>
                <p className="font-bold text-black text-lg">{driver.name}</p>
                <p className="text-sm text-gray-500">📞 {driver.phone}</p>
                <span className={`text-sm font-bold ${
                  driver.is_online ? 'text-green-600' : 'text-red-500'
                }`}>
                  {driver.is_online ? '🟢 Online' : '🔴 Offline'}
                </span>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2">
                  <label className="text-sm text-gray-500">Commission:</label>
                  <input
                    type="number"
                    className="border p-1 rounded w-16 text-black text-center"
                    value={driver.commission_percent}
                    onChange={(e) => updateCommission(driver.id, parseFloat(e.target.value))}
                  />
                  <span className="text-sm text-gray-500">%</span>
                </div>
                <button
                  onClick={() => deleteDriver(driver.id, driver.name)}
                  className="bg-red-500 text-white px-3 py-1 rounded hover:bg-red-600 text-sm"
                >
                  🗑️ Delete
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}