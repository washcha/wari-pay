import { useNavigate } from 'react-router-dom'
import { LuChevronLeft } from 'react-icons/lu'
import { useApp } from '../contexts/AppContext'
import wariPayLogo from '../assets/waripay.png'

export default function PrivacyPolicy() {
  const navigate = useNavigate()
  const { user } = useApp()

  const handleBack = () => {
    if (user) {
      navigate(-1)
    } else {
      navigate('/login')
    }
  }

  return (
    <div className="min-h-screen bg-brand-cream">
      <div className="bg-brand-deep text-white px-4 pt-10 pb-4 flex items-center gap-2">
        <button
          onClick={handleBack}
          className="text-white pr-1 hover:bg-white/15 rounded-full w-9 h-9 flex items-center justify-center flex-shrink-0"
        >
          <LuChevronLeft className="w-6 h-6" />
        </button>
        <h1 className="font-bold text-lg">隱私權政策</h1>
      </div>

      <div className="max-w-2xl mx-auto px-5 py-8">
        <div className="bg-white rounded-2xl shadow-sm p-6 space-y-7">

          <div className="flex items-center gap-3 pb-2 border-b border-gray-100">
            <img src={wariPayLogo} alt="Wari Pay" className="w-10 h-10 object-contain" />
            <div>
              <p className="font-bold text-brand-deep text-base">哇哩 Wari Pay 隱私權政策</p>
              <p className="text-brand-mid/50 text-xs">最後更新：2026 年 6 月 26 日</p>
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-brand-mid text-sm leading-relaxed">
              哇哩 Wari Pay（以下簡稱「本服務」）是一款透過 LINE 使用的分帳工具。我們重視您的隱私，本政策說明本服務涉及哪些資料、如何運作，以及您的相關權利。
            </p>
          </div>

          <div className="space-y-3">
            <h2 className="font-bold text-brand-deep text-sm uppercase tracking-wider">我們取得的資料</h2>
            <div className="space-y-3 text-brand-mid text-sm leading-relaxed">
              <p>
                <strong className="text-brand-deep">LINE 帳號資訊</strong><br />
                登入時透過 LINE LIFF 取得您的 LINE 使用者 ID、顯示名稱與大頭貼圖片，用於識別帳號與在房間中顯示成員資訊。
              </p>
              <p>
                <strong className="text-brand-deep">您輸入的分帳內容</strong><br />
                房間名稱、費用項目名稱、金額、類別與日期，均由您主動輸入。這些內容儲存於您的帳號下，僅用於房間內的分攤計算與結算顯示，我們不會存取、分析或用於其他任何目的。
              </p>
              <p>
                <strong className="text-brand-deep">匿名使用行為</strong><br />
                透過 Vercel Analytics 收集操作事件（如登入、新增費用），不含任何個人識別資訊，僅用於了解整體使用趨勢以改善服務。
              </p>
            </div>
          </div>

          <div className="space-y-3">
            <h2 className="font-bold text-brand-deep text-sm uppercase tracking-wider">第三方服務</h2>
            <div className="space-y-2 text-brand-mid text-sm leading-relaxed">
              <p><strong className="text-brand-deep">Supabase</strong> — 帳號與分帳資料的雲端資料庫。</p>
              <p><strong className="text-brand-deep">Vercel</strong> — 本服務的部署平台，提供匿名 Analytics。</p>
              <p><strong className="text-brand-deep">LINE</strong> — 登入功能使用 LINE LIFF SDK，受 LINE 隱私權政策規範。</p>
            </div>
            <p className="text-brand-mid/50 text-xs">
              我們不會將您的個人資料出售或提供給任何第三方。
            </p>
          </div>

          <div className="space-y-3">
            <h2 className="font-bold text-brand-deep text-sm uppercase tracking-wider">資料保留與刪除</h2>
            <p className="text-brand-mid text-sm leading-relaxed">
              您的帳號及分帳資料將持續保留至您要求刪除為止。若希望刪除帳號及所有相關資料，請透過下方聯絡方式與我們聯繫，我們將於 7 個工作天內處理完畢。
            </p>
          </div>

          <div className="space-y-3">
            <h2 className="font-bold text-brand-deep text-sm uppercase tracking-wider">您的權利</h2>
            <ul className="text-brand-mid text-sm leading-relaxed space-y-1.5 list-none">
              <li>· 查閱、更正或刪除您的個人資料</li>
              <li>· 要求停止處理您的資料</li>
              <li>· 隨時退出房間（帳號資料不會自動刪除，需另行申請）</li>
            </ul>
          </div>

          <div className="space-y-2 pt-1 border-t border-gray-100">
            <h2 className="font-bold text-brand-deep text-sm uppercase tracking-wider">聯絡我們</h2>
            <p className="text-brand-mid text-sm leading-relaxed">
              如有任何隱私相關問題或刪除帳號申請，請寄信至：
            </p>
            <a
              href="mailto:s840835@gmail.com"
              className="inline-block text-brand-deep font-medium text-sm underline underline-offset-2"
            >
              s840835@gmail.com
            </a>
          </div>

          <p className="text-brand-mid/40 text-xs text-center pt-1">
            本政策如有變更，將於本頁面更新日期並公告。
          </p>
        </div>
      </div>
    </div>
  )
}
