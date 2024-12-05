import { get, set } from 'idb-keyval'
import fontConfig from '@/config/fonts.json'

interface LocalFont {
  family: string
  fullName: string
  postscriptName: string
  style?: string
  path?: string
  localizedName?: string
}

interface FontGroup {
  family: string
  styles: {
    fullName: string
    style: string
  }[]
}

const FAVORITE_FONTS_KEY = 'PAINT-BOARD-FAVORITE-FONTS'
const SYSTEM_FONTS_KEY = 'PAINT-BOARD-SYSTEM-FONTS'
const SYSTEM_FONTS_VERSION = '1.0'
let systemPermission: boolean | null = null
let cachedSystemFonts: LocalFont[] | null = null

function isChinese(str: string) {
  return /[\u4E00-\u9FA5]/.test(str)
}

function compareFontFamily(a: string, b: string) {
  const aIsChinese = isChinese(a)
  const bIsChinese = isChinese(b)

  if (aIsChinese && !bIsChinese) return -1
  if (!aIsChinese && bIsChinese) return 1
  return a.localeCompare(b)
}

interface FontConfig {
  family: string
  aliases?: string[]
  category: string
  styles: Array<{
    name: string
    weight: string
    style: string
  }>
}

type FontConfigMap = Record<string, FontConfig>

async function scanSystemFonts(): Promise<LocalFont[]> {
  try {
    if (cachedSystemFonts) {
      return cachedSystemFonts
    }

    const cached = await get(SYSTEM_FONTS_KEY)
    if (cached && cached.version === SYSTEM_FONTS_VERSION) {
      cachedSystemFonts = cached.fonts
      return cached.fonts
    }

    if ('queryLocalFonts' in window) {
      const fonts = await (window as any).queryLocalFonts()
      console.log('Found system fonts:', fonts.length)

      const nameMapping = new Map<string, string>()
      const localFonts = fontConfig.localFonts as {
        chinese: FontConfigMap
        english: FontConfigMap
      }

      Object.entries({
        ...localFonts.chinese,
        ...localFonts.english
      }).forEach(([key, value]) => {
        if (value.aliases) {
          value.aliases.forEach(() => {
            nameMapping.set(value.family.toLowerCase(), key)
          })
        }
      })

      const processedFonts = fonts.map((font: LocalFont) => {
        const familyLower = font.family.toLowerCase()
        const chineseName = nameMapping.get(familyLower)
        return {
          ...font,
          localizedName: chineseName || font.family
        }
      })

      cachedSystemFonts = processedFonts
      await set(SYSTEM_FONTS_KEY, {
        version: SYSTEM_FONTS_VERSION,
        fonts: processedFonts
      })

      return processedFonts
    } else {
      console.warn('Local Font Access API is not supported')
      return []
    }
  } catch (err) {
    console.error('Failed to scan system fonts:', err)
    return []
  }
}

async function loadSystemFonts(): Promise<LocalFont[]> {
  try {
    return await scanSystemFonts()
  } catch (err) {
    console.error('Failed to load system fonts:', err)
    return []
  }
}

export function resetSystemPermission() {
  systemPermission = null
  clearSystemFontsCache()
}

export function getSystemPermissionStatus() {
  return systemPermission
}

export async function getSystemFonts() {
  if (!('queryLocalFonts' in window)) {
    console.warn('Local Font Access API is not supported')
    return null
  }

  if (systemPermission === false) {
    return null
  }

  try {
    const fonts = await loadSystemFonts()
    systemPermission = true

    const fontGroups = fonts.reduce((groups: FontGroup[], font) => {
      const family = (font.localizedName || font.family).trim()
      const existingGroup = groups.find((g) => g.family === family)

      if (existingGroup) {
        const existingStyle = existingGroup.styles.find(
          (s) => s.fullName === font.fullName
        )
        if (!existingStyle) {
          let style = font.style || 'Regular'
          if (style.toLowerCase() === 'normal') {
            style = 'Regular'
          }
          existingGroup.styles.push({
            fullName: font.fullName,
            style
          })
        }
      } else {
        let style = font.style || 'Regular'
        if (style.toLowerCase() === 'normal') {
          style = 'Regular'
        }
        groups.push({
          family,
          styles: [
            {
              fullName: font.fullName,
              style
            }
          ]
        })
      }

      return groups
    }, [])

    fontGroups.forEach((group) => {
      group.styles.sort((a, b) => {
        const styleOrder = {
          Regular: 0,
          Normal: 1,
          Medium: 2,
          Bold: 3,
          Light: 4,
          Thin: 5,
          Italic: 6
        }
        const aOrder = styleOrder[a.style as keyof typeof styleOrder] ?? 99
        const bOrder = styleOrder[b.style as keyof typeof styleOrder] ?? 99
        if (aOrder !== bOrder) {
          return aOrder - bOrder
        }
        return a.style.localeCompare(b.style)
      })
    })

    const sortedGroups = fontGroups
      .map((group) => {
        if (group.styles.length === 1) {
          return {
            family: group.family,
            styles: group.styles
          }
        }
        return group
      })
      .sort((a, b) => compareFontFamily(a.family, b.family))

    return sortedGroups
  } catch (err) {
    if (err instanceof DOMException && err.name === 'SecurityError') {
      console.warn('System font access permission denied')
      systemPermission = false
    } else if (err instanceof DOMException && err.name === 'NotAllowedError') {
      console.warn('System font access permission request was dismissed')
      systemPermission = null
    } else {
      console.error('Failed to query system fonts:', err)
      systemPermission = null
    }
    return null
  }
}

export const webFonts: Record<string, { url: string; isLocal: boolean }> = {
  ...Object.entries({
    ...fontConfig.localFonts.chinese,
    ...fontConfig.localFonts.english
  }).reduce((acc, [key]) => {
    acc[key] = { url: '', isLocal: true }
    return acc
  }, {} as Record<string, { url: string; isLocal: boolean }>),

  ...Object.entries(fontConfig.webFonts).reduce((acc, [key, value]) => {
    acc[key] = { url: value.url, isLocal: false }
    return acc
  }, {} as Record<string, { url: string; isLocal: boolean }>)
}

export async function loadFavoriteFonts(): Promise<string[]> {
  try {
    const fonts = await get(FAVORITE_FONTS_KEY)
    return fonts || []
  } catch (err) {
    console.error('Failed to load favorite fonts:', err)
    return []
  }
}

export async function saveFavoriteFonts(fonts: string[]): Promise<void> {
  try {
    await set(FAVORITE_FONTS_KEY, fonts)
  } catch (err) {
    console.error('Failed to save favorite fonts:', err)
  }
}

export async function loadFontFace(fontFamily: string) {
  const fontConfig = webFonts[fontFamily as keyof typeof webFonts]

  if (fontConfig) {
    if (fontConfig.isLocal) {
      return
    }

    try {
      const url = fontConfig.url
      if (!url) return

      const link = document.createElement('link')
      link.href = url
      link.rel = 'stylesheet'
      document.head.appendChild(link)

      await new Promise((resolve, reject) => {
        link.onload = resolve
        link.onerror = reject
      })

      await document.fonts.ready
    } catch (err) {
      console.error('Failed to load web font:', fontFamily, err)
      throw err
    }
  } else {
    try {
      console.log('Loading system font:', fontFamily)

      if ('queryLocalFonts' in window) {
        const fonts = await (window as any).queryLocalFonts()
        console.log('Available system fonts:', fonts.length)

        const exactMatch = fonts.find(
          (font: LocalFont) =>
            font.fullName === fontFamily ||
            font.postscriptName === fontFamily ||
            (font.family === fontFamily &&
              (!font.style || font.style === 'Regular'))
        )

        const [family, ...styleParts] = fontFamily.split(/\s+/)
        const style = styleParts.join(' ')
        const styleMatch = style
          ? fonts.find(
              (font: LocalFont) =>
                font.family === family &&
                font.style?.toLowerCase() === style.toLowerCase()
            )
          : null

        const matchedFont = exactMatch || styleMatch

        if (matchedFont) {
          console.log('Found font:', matchedFont)
          return
        }
      }

      console.log('Using font directly:', fontFamily)
    } catch (err) {
      console.warn('System font loading failed:', fontFamily, err)
    }
  }

  await document.fonts.ready
}

export function clearSystemFontsCache() {
  cachedSystemFonts = null
  return set(SYSTEM_FONTS_KEY, null)
}
