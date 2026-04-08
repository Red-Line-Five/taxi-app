'use client'
import { useState } from 'react'
import { supabase } from '../lib/supabase'

export default function Home() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [message, setMessage] = useState('')

const handleLogin = async () => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    })
    if (error) {
      setMessage('Error: ' + error.message)
    } else {
      window.location.href = '/dashboard'
    }
  }

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center">
      <div className="bg-white p-8 rounded shadow-md w-96">
        <h1 className="text-2xl font-bold mb-6 text-center">🚖 Taxi App</h1>
        <input
          className="w-full border p-2 rounded mb-4"
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <input
          className="w-full border p-2 rounded mb-4"
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <button
          className="w-full bg-yellow-400 text-black font-bold p-2 rounded hover:bg-yellow-500"
          onClick={handleLogin}
        >
          Login
        </button>
        {message && <p className="mt-4 text-center text-sm">{message}</p>}
      </div>
    </div>
  )
}