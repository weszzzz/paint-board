import { DrawShape, DrawStyle } from '@/constants/draw'
import {
  getDrawWidth,
  getEraserWidth,
  getShadowWidth
} from '@/utils/common/draw'
import { MATERIAL_TYPE, material } from '@/utils/element/draw/material'
import {
  MultiColorType,
  renderMultiColor
} from '@/utils/element/draw/multiColor'
import { paintBoard } from '@/utils/paintBoard'
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { loadFavoriteFonts, saveFavoriteFonts } from '@/utils/common/fonts'
import { TextAlign } from '@/utils/element/draw/text'

interface DrawState {
  drawWidth: number // draw brush width
  drawColors: string[] // draw brush colors
  shadowWidth: number // brush shadow blur
  shadowColor: string // brush shadow color
  drawTextValue: string // text draws the content
  drawStyle: string // draw style
  drawShapeCount: number // count of shape mode
  drawShape: string // the shape of the shape mode
  materialType: string // material brush type
  eraserWidth: number // eraser width
  multiColorType: string // 'col' | 'row' | 'circle'
  textFontFamily: string // current text drawing font
  fontStyles: string[] // ['bold', 'italic', 'underLine', 'lineThrough']
  favoriteFonts: string[] // 新增收藏字体列表
  textStroke: string // 描边颜色
  textStrokeWidth: number // 描边宽度
  textShadow: {
    color: string // 阴影颜色
    blur: number // 阴影模糊度
    offsetX: number // 阴影X偏移
    offsetY: number // 阴影Y偏移
    opacity: number // 添加透明度属性
  }
  textColor: string // 字体颜色
  textAlign: TextAlign // 文本对齐方式
}

interface DrawAction {
  updateDrawWidth: (drawWidth: number) => void
  updateDrawColors: (drawColors: string[]) => void
  updateShadowWidth: (shadowWidth: number) => void
  updateShadowColor: (shadowColor: string) => void
  updateDrawShape: (drawShape: string) => void
  updateDrawStyle: (drawStyle: string) => void
  updateDrawShapeCount: (drawShapeCount: number) => void
  updateDrawTextValue: (drawTextValue: string) => void
  updateMaterialType: (materialType: string) => void
  updateEraserWidth: (eraserWidth: number) => void
  updateMultiColorType: (multiColorType: string) => void
  updateTextFontFamily: (fontFamily: string) => void
  updateFontStyles: (type: string) => void
  toggleFavoriteFont: (font: string) => void // 新增切换收藏状态的方法
  initFavoriteFonts: () => Promise<void>
  updateTextStroke: (color: string) => void
  updateTextStrokeWidth: (width: number) => void
  updateTextShadow: (shadow: Partial<DrawState['textShadow']>) => void
  updateTextColor: (color: string) => void
  updateTextAlign: (align: TextAlign) => void
}

const useDrawStore = create<DrawState & DrawAction>()(
  persist(
    (set, get) => ({
      drawWidth: 10,
      drawColors: ['#000000'],
      shadowWidth: 0,
      shadowColor: '#000000',
      drawTextValue: 'draw',
      drawStyle: DrawStyle.Basic,
      drawShapeCount: 2,
      materialType: MATERIAL_TYPE.CRAYON,
      drawShape: DrawShape.Bubble,
      eraserWidth: 20,
      multiColorType: MultiColorType.COL,
      textFontFamily: 'Georgia',
      fontStyles: [],
      favoriteFonts: [], // 初始化收藏列表
      textStroke: '#000000',
      textStrokeWidth: 0,
      textShadow: {
        color: '#000000',
        blur: 0,
        offsetX: 0,
        offsetY: 0,
        opacity: 1
      },
      textColor: '#000000', // 默认黑色
      textAlign: 'left', // 默认左对齐
      updateDrawWidth(drawWidth) {
        const oldDrawWidth = get().drawWidth
        if (oldDrawWidth !== drawWidth && paintBoard.canvas) {
          paintBoard.canvas.freeDrawingBrush.width = getDrawWidth(drawWidth)
          set({
            drawWidth
          })
        }
      },
      updateDrawColors: (drawColors) => {
        set((state) => {
          switch (state.drawStyle) {
            case DrawStyle.Basic:
              if (paintBoard.canvas) {
                paintBoard.canvas.freeDrawingBrush.color = drawColors[0]
              }
              break
            case DrawStyle.Material:
              if (state.drawColors[0] !== drawColors[0]) {
                material.render({})
              }
              break
            case DrawStyle.MultiColor:
              renderMultiColor({
                colors: drawColors
              })
              break
            default:
              break
          }
          return { drawColors }
        })
      },
      updateShadowWidth: (shadowWidth) => {
        set(() => {
          if (paintBoard.canvas) {
            ;(paintBoard.canvas.freeDrawingBrush.shadow as fabric.Shadow).blur =
              getShadowWidth(shadowWidth)
          }
          return { shadowWidth }
        })
      },
      updateShadowColor: (shadowColor) => {
        set(() => {
          if (paintBoard.canvas) {
            ;(
              paintBoard.canvas.freeDrawingBrush.shadow as fabric.Shadow
            ).color = shadowColor
          }
          return { shadowColor }
        })
      },
      updateDrawShape: (drawShape) => set({ drawShape }),
      updateDrawStyle: (drawStyle) => {
        set({ drawStyle })
        paintBoard.handleDrawStyle()
      },
      updateDrawShapeCount: (drawShapeCount) => set({ drawShapeCount }),
      updateDrawTextValue: (drawTextValue) => set({ drawTextValue }),
      updateMaterialType(materialType) {
        set((state) => {
          if (state.materialType !== materialType) {
            material.render({
              materialType
            })
          }
          return { materialType }
        })
      },
      updateEraserWidth(eraserWidth) {
        set((state) => {
          if (state.drawWidth !== eraserWidth && paintBoard.canvas) {
            paintBoard.canvas.freeDrawingBrush.width =
              getEraserWidth(eraserWidth)
          }
          return { eraserWidth }
        })
      },
      updateMultiColorType(multiColorType) {
        set((state) => {
          if (state.multiColorType !== multiColorType) {
            renderMultiColor({
              type: multiColorType
            })
          }
          return { multiColorType }
        })
      },
      updateTextFontFamily(fontFamily) {
        set({
          textFontFamily: fontFamily
        })
      },
      updateFontStyles(type) {
        const fontStyles = [...get().fontStyles]
        const typeIndex = fontStyles.findIndex((item) => item === type)
        if (typeIndex !== -1) {
          fontStyles.splice(typeIndex, 1)
        } else {
          fontStyles.push(type)
        }
        set({
          fontStyles
        })
      },
      toggleFavoriteFont: async (font) => {
        const favoriteFonts = [...get().favoriteFonts]
        const index = favoriteFonts.indexOf(font)
        if (index !== -1) {
          favoriteFonts.splice(index, 1)
        } else {
          favoriteFonts.push(font)
        }
        set({ favoriteFonts })
        // 保存到 IndexedDB
        await saveFavoriteFonts(favoriteFonts)
      },
      initFavoriteFonts: async () => {
        // 从 IndexedDB 加载收藏的字体
        const fonts = await loadFavoriteFonts()
        set({ favoriteFonts: fonts })
      },
      updateTextStroke: (color) => set({ textStroke: color }),
      updateTextStrokeWidth: (width) => set({ textStrokeWidth: width }),
      updateTextShadow: (shadow) =>
        set((state) => ({
          textShadow: { ...state.textShadow, ...shadow }
        })),
      updateTextColor: (color) => set({ textColor: color }),
      updateTextAlign: (align) => set({ textAlign: align })
    }),
    {
      name: 'PAINT-BOARD-DRAW-STORE'
    }
  )
)

export default useDrawStore
