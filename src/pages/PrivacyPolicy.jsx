import { useNavigate } from 'react-router-dom'
import { LuChevronLeft } from 'react-icons/lu'
import { useApp } from '../contexts/AppContext'
import wariPayLogo from '../assets/waripay.png'

export default function PrivacyPolicy() {
  const navigate = useNavigate()
  const { user, t } = useApp()

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
        <h1 className="font-bold text-lg">{t('privacyPage.pageTitle')}</h1>
      </div>

      <div className="max-w-2xl mx-auto px-5 py-8">
        <div className="bg-white rounded-2xl shadow-sm p-6 space-y-7">

          <div className="flex items-center gap-3 pb-2 border-b border-gray-100">
            <img src={wariPayLogo} alt="Wari Pay" className="w-10 h-10 object-contain" />
            <div>
              <p className="font-bold text-brand-deep text-base">{t('privacyPage.title')}</p>
              <p className="text-brand-mid/50 text-xs">{t('privacyPage.updatedAt')}</p>
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-brand-mid text-sm leading-relaxed">
              {t('privacyPage.intro')}
            </p>
          </div>

          <div className="space-y-3">
            <h2 className="font-bold text-brand-deep text-sm uppercase tracking-wider">{t('privacyPage.dataTitle')}</h2>
            <div className="space-y-3 text-brand-mid text-sm leading-relaxed">
              <p>
                <strong className="text-brand-deep">{t('privacyPage.lineTitle')}</strong><br />
                {t('privacyPage.lineBody')}
              </p>
              <p>
                <strong className="text-brand-deep">{t('privacyPage.contentTitle')}</strong><br />
                {t('privacyPage.contentBody')}
              </p>
              <p>
                <strong className="text-brand-deep">{t('privacyPage.analyticsTitle')}</strong><br />
                {t('privacyPage.analyticsBody')}
              </p>
            </div>
          </div>

          <div className="space-y-3">
            <h2 className="font-bold text-brand-deep text-sm uppercase tracking-wider">{t('privacyPage.thirdPartyTitle')}</h2>
            <div className="space-y-2 text-brand-mid text-sm leading-relaxed">
              <p>{t('privacyPage.supabase')}</p>
              <p>{t('privacyPage.vercel')}</p>
              <p>{t('privacyPage.line')}</p>
            </div>
            <p className="text-brand-mid/50 text-xs">
              {t('privacyPage.noSale')}
            </p>
          </div>

          <div className="space-y-3">
            <h2 className="font-bold text-brand-deep text-sm uppercase tracking-wider">{t('privacyPage.retentionTitle')}</h2>
            <p className="text-brand-mid text-sm leading-relaxed">
              {t('privacyPage.retentionBody')}
            </p>
          </div>

          <div className="space-y-3">
            <h2 className="font-bold text-brand-deep text-sm uppercase tracking-wider">{t('privacyPage.rightsTitle')}</h2>
            <ul className="text-brand-mid text-sm leading-relaxed space-y-1.5 list-none">
              <li>{t('privacyPage.rightView')}</li>
              <li>{t('privacyPage.rightStop')}</li>
              <li>{t('privacyPage.rightLeave')}</li>
            </ul>
          </div>

          <div className="space-y-2 pt-1 border-t border-gray-100">
            <h2 className="font-bold text-brand-deep text-sm uppercase tracking-wider">{t('privacyPage.contactTitle')}</h2>
            <p className="text-brand-mid text-sm leading-relaxed">
              {t('privacyPage.contactBody')}
            </p>
            <a
              href="mailto:s840835@gmail.com"
              className="inline-block text-brand-deep font-medium text-sm underline underline-offset-2"
            >
              {t('privacyPage.contactEmail')}
            </a>
          </div>

          <p className="text-brand-mid/40 text-xs text-center pt-1">
            {t('privacyPage.footer')}
          </p>
        </div>
      </div>
    </div>
  )
}
