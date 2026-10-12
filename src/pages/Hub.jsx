const hand = "'Caveat', cursive"
const serif = "Georgia, 'Times New Roman', serif"
const sans = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, 'Noto Sans TC', sans-serif"
const mono = "ui-monospace, SFMono-Regular, Menlo, monospace"

const projects = [
  ['[001]', 'Wari Pay', 'SHARED EXPENSES / APP', '室友與朋友一起記帳、分攤與結清款項。', 'https://app.wari-pay.washcc.cc/', 'OPEN APP'],
  ['[002]', 'Cavy Path', 'IOS APP', '一筆畫解謎遊戲：帶著可愛的天竺鼠穿越農場關卡，用一條不重複的路徑完成每個挑戰。', 'https://apps.apple.com/us/app/cavy-path/id6802660141', 'APP STORE'],
  ['[003]', 'Wakeby', 'WEB APP / PROJECT', 'Wakeby 專案網站與服務入口。', 'https://wakeby.washcc.cc/', 'OPEN SITE'],
  ['[004]', 'Beat Countdown', 'IOS APP', '節拍倒數、懸浮計時器與節奏提示。', 'https://apps.apple.com/jp/app/%E7%AF%80%E6%8B%8D%E5%80%92%E6%95%B8-%E6%87%B8%E6%B5%AE%E8%A8%88%E6%99%82%E5%99%A8-%E7%AF%80%E5%A5%8F%E6%8F%90%E7%A4%BA/id6766092374', 'APP STORE'],
  ['[005]', 'Apple Ten', 'IOS GAME', '蘋果消消樂，Apple Ten number puzzle。', 'https://apps.apple.com/us/app/apple-ten-number-puzzle/id6764013326', 'APP STORE'],
]

export default function Hub() {
  useEffect(() => {
    const root = document.getElementById('root')
    if (!root) return undefined
    const previousMaxWidth = root.style.maxWidth
    root.style.maxWidth = 'none'
    return () => { root.style.maxWidth = previousMaxWidth }
  }, [])

  return <main style={{ minHeight: '100vh', background: '#f3f0e8', color: '#201d1d', fontFamily: sans }}>
    <style>{`@import url('https://fonts.googleapis.com/css2?family=Caveat:wght@500;600;700&display=swap');
    @media (max-width: 640px) {
      .hub-header-note { font-size: 16px !important; }
      .hub-intro { padding-top: 58px !important; }
      .hub-project-row { grid-template-columns: 48px minmax(0, 1fr) !important; gap: 10px !important; padding: 20px 0 !important; }
      .hub-project-info { min-width: 0; }
      .hub-project-title { overflow-wrap: anywhere; font-size: clamp(34px, 12vw, 52px) !important; }
      .hub-project-status { grid-column: 2; grid-row: 3; justify-self: start; margin-top: 2px; font-size: 16px !important; }
      .hub-footer { flex-direction: column; gap: 10px; }
    }`}</style>
    <header style={{ padding: '18px 20px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '16px' }}><a href="/" style={{ fontSize: '32px', fontWeight: 800, letterSpacing: '-0.08em', color: '#201d1d', textDecoration: 'none' }}>washcc.</a><span className="hub-header-note" style={{ fontFamily: hand, fontSize: '24px', transform: 'rotate(-5deg)', textAlign: 'right' }}>all my little things</span></header>
    <div style={{ background: '#201d1d', color: '#f3f0e8', padding: '7px 16px', display: 'flex', justifyContent: 'space-between', fontFamily: mono, fontSize: '11px', letterSpacing: '0.2em' }}><span>PROJECT ARCHIVE</span><span>WASHCC / 2026</span></div>
    <section className="hub-intro" style={{ maxWidth: '1120px', margin: '0 auto', padding: 'clamp(56px, 10vw, 120px) 20px 80px' }}>
      <p style={{ fontFamily: sans, fontSize: 'clamp(16px, 2vw, 22px)', margin: '0 0 18px', textDecoration: 'underline', textUnderlineOffset: '7px' }}>a small archive of apps</p>
      <h1 style={{ fontFamily: serif, fontSize: 'clamp(56px, 11vw, 150px)', lineHeight: '0.82', letterSpacing: '-0.07em', fontWeight: 400, margin: 0 }}>Things<br />I made.</h1>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '34px', marginTop: '74px', alignItems: 'end' }}><p style={{ fontFamily: sans, fontSize: '14px', lineHeight: 1.8, maxWidth: '420px', margin: 0 }}>A shared home for independent apps, experiments, and the pages that explain them. Select a project below to enter.</p><p style={{ fontFamily: hand, fontSize: '28px', margin: 0, transform: 'rotate(3deg)' }}>↓ choose your adventure</p></div>
      <div style={{ marginTop: '80px', borderTop: '1px solid #201d1d' }}>{projects.map(([number, name, type, description, href, status]) => { const Tag = href ? 'a' : 'div'; return <Tag className="hub-project-row" key={number} href={href || undefined} style={{ color: '#201d1d', textDecoration: 'none', display: 'grid', gridTemplateColumns: '80px minmax(0, 1fr) auto', gap: '18px', alignItems: 'center', padding: '24px 0', borderBottom: '1px solid #201d1d' }}><span style={{ fontFamily: mono, fontSize: '12px' }}>{number}</span><span className="hub-project-info"><span className="hub-project-title" style={{ display: 'block', fontFamily: serif, fontSize: 'clamp(30px, 5vw, 58px)', lineHeight: 1, letterSpacing: '-0.04em' }}>{name}</span><span style={{ display: 'block', marginTop: '10px', fontFamily: mono, fontSize: '10px', letterSpacing: '0.14em' }}>{type}</span><span style={{ display: 'block', marginTop: '8px', fontFamily: sans, fontSize: '14px', lineHeight: 1.5 }}>{description}</span></span><span className="hub-project-status" style={{ fontFamily: hand, fontSize: '20px', whiteSpace: 'nowrap', transform: 'rotate(-4deg)' }}>{status} {href ? '↗' : ''}</span></Tag> })}</div>
    </section>
    <footer className="hub-footer" style={{ borderTop: '1px solid #201d1d', padding: '20px', display: 'flex', justifyContent: 'space-between', fontFamily: sans, fontSize: '14px' }}><span>© 2026 CC Studio. All rights reserved.</span><span style={{ fontFamily: mono, fontSize: '10px', letterSpacing: '0.12em' }}>MADE WITH CURIOSITY</span></footer>
  </main>
}
import { useEffect } from 'react'
