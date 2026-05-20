import { Navbar } from '../components/Navbar'

export function ReportesPage() {
  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#08090f' }}>
      <Navbar showNav />
      <div style={{ padding: '40px 24px', color: '#f0f1f7' }}>
        <h1 style={{ fontFamily: 'Bricolage Grotesque', fontSize: '32px', fontWeight: 800 }}>
          Informes
        </h1>
      </div>
    </div>
  )
}
