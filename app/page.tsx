// import { redirect } from "next/navigation";

// export default function RootPage() {
//   redirect("/home");
// }

import { createClient } from '@/utils/supabase/server'
import { cookies } from 'next/headers'

export default async function HomePage() {
  const cookieStore = await cookies()
  const supabase = createClient(cookieStore)

  // Cek koneksi Supabase (bebas ganti nama tabel jika sudah buat tabel)
  const { data, error } = await supabase.from('employees').select('*')

  return (
    <div className="p-8 font-sans">
      <h1 className="text-2xl font-bold mb-4">CCR System - Kelompok C1</h1>
      <p className="text-gray-600 mb-2">Status Koneksi Supabase:</p>
      
      {error ? (
        <div className="p-4 bg-red-100 text-red-700 rounded-md">
           Error Koneksi/Tabel Belum Ada: {error.message}
        </div>
      ) : (
        <div className="p-4 bg-green-100 text-green-700 rounded-md">
           Koneksi Supabase Berhasil! Data Karyawan: {data?.length ?? 0} orang.
        </div>
      )}
    </div>
  )
}
