import { AlertCircle, Check, ChevronRight, Loader2, Power, RefreshCw, Trash2 } from 'lucide-react';
import { AnimatePresence, motion, MotionConfig } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Tooltip } from '@/components/ui/tooltip';
import AlwaysInfoButton from '../LyricVideoStudio/AlwaysInfoButton';

const UserPreferencesLayout = ({
  activeCategory,
  activeCategoryBg,
  categories,
  children,
  companionRunning,
  companionStarting,
  contentDirection = 0,
  contentKey,
  darkMode,
  handleNdiCheckForUpdate,
  handleNdiLaunch,
  handleNdiStop,
  handleNdiUninstall,
  labelClass,
  lastSaved,
  mutedClass,
  ndiCheckingUpdate,
  ndiStatus,
  panelBg,
  saveError,
  saving,
  setActiveCategory,
  hideContentHeader = false,
}) => {
  const { t } = useTranslation();

  return (
    <div className="flex flex-col h-[500px]">
    <div className="flex flex-1 min-h-0">
      <div className={`w-52 shrink-0 border-r ${darkMode ? 'border-gray-700' : 'border-gray-200'} ${panelBg}`}>
        <nav className="p-2 space-y-1">
          {categories.map((category) => {
            const Icon = category.icon;
            const isActive = activeCategory === category.id;
            return (
              <button
                key={category.id}
                onClick={() => setActiveCategory(category.id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors ${isActive
                  ? `${activeCategoryBg} ${darkMode ? 'text-white' : 'text-gray-900'} shadow-sm`
                  : `${darkMode ? 'text-gray-400 hover:text-gray-300 hover:bg-gray-700/50' : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'}`
                  }`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span className="text-sm font-medium truncate">{category.label}</span>
                {isActive && <ChevronRight className="w-4 h-4 ml-auto shrink-0" />}
              </button>
            );
          })}
        </nav>
      </div>

      <div className="relative min-w-0 flex-1 overflow-hidden">
        <MotionConfig reducedMotion="user">
          <AnimatePresence initial={false} mode="wait" custom={contentDirection}>
            <motion.div
              key={contentKey || activeCategory}
              custom={contentDirection}
              variants={{
                enter: (direction) => ({ opacity: 0, x: direction * 28 }),
                center: { opacity: 1, x: 0 },
                exit: (direction) => ({ opacity: 0, x: direction * -28 }),
              }}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.18, ease: 'easeOut' }}
              className="absolute inset-0 overflow-y-auto p-6"
            >
              {!hideContentHeader && (
                <div className="mb-6 flex items-center justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-2">
                    <h3 className={`text-lg font-semibold ${labelClass}`}>
                      {categories.find(c => c.id === activeCategory)?.label}
                    </h3>
                    {categories.find(c => c.id === activeCategory)?.info && (
                      <AlwaysInfoButton
                        side="left"
                        ariaLabel={`About ${categories.find(c => c.id === activeCategory)?.label}`}
                        content={categories.find(c => c.id === activeCategory)?.info}
                      />
                    )}
                  </div>
                  {activeCategory === 'ndi' && ndiStatus.installed && (
                    <div className="flex items-center gap-2 shrink-0">
                      {!companionRunning ? (
                        <Tooltip content={t('preferences.ndi.toolbar.launchTooltip')} side="bottom">
                          <Button size="sm" onClick={handleNdiLaunch} disabled={companionStarting} className={`${darkMode ? 'bg-green-600 hover:bg-green-700' : 'bg-green-500 hover:bg-green-600'} text-white`}>
                            {companionStarting ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Power className="w-3.5 h-3.5 mr-1.5" />}
                            {companionStarting ? t('preferences.ndi.status.starting') : t('preferences.ndi.toolbar.launch')}
                          </Button>
                        </Tooltip>
                      ) : (
                        <Tooltip content={t('preferences.ndi.toolbar.stopTooltip')} side="bottom">
                          <Button size="sm" onClick={handleNdiStop} className={`${darkMode ? 'bg-red-600 hover:bg-red-700' : 'bg-red-500 hover:bg-red-600'} text-white`}>
                            <Power className="w-3.5 h-3.5 mr-1.5" />
                            {t('preferences.ndi.toolbar.stop')}
                          </Button>
                        </Tooltip>
                      )}
                      <Tooltip content={t('preferences.ndi.toolbar.checkUpdatesTooltip')} side="bottom">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={handleNdiCheckForUpdate}
                          disabled={ndiCheckingUpdate}
                          className={darkMode ? 'bg-gray-800 border-gray-600 hover:bg-gray-700 text-gray-300' : ''}
                        >
                          {ndiCheckingUpdate ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                        </Button>
                      </Tooltip>
                      <Tooltip content={t('preferences.ndi.toolbar.uninstallTooltip')} side="bottom">
                        <Button
                          size="sm"
                          variant="destructiveOutline"
                          onClick={handleNdiUninstall}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </Tooltip>
                    </div>
                  )}
                </div>
              )}
              {children}
            </motion.div>
          </AnimatePresence>
        </MotionConfig>
      </div>
    </div>

    <div className={`flex items-center justify-center border-t px-6 py-3 shrink-0 rounded-b-2xl ${darkMode ? 'border-white/5 bg-slate-950/45' : 'border-slate-900/5 bg-[#f8fafc]'}`}>
      <div className={`text-xs ${mutedClass} flex items-center gap-2`}>
        {saving ? (
          <>
            <Loader2 className="w-3 h-3 animate-spin" />
            <span>{t('preferences.status.saving')}</span>
          </>
        ) : saveError ? (
          <>
            <AlertCircle className={`w-3 h-3 ${darkMode ? 'text-red-400' : 'text-red-600'}`} />
            <span className={darkMode ? 'text-red-400' : 'text-red-600'}>
              {t('preferences.status.saveError', { defaultValue: 'Settings could not be saved' })}
            </span>
          </>
        ) : lastSaved ? (
          <>
            <Check className={`w-3 h-3 ${darkMode ? 'text-green-400' : 'text-green-600'}`} />
            <span className={darkMode ? 'text-green-400' : 'text-green-600'}>{t('preferences.status.saved')}</span>
          </>
        ) : (
          <span>{t('preferences.status.autoSaved')}</span>
        )}
      </div>
    </div>
    </div>
  );
};

export default UserPreferencesLayout;
