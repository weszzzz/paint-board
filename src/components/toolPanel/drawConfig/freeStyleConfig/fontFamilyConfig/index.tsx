import useDrawStore from '@/store/draw'
import { useTranslation } from 'react-i18next'
import { FC, useEffect, useState, useCallback } from 'react'
import {
  getSystemFonts,
  getSystemPermissionStatus,
  resetSystemPermission,
  webFonts,
  loadFontFace
} from '@/utils/common/fonts'
import {
  updateSelectedTextFont,
  updateSelectedTextStyles,
  updateSelectedTextStroke,
  updateSelectedTextShadow,
  updateSelectedTextColor
} from '@/utils/element/draw/text'
import TextEffectConfig from '../textEffectConfig'

interface IProps {
  fontFamily?: string
  updateFontFamily?: (fontFamily: string) => void
}

interface FontGroup {
  family: string
  styles: {
    fullName: string
    style: string
  }[]
}

// 添加 toast 类型声明
declare global {
  interface Window {
    toast?: {
      loading?: (message: string) => () => void
      error?: (message: string) => void
    }
  }
}

const FontFamilyConfg: FC<IProps> = ({ fontFamily, updateFontFamily }) => {
  const {
    textFontFamily,
    favoriteFonts,
    updateTextFontFamily,
    toggleFavoriteFont,
    initFavoriteFonts,
    fontStyles,
    updateFontStyles
  } = useDrawStore()
  const { t } = useTranslation()
  const [systemFonts, setSystemFonts] = useState<FontGroup[]>([])
  const [selectedCategory, setSelectedCategory] = useState<'system' | 'web'>(
    'web'
  )
  const [lastFavoriteClick, setLastFavoriteClick] = useState<number>(0)
  const [forceUpdate, setForceUpdate] = useState<number>(0)

  const loadSystemFonts = useCallback(async () => {
    const fonts = await getSystemFonts()
    if (fonts) {
      setSystemFonts(fonts)
      setForceUpdate((prev) => prev + 1)
    }
  }, [])

  useEffect(() => {
    loadSystemFonts()
    initFavoriteFonts()
  }, [loadSystemFonts])

  useEffect(() => {
    const handleFontChange = () => {
      loadSystemFonts()
    }
    document.fonts.addEventListener('loadingdone', handleFontChange)
    return () => {
      document.fonts.removeEventListener('loadingdone', handleFontChange)
    }
  }, [loadSystemFonts])

  const handleSystemFontsClick = () => {
    if (systemFonts.length === 0 && getSystemPermissionStatus() !== false) {
      resetSystemPermission()
      loadSystemFonts()
    }
    setSelectedCategory('system')
  }

  const handleRefreshFonts = async () => {
    if (selectedCategory === 'system') {
      resetSystemPermission()
      await loadSystemFonts()
    }
  }

  const formatFontName = useCallback((family: string, style?: string) => {
    if (/[\u4E00-\u9FA5]/.test(family)) {
      if (style && /[\u4E00-\u9FA5]/.test(style)) {
        return style
      }
      return family
    }
    if (!style || style.toLowerCase() === 'regular') {
      return family
    }
    return `${family} ${style}`
  }, [])

  const isFontSelected = useCallback(
    (currentFont: string, currentStyle?: string): boolean => {
      const formattedFont = formatFontName(currentFont, currentStyle)
      const selectedFont = fontFamily || textFontFamily
      return Boolean(
        formattedFont === selectedFont ||
          currentFont === selectedFont ||
          (currentStyle && `${currentFont} ${currentStyle}` === selectedFont)
      )
    },
    [fontFamily, textFontFamily, formatFontName]
  )

  const handleFontChange = useCallback(
    async (font: string, style?: string) => {
      try {
        const fullFontName = formatFontName(font, style)
        console.log('Loading font:', { font, style, fullFontName })

        const loadingToast = window.toast?.loading?.('Loading font...')

        await loadFontFace(fullFontName)

        updateTextFontFamily(fullFontName)
        updateFontFamily?.(fullFontName)
        updateSelectedTextFont()

        const { fontStyles: currentFontStyles } = useDrawStore.getState()

        updateSelectedTextColor()
        updateSelectedTextStroke()
        updateSelectedTextShadow()

        if (style) {
          const newStyles: string[] = []
          const lowerStyle = style.toLowerCase()

          while (currentFontStyles.length > 0) {
            updateFontStyles(currentFontStyles[0])
          }

          if (lowerStyle.includes('bold')) {
            updateFontStyles('bold')
            newStyles.push('bold')
          }
          if (lowerStyle.includes('italic')) {
            updateFontStyles('italic')
            newStyles.push('italic')
          }

          updateSelectedTextStyles()
        }

        setForceUpdate((prev) => prev + 1)
        loadingToast?.()
      } catch (err) {
        console.error('Failed to load font:', font, style, err)
        const fallbackFont = /[\u4E00-\u9FA5]/.test(font)
          ? '微软雅黑'
          : 'sans-serif'
        updateTextFontFamily(fallbackFont)
        updateFontFamily?.(fallbackFont)
        updateSelectedTextFont()

        window.toast?.error?.('Failed to load font')
      }
    },
    [
      updateFontFamily,
      updateTextFontFamily,
      formatFontName,
      fontStyles,
      updateFontStyles
    ]
  )

  const handleFavoriteClick = useCallback(
    (family: string, e: React.MouseEvent) => {
      e.stopPropagation()
      e.preventDefault()

      const now = Date.now()
      if (now - lastFavoriteClick < 300) {
        return
      }
      setLastFavoriteClick(now)

      if (favoriteFonts.includes(family)) {
        const confirmResult = window.confirm(
          String(t('font.confirmUnfavorite'))
        )
        if (confirmResult) {
          toggleFavoriteFont(family)
        }
      } else {
        toggleFavoriteFont(family)
      }
    },
    [favoriteFonts, lastFavoriteClick, t, toggleFavoriteFont]
  )

  const renderFontList = () => {
    let fonts: FontGroup[] = []
    switch (selectedCategory) {
      case 'system':
        fonts = systemFonts
        break
      case 'web':
        fonts = Object.keys(webFonts).map((font) => ({
          family: font,
          styles: [{ fullName: font, style: 'Regular' }]
        }))
        break
    }

    const sortedFonts = [
      ...fonts.filter((font) => favoriteFonts.includes(font.family)),
      ...fonts.filter((font) => !favoriteFonts.includes(font.family))
    ]

    return (
      <div className="max-h-300 overflow-y-auto">
        {sortedFonts.map((fontGroup) => (
          <div key={`${fontGroup.family}-${forceUpdate}`} className="mb-2">
            {fontGroup.styles.length === 1 ? (
              <div className="flex items-center w-full">
                <div className="flex-none w-8">
                  <button
                    className={`btn btn-xs btn-ghost no-hover-effect ${
                      favoriteFonts.includes(fontGroup.family)
                        ? 'text-warning'
                        : 'text-base-content'
                    }`}
                    onClick={(e) => handleFavoriteClick(fontGroup.family, e)}
                    title={String(
                      favoriteFonts.includes(fontGroup.family)
                        ? t('font.unfavorite')
                        : t('font.favorite')
                    )}
                  >
                    <span className="favorite-icon">
                      {favoriteFonts.includes(fontGroup.family) ? '★' : '☆'}
                    </span>
                  </button>
                </div>
                <label className="flex-1 flex justify-between items-center ml-2 cursor-pointer">
                  <div className="flex-1 flex justify-between items-center">
                    <span className="text-sm">{fontGroup.family}</span>
                    <div>
                      <span
                        className="text-xs text-gray-500 mr-2"
                        style={{
                          fontFamily: /[\u4E00-\u9FA5]/.test(fontGroup.family)
                            ? `${fontGroup.family}, sans-serif`
                            : `"${fontGroup.family}", sans-serif`
                        }}
                      >
                        测试 ABC
                      </span>
                      <input
                        type="radio"
                        name="font-family"
                        className="radio radio-success radio-sm"
                        checked={Boolean(isFontSelected(fontGroup.family))}
                        onChange={() => handleFontChange(fontGroup.family)}
                      />
                    </div>
                  </div>
                </label>
              </div>
            ) : (
              <>
                <div className="flex items-center mb-1">
                  <button
                    className={`btn btn-xs btn-ghost no-hover-effect ${
                      favoriteFonts.includes(fontGroup.family)
                        ? 'text-warning'
                        : 'text-base-content'
                    }`}
                    onClick={(e) => handleFavoriteClick(fontGroup.family, e)}
                    title={String(
                      favoriteFonts.includes(fontGroup.family)
                        ? t('font.unfavorite')
                        : t('font.favorite')
                    )}
                  >
                    <span className="favorite-icon">
                      {favoriteFonts.includes(fontGroup.family) ? '★' : '☆'}
                    </span>
                  </button>
                  <span className="ml-2 text-base">{fontGroup.family}</span>
                </div>
                <div className="ml-6">
                  {fontGroup.styles.map((style) => (
                    <label
                      key={`${style.fullName}-${forceUpdate}`}
                      className="flex justify-between items-center mt-1 w-full cursor-pointer"
                    >
                      <span className="text-sm mr-3">{style.style}</span>
                      <div>
                        <span
                          style={{
                            fontFamily: /[\u4E00-\u9FA5]/.test(fontGroup.family)
                              ? `${fontGroup.family}, sans-serif`
                              : `"${fontGroup.family}", sans-serif`,
                            fontStyle: style.style
                              .toLowerCase()
                              .includes('italic')
                              ? 'italic'
                              : 'normal',
                            fontWeight: style.style
                              .toLowerCase()
                              .includes('bold')
                              ? 'bold'
                              : 'normal'
                          }}
                          className="text-xs text-gray-500 mr-2"
                        >
                          测试 ABC
                        </span>
                        <input
                          type="radio"
                          name="font-family"
                          className="radio radio-success radio-sm"
                          checked={Boolean(
                            isFontSelected(fontGroup.family, style.style)
                          )}
                          onChange={() =>
                            handleFontChange(fontGroup.family, style.style)
                          }
                        />
                      </div>
                    </label>
                  ))}
                </div>
              </>
            )}
          </div>
        ))}
      </div>
    )
  }

  return (
    <>
      <div className="font-bold text-sm font-fredokaOne mt-3">
        {t('title.fontFamily')}
      </div>

      <TextEffectConfig />

      <div className="btn-group w-full mt-2 mb-3">
        <button
          className={`btn btn-xs flex-1 ${
            selectedCategory === 'system' ? 'btn-active' : ''
          }`}
          onClick={handleSystemFontsClick}
          disabled={
            systemFonts.length === 0 && getSystemPermissionStatus() === false
          }
        >
          {t('font.system')}
          {systemFonts.length === 0 &&
            getSystemPermissionStatus() !== false && (
              <span className="text-xs ml-1">
                {t('font.requestPermission')}
              </span>
            )}
        </button>
        <button
          className={`btn btn-xs flex-1 ${
            selectedCategory === 'web' ? 'btn-active' : ''
          }`}
          onClick={() => setSelectedCategory('web')}
        >
          {t('font.web')}
        </button>
      </div>

      {selectedCategory === 'system' && (
        <div className="flex justify-end mb-2">
          <button
            className="btn btn-xs btn-ghost"
            onClick={handleRefreshFonts}
            title={String(t('font.refresh'))}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-4 w-4"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.3" />
            </svg>
          </button>
        </div>
      )}

      {renderFontList()}
    </>
  )
}

export default FontFamilyConfg
