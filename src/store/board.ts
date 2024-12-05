import { fabric } from 'fabric'
import { ActionMode } from '@/constants'
import { DrawType } from '@/constants/draw'
import {
  changeAlpha,
  getAlphaFromRgba,
  getColorFormat,
  hexToRgba
} from '@/utils/common/color'
import { paintBoard } from '@/utils/paintBoard'
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { alignGuideLine } from '@/utils/common/fabricMixin/alignGuideLine'
import {
  updateCanvasBackgroundImage,
  handleBackgroundImageWhenCanvasSizeChange
} from '@/utils/common/background'

// 添加尺寸模式枚举
export enum SizeMode {
  RATIO = 'ratio',
  PIXEL = 'pixel'
}

// 添加尺寸预设枚举
export enum SizePreset {
  CUSTOM = 'custom',
  PRESET_1 = 'preset_1', // 1242 x 1660
  PRESET_2 = 'preset_2' // 1080 x 1440
}

interface BoardState {
  mode: string // operating mode
  drawType: string // draw type
  language: string // i18n language 'zh' 'en'
  canvasWidth: number // canvas width 0.1 ~ 1
  canvasHeight: number // canvas height 0.1 ~ 1
  backgroundColor: string // canvas background color
  backgroundOpacity: number // canvas background color opacity
  hasBackgroundImage: boolean // canvas background image
  backgroundImageOpacity: number // canvas background Image opacity
  isObjectCaching: boolean // fabric objectCaching
  openGuideLine: boolean // does the guide line show
  sizeMode: SizeMode
  pixelWidth: number // 实际像素宽度
  pixelHeight: number // 实际像素高度
  sizePreset: SizePreset
}

interface BoardAction {
  updateMode: (mode: string) => void
  updateDrawType: (drawType: string) => void
  updateLanguage: (language: string) => void
  initBackground: () => void
  updateCanvasWidth: (width: number) => void
  updateCanvasHeight: (height: number) => void
  updateBackgroundColor: (color: string) => void
  updateBackgroundOpacity: (opacity: number) => void
  updateBackgroundImage: (image: string) => void
  updateBackgroundImageOpacity: (opacity: number) => void
  cleanBackgroundImage: () => void
  updateCacheState: () => void
  updateOpenGuideLine: () => void
  updateSizeMode: (mode: SizeMode) => void
  updatePixelSize: (width: number, height: number) => void
  updateSizePreset: (preset: SizePreset) => void
}

const initLanguage = ['en', 'en-US', 'en-us'].includes(navigator.language)
  ? 'en'
  : 'zh'

const useBoardStore = create<BoardState & BoardAction>()(
  persist(
    (set, get) => ({
      mode: ActionMode.DRAW,
      drawType: DrawType.FreeStyle,
      language: initLanguage,
      canvasWidth: 1,
      canvasHeight: 1,
      backgroundColor: 'rgba(255, 255, 255, 1)',
      backgroundOpacity: 1,
      hasBackgroundImage: false,
      backgroundImageOpacity: 1,
      isObjectCaching: true,
      openGuideLine: false,
      sizeMode: SizeMode.RATIO,
      pixelWidth: 1920,
      pixelHeight: 1080,
      sizePreset: SizePreset.CUSTOM,
      updateMode: (mode) => {
        const oldMode = get().mode
        if (oldMode !== mode) {
          paintBoard.handleMode(mode)
          set({
            mode
          })
        }
      },
      updateDrawType: (drawType) => {
        const oldDrawType = get().drawType
        if (oldDrawType !== drawType) {
          set({
            drawType
          })
          paintBoard.handleMode()
        }
      },
      updateLanguage(language) {
        set({
          language
        })
      },
      initBackground: () => {
        const backgroundColor = paintBoard?.canvas?.backgroundColor
        if (backgroundColor && typeof backgroundColor === 'string') {
          const type = getColorFormat(backgroundColor)
          if (type === 'hex') {
            const color = hexToRgba(backgroundColor)
            const opacity = getAlphaFromRgba(color)
            set({
              backgroundColor: color,
              backgroundOpacity: opacity
            })
          } else if (type === 'rgba') {
            const opacity = getAlphaFromRgba(backgroundColor)
            set({
              backgroundColor: backgroundColor,
              backgroundOpacity: opacity
            })
          }
        } else if (paintBoard?.canvas) {
          paintBoard.canvas.backgroundColor = 'rgba(255, 255, 255, 1)'
          set({
            backgroundColor: 'rgba(255, 255, 255, 1)',
            backgroundOpacity: 1
          })
        }

        const backgroundImage = paintBoard?.canvas
          ?.backgroundImage as fabric.Image
        if (backgroundImage) {
          handleBackgroundImageWhenCanvasSizeChange()
          set({
            hasBackgroundImage: true,
            backgroundOpacity: backgroundImage.opacity
          })
        } else {
          set({
            hasBackgroundImage: false,
            backgroundOpacity: 1
          })
        }
      },
      updateCanvasWidth: (width) => {
        const { sizeMode, canvasWidth } = get()
        if (canvasWidth !== width) {
          if (sizeMode === SizeMode.RATIO) {
            set({ canvasWidth: width })
            paintBoard.updateCanvasWidth(width)
          } else {
            const containerWidth = window.innerWidth
            set({
              pixelWidth: Math.round(containerWidth * width),
              canvasWidth: width
            })
            paintBoard.updateCanvasWidth(width)
          }
        }
      },
      updateCanvasHeight: (height) => {
        const { sizeMode, canvasHeight } = get()
        if (canvasHeight !== height) {
          if (sizeMode === SizeMode.RATIO) {
            set({ canvasHeight: height })
            paintBoard.updateCanvasHeight(height)
          } else {
            const containerHeight = window.innerHeight
            set({
              pixelHeight: Math.round(containerHeight * height),
              canvasHeight: height
            })
            paintBoard.updateCanvasHeight(height)
          }
        }
      },
      updateBackgroundColor: (color) => {
        const canvas = paintBoard.canvas
        if (canvas && color !== canvas?.backgroundColor) {
          set((state) => {
            const bgColor = hexToRgba(color, state.backgroundOpacity)
            canvas.backgroundColor = bgColor
            return {
              backgroundColor: bgColor
            }
          })
        }
      },
      updateBackgroundOpacity: (opacity) => {
        set((state) => {
          const canvas = paintBoard.canvas
          if (canvas && opacity !== state.backgroundOpacity) {
            const newColor = changeAlpha(state.backgroundColor, opacity)
            canvas.backgroundColor = newColor
            return {
              backgroundOpacity: opacity,
              backgroundColor: newColor
            }
          }
          return {}
        })
      },
      updateBackgroundImage: (image) => {
        const canvas = paintBoard.canvas
        const oldBackgroundImage = canvas?.backgroundImage as fabric.Image
        if (canvas && image !== oldBackgroundImage?.src) {
          updateCanvasBackgroundImage(image)
          set({
            hasBackgroundImage: true
          })
        }
      },
      cleanBackgroundImage: () => {
        set({
          hasBackgroundImage: false
        })
        const canvas = paintBoard.canvas
        if (canvas) {
          canvas.setBackgroundImage(null as unknown as string, () => {
            paintBoard.render()
          })
        }
      },
      updateBackgroundImageOpacity: (opacity) => {
        set((state) => {
          const canvas = paintBoard.canvas
          if (canvas && opacity !== state.backgroundImageOpacity) {
            const backgroundImage = canvas?.backgroundImage as fabric.Image
            if (backgroundImage) {
              backgroundImage.set({
                opacity
              })
            }

            return {
              backgroundImageOpacity: opacity
            }
          }
          return {}
        })
      },
      updateCacheState() {
        const oldCacheState = get().isObjectCaching
        set({
          isObjectCaching: !oldCacheState
        })
        fabric.Object.prototype.set({
          objectCaching: useBoardStore.getState().isObjectCaching
        })
        paintBoard?.canvas?.renderAll()
      },
      updateOpenGuideLine() {
        const newOpenGuideLine = !get().openGuideLine
        set({
          openGuideLine: newOpenGuideLine
        })
        alignGuideLine.updateOpenState(newOpenGuideLine)
      },
      updateSizeMode: (mode) => {
        const oldMode = get().sizeMode
        if (oldMode !== mode) {
          set({ sizeMode: mode })
          // 切换模式时进行尺寸转换
          if (mode === SizeMode.PIXEL) {
            // 从比例转换为像素
            const { canvasWidth, canvasHeight } = get()
            const containerWidth = window.innerWidth
            const containerHeight = window.innerHeight
            set({
              pixelWidth: Math.round(containerWidth * canvasWidth),
              pixelHeight: Math.round(containerHeight * canvasHeight)
            })
          } else {
            // 从像素转换为比例
            const { pixelWidth, pixelHeight } = get()
            const containerWidth = window.innerWidth
            const containerHeight = window.innerHeight
            set({
              canvasWidth: pixelWidth / containerWidth,
              canvasHeight: pixelHeight / containerHeight
            })
          }
        }
      },
      updatePixelSize: (width, height) => {
        const { pixelWidth, pixelHeight } = get()
        if (pixelWidth !== width || pixelHeight !== height) {
          set({
            pixelWidth: width,
            pixelHeight: height
          })
          // 更新比例值
          const containerWidth = window.innerWidth
          const containerHeight = window.innerHeight
          paintBoard.updateCanvasWidth(width / containerWidth)
          paintBoard.updateCanvasHeight(height / containerHeight)
        }
      },
      updateSizePreset: (preset) => {
        const { sizeMode } = get()
        set({ sizePreset: preset })
        if (preset !== SizePreset.CUSTOM) {
          const presetSizes = {
            [SizePreset.PRESET_1]: { width: 1242, height: 1660 },
            [SizePreset.PRESET_2]: { width: 1080, height: 1440 }
          }
          const size = presetSizes[preset]
          if (sizeMode === SizeMode.PIXEL) {
            get().updatePixelSize(size.width, size.height)
          } else {
            const containerWidth = window.innerWidth
            const containerHeight = window.innerHeight
            get().updateCanvasWidth(size.width / containerWidth)
            get().updateCanvasHeight(size.height / containerHeight)
          }
        }
      }
    }),
    {
      name: 'PAINT-BOARD-STORE'
    }
  )
)
export default useBoardStore
