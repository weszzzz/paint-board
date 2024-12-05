import { ELEMENT_CUSTOM_TYPE } from '@/constants'
import useDrawStore from '@/store/draw'
import { getDistance } from '@/utils/common'
import { setObjectAttr } from '@/utils/common/draw'
import { paintBoard } from '@/utils/paintBoard'
import { fabric } from 'fabric'

const minFontSize = 3

// 定义渐变预设的类型
export type GradientPreset = {
  type: string
  coords: { x1: number; y1: number; x2: number; y2: number }
  colorStops: Array<{ offset: number; color: string }>
  name?: string
  isCustom?: boolean
}

// 添加自定义预设存储键
const CUSTOM_PRESETS_KEY = 'PAINT-BOARD-GRADIENT-PRESETS'

// 加载自定义预设
function loadCustomPresets(): Record<string, GradientPreset> {
  try {
    const saved = localStorage.getItem(CUSTOM_PRESETS_KEY)
    return saved ? JSON.parse(saved) : {}
  } catch {
    return {}
  }
}

// 保存自定义预设
function saveCustomPresets(presets: Record<string, GradientPreset>) {
  localStorage.setItem(CUSTOM_PRESETS_KEY, JSON.stringify(presets))
}

// 修改渐变预设的定义
export const GRADIENT_PRESETS: Record<string, GradientPreset> = {
  ...loadCustomPresets(),
  rainbow: {
    name: 'Rainbow',
    type: 'linear',
    coords: { x1: 0, y1: 0, x2: 1, y2: 0 },
    colorStops: [
      { offset: 0, color: '#ff0000' },
      { offset: 0.2, color: '#ffff00' },
      { offset: 0.4, color: '#00ff00' },
      { offset: 0.6, color: '#00ffff' },
      { offset: 0.8, color: '#0000ff' },
      { offset: 1, color: '#ff00ff' }
    ]
  },
  sunset: {
    type: 'linear',
    coords: { x1: 0, y1: 0, x2: 1, y2: 0 },
    colorStops: [
      { offset: 0, color: '#ff7e5f' },
      { offset: 1, color: '#feb47b' }
    ]
  },
  ocean: {
    type: 'linear',
    coords: { x1: 0, y1: 0, x2: 1, y2: 0 },
    colorStops: [
      { offset: 0, color: '#2193b0' },
      { offset: 1, color: '#6dd5ed' }
    ]
  },
  fire: {
    type: 'linear',
    coords: { x1: 0, y1: 0, x2: 1, y2: 0 },
    colorStops: [
      { offset: 0, color: '#f12711' },
      { offset: 1, color: '#f5af19' }
    ]
  }
}

// 添加预设管理函数
export function addGradientPreset(preset: GradientPreset, name: string) {
  const key = name.toLowerCase().replace(/\s+/g, '-')
  GRADIENT_PRESETS[key] = {
    ...preset,
    name,
    isCustom: true
  }
  saveCustomPresets(
    Object.fromEntries(
      Object.entries(GRADIENT_PRESETS).filter(([, p]) => p.isCustom)
    )
  )
  return key
}

export function removeGradientPreset(key: string) {
  if (GRADIENT_PRESETS[key]?.isCustom) {
    delete GRADIENT_PRESETS[key]
    saveCustomPresets(
      Object.fromEntries(
        Object.entries(GRADIENT_PRESETS).filter(([, p]) => p.isCustom)
      )
    )
    return true
  }
  return false
}

// 添加文本对齐类型
export type TextAlign = 'left' | 'center' | 'right'

export class DrawTextElement {
  lastTime = 0
  points: fabric.Point[] = []
  group: fabric.Group
  counter = 0
  position = { x: 0, y: window.innerHeight / 2 }

  constructor() {
    const group = new fabric.Group([], {
      perPixelTargetFind: true
    })
    paintBoard.canvas?.add(group)
    this.group = group

    setObjectAttr(group, ELEMENT_CUSTOM_TYPE.DRAW_TEXT)
  }

  addPosition(point: fabric.Point | undefined) {
    if (!point) return

    const newPoint = new fabric.Point(point.x, point.y)
    this.points.push(newPoint)

    if (this.points.length < 2) {
      this.position = { x: newPoint.x, y: newPoint.y }
      return
    }

    const now = Date.now()
    if (now - this.lastTime < 30) return
    this.lastTime = now

    const text = drawText(this)
    if (text && paintBoard.canvas) {
      const wasDrawingMode = paintBoard.canvas.isDrawingMode
      paintBoard.canvas.isDrawingMode = false

      this.group.addWithUpdate(text)
      this.group.setCoords()

      paintBoard.canvas.requestRenderAll()
      setTimeout(() => paintBoard.render(), 0)

      paintBoard.canvas.isDrawingMode = wasDrawingMode
    }
  }

  destroy() {
    paintBoard.canvas?.remove(this.group)
  }
}

function drawText(el: DrawTextElement) {
  const points = el.points
  const mouse = points[points.length - 1]
  const d = getDistance(el.position as fabric.Point, mouse)
  const fontSize = minFontSize + d / 2
  const letter =
    useDrawStore.getState().drawTextValue[
      el.counter % useDrawStore.getState().drawTextValue.length
    ]
  const stepSize = textWidth(letter, fontSize)

  if (stepSize && d > stepSize) {
    const angle = Math.atan2(mouse.y - el.position.y, mouse.x - el.position.x)
    const { textFontFamily } = useDrawStore.getState()

    // 创建文本对象并设置基本属性
    const text = new fabric.Text(letter, {
      fontSize,
      top: el.position.y,
      left: el.position.x,
      fontFamily: /[\u4E00-\u9FA5]/.test(textFontFamily)
        ? `${textFontFamily}, sans-serif`
        : `"${textFontFamily}", sans-serif`,
      originX: 'left',
      originY: 'bottom',
      angle: fabric.util.radiansToDegrees(angle),
      strokeUniform: true,
      paintFirst: 'stroke',
      strokeLineCap: 'round',
      strokeLineJoin: 'round'
    })

    // 从当前选中的文本读取效果(如果)
    const activeObject = paintBoard.canvas?.getActiveObject()
    if (
      activeObject &&
      (activeObject.type === 'text' || activeObject.type === 'group')
    ) {
      const sourceObject =
        activeObject.type === 'group'
          ? (activeObject as fabric.Group)
              .getObjects()
              .find((obj: fabric.Object) => obj.type === 'text')
          : activeObject

      if (sourceObject) {
        // 复制效果
        const textObject = sourceObject as fabric.Text
        const effects = {
          fill: textObject.fill,
          stroke: textObject.stroke,
          strokeWidth: textObject.strokeWidth,
          shadow: textObject.shadow
            ? new fabric.Shadow(textObject.shadow)
            : undefined,
          fontWeight: textObject.fontWeight,
          fontStyle: textObject.fontStyle as
            | ''
            | 'normal'
            | 'italic'
            | 'oblique',
          underline: textObject.underline,
          linethrough: textObject.linethrough
        }
        text.set(effects)
        el.group.set(effects)
      }
    } else {
      // 使用 store 中的效果
      applyEffectsFromStore(text)
      applyEffectsFromStore(el.group)
    }

    // 添加选中事件处理
    text.on('selected', () => {
      // 从文本读取效果到 store
      readEffectsToStore(text)
    })

    el.position = {
      x: el.position.x + Math.cos(angle) * stepSize,
      y: el.position.y + Math.sin(angle) * stepSize
    }

    el.counter++
    if (el.counter > useDrawStore.getState().drawTextValue.length - 1) {
      el.counter = 0
    }

    return text
  }
}

function textWidth(string: string, size: number) {
  const fontFamily = useDrawStore.getState().textFontFamily
  const formattedFontFamily = /[\u4E00-\u9FA5]/.test(fontFamily)
    ? `${fontFamily}, sans-serif`
    : `"${fontFamily}", sans-serif`
  const text = new fabric.Text(string, {
    fontSize: size,
    fontFamily: formattedFontFamily
  })
  return text.width
}

// 修改渐变创建函数
function createGradient(
  text: fabric.Text,
  preset: keyof typeof GRADIENT_PRESETS
): fabric.Gradient {
  const gradientDef = GRADIENT_PRESETS[preset]
  const width = text.width || 0
  const height = text.height || 0

  const gradient = new fabric.Gradient({
    type: gradientDef.type,
    coords: {
      x1: gradientDef.coords.x1 * width,
      y1: gradientDef.coords.y1 * height,
      x2: gradientDef.coords.x2 * width,
      y2: gradientDef.coords.y2 * height
    },
    colorStops: [...gradientDef.colorStops] // 创���新数组以避免 readonly 问题
  })

  return gradient
}

// 修改 applyEffectsFromStore 函数
function applyEffectsFromStore(textObject: fabric.Object | fabric.Group) {
  const {
    textColor,
    textStroke,
    textStrokeWidth,
    textShadow,
    fontStyles,
    textAlign
  } = useDrawStore.getState()

  // 处理描边透明度
  const strokeMatch = textStroke.match(
    /rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/
  )

  // 检查是否是渐变预设
  const isGradient = textStroke.startsWith('gradient:')
  const gradientType = isGradient
    ? (textStroke.split(':')[1] as keyof typeof GRADIENT_PRESETS)
    : null

  let strokeValue: string | fabric.Gradient = textStroke
  if (isGradient && textObject instanceof fabric.Text && gradientType) {
    strokeValue = createGradient(textObject, gradientType)
  } else if (strokeMatch) {
    const [, r, g, b, a = '1'] = strokeMatch
    strokeValue = `rgba(${r}, ${g}, ${b}, ${a})`
  }

  // 处理阴影透明度
  const shadowColor = textShadow.color.match(
    /rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/
  )
  const shadowRgba = shadowColor
    ? `rgba(${shadowColor[1]}, ${shadowColor[2]}, ${shadowColor[3]}, ${
        textShadow.opacity * parseFloat(shadowColor[4] || '1')
      })`
    : textShadow.color.startsWith('#')
    ? `rgba(${parseInt(textShadow.color.slice(1, 3), 16)}, ${parseInt(
        textShadow.color.slice(3, 5),
        16
      )}, ${parseInt(textShadow.color.slice(5, 7), 16)}, ${textShadow.opacity})`
    : textShadow.color

  const effects = {
    fill: textColor,
    stroke: strokeValue as string, // 类型断言为 string
    strokeWidth: textStrokeWidth,
    strokeUniform: true,
    paintFirst: 'stroke' as const,
    strokeLineCap: 'round' as const,
    strokeLineJoin: 'round' as const,
    shadow:
      textShadow.blur > 0
        ? new fabric.Shadow({
            ...textShadow,
            color: shadowRgba
          })
        : undefined,
    fontWeight: fontStyles.includes('bold') ? 'bold' : 'normal',
    fontStyle: fontStyles.includes('italic')
      ? 'italic'
      : ('normal' as 'normal' | 'italic'),
    underline: fontStyles.includes('underline'),
    linethrough: fontStyles.includes('linethrough'),
    textAlign // 添加文本对齐
  } as fabric.IObjectOptions

  if (textObject instanceof fabric.Group) {
    textObject.getObjects().forEach((obj: fabric.Object) => {
      if (obj.type === 'text') {
        obj.set(effects)
      }
    })
    textObject.set(effects)
  } else {
    textObject.set(effects)
  }

  paintBoard.canvas?.requestRenderAll()
}

// 修改渐变检查
function readEffectsToStore(textObject: fabric.Text) {
  const store = useDrawStore.getState()

  store.updateTextColor(textObject.fill as string)

  // 读取描边效果
  const stroke = textObject.stroke
  if (typeof stroke === 'object' && stroke && 'type' in stroke) {
    // 如果是渐变,找到匹配的预设
    const presetEntry = Object.entries(GRADIENT_PRESETS).find(([, preset]) => {
      return preset.colorStops.every((stop, index) => {
        const gradientStop = (stroke as fabric.Gradient).colorStops?.[index]
        return (
          gradientStop &&
          stop.offset === gradientStop.offset &&
          stop.color === gradientStop.color
        )
      })
    })
    if (presetEntry) {
      store.updateTextStroke(`gradient:${presetEntry[0]}`)
    }
  } else {
    store.updateTextStroke((stroke as string) || '#000000')
  }
  store.updateTextStrokeWidth(textObject.strokeWidth || 0)

  // 从阴影中提取颜色和透明度
  const shadow = textObject.shadow as fabric.Shadow
  if (shadow) {
    const shadowColorMatch = shadow.color?.match(
      /rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/
    )
    if (shadowColorMatch) {
      const [, r, g, b, a = '1'] = shadowColorMatch
      store.updateTextShadow({
        color: `rgba(${r}, ${g}, ${b}, ${a})`,
        blur: shadow.blur || 0,
        offsetX: shadow.offsetX || 0,
        offsetY: shadow.offsetY || 0,
        opacity: parseFloat(a)
      })
    } else {
      store.updateTextShadow({
        color: shadow.color || '#000000',
        blur: shadow.blur || 0,
        offsetX: shadow.offsetX || 0,
        offsetY: shadow.offsetY || 0,
        opacity: 1
      })
    }
  } else {
    store.updateTextShadow({
      color: '#000000',
      blur: 0,
      offsetX: 0,
      offsetY: 0,
      opacity: 1
    })
  }

  // 更新样式
  const styles: string[] = []
  if (textObject.fontWeight === 'bold') styles.push('bold')
  if (textObject.fontStyle === 'italic') styles.push('italic')
  if (textObject.underline) styles.push('underline')
  if (textObject.linethrough) styles.push('linethrough')

  while (store.fontStyles.length > 0) {
    store.updateFontStyles(store.fontStyles[0])
  }
  styles.forEach((style) => store.updateFontStyles(style))

  // 读取文本对齐
  store.updateTextAlign(textObject.textAlign as TextAlign)
}

// 更新选中文本的效果 - 从 store 应用效果
function updateSelectedTextEffects() {
  const canvas = paintBoard.canvas
  if (!canvas) return

  const activeObject = canvas.getActiveObject()
  if (!activeObject) return

  applyEffectsFromStore(activeObject)
}

// 导出的更新函数都使用统一的更新方法
export const updateSelectedTextFont = updateSelectedTextEffects
export const updateSelectedTextStyles = updateSelectedTextEffects
export const updateSelectedTextStroke = updateSelectedTextEffects
export const updateSelectedTextShadow = updateSelectedTextEffects
export const updateSelectedTextColor = updateSelectedTextEffects
export const updateSelectedTextAlign = updateSelectedTextEffects
