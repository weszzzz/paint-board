import { fabric } from 'fabric'
import 'fabric/src/mixins/eraser_brush.mixin.js'
import { brushMouseMixin } from './common/fabricMixin/brushMouse'
import { alignGuideLine } from './common/fabricMixin/alignGuideLine.js'

import { History } from './history'
import { ActionMode, ELEMENT_CUSTOM_TYPE } from '@/constants'
import { DrawStyle, DrawType } from '@/constants/draw'

import { v4 as uuidv4 } from 'uuid'
import { debounce } from 'lodash'
import { isMobile } from './common'
import { CanvasEvent } from './event'
import { TextElement } from './element/text'
import { material } from './element/draw/material'
import { renderMultiColor } from './element/draw/multiColor'
import { renderPencilBrush } from './element/draw/basic'
import { getEraserWidth } from './common/draw'
import { handleCanvasJSONLoaded } from './common/loadCanvas'
import { handleBackgroundImageWhenCanvasSizeChange } from './common/background'

import useFileStore from '@/store/files'
import useDrawStore from '@/store/draw'
import useBoardStore from '@/store/board'

/**
 * PaintBoard
 */
export class PaintBoard {
  canvas: fabric.Canvas | null = null
  evnet: CanvasEvent | null = null
  history: History | null = null
  textElement: TextElement
  hookFn: Array<() => void> = []

  constructor() {
    this.textElement = new TextElement()
  }

  initCanvas(canvasEl: HTMLCanvasElement) {
    return new Promise<boolean>(async (resolve) => {
      this.canvas = new fabric.Canvas(canvasEl, {
        selectionColor: 'rgba(101, 204, 138, 0.3)',
        preserveObjectStacking: true,
        enableRetinaScaling: true,
        renderOnAddRemove: true,
        width: window.innerWidth,
        height: window.innerHeight,
        viewportTransform: [1, 0, 0, 1, 0, 0],
        backgroundColor: '#ffffff'
      })

      fabric.Object.prototype.set({
        borderColor: '#65CC8A',
        cornerColor: '#65CC8A',
        cornerStyle: 'circle',
        borderDashArray: [3, 3],
        transparentCorners: false
      })
      fabric.Line.prototype.strokeLineJoin = 'round'
      fabric.Line.prototype.strokeLineCap = 'round'

      if (isMobile()) {
        brushMouseMixin.initCanvas(this.canvas)
      }
      alignGuideLine.init(this.canvas, useBoardStore.getState().openGuideLine)

      this.evnet = new CanvasEvent()
      this.handleMode()

      this.initEvent()

      await this.initCanvasStorage()

      this.setupBackgroundImage()

      resolve(true)
    })
  }

  removeCanvas() {
    if (this.canvas) {
      this?.canvas?.dispose()
      this.evnet?.removeEvent()
      this.canvas = null
    }
  }

  /**
   * Initialize the canvas cache
   */
  initCanvasStorage() {
    return new Promise((resolve) => {
      setTimeout(() => {
        const { files, currentId } = useFileStore.getState()
        const file = files?.find((item) => item?.id === currentId)
        if (file && this.canvas) {
          this.canvas.clear()
          this.canvas.loadFromJSON(file.boardData, () => {
            if (this.canvas) {
              if (file.viewportTransform) {
                this.canvas.setViewportTransform(file.viewportTransform)
              }
              if (file?.zoom && this.canvas.width && this.canvas.height) {
                this.canvas.zoomToPoint(
                  new fabric.Point(
                    this.canvas.width / 2,
                    this.canvas.height / 2
                  ),
                  file.zoom
                )
              }

              this.canvas.setWidth(window.innerWidth * (file?.canvasWidth || 1))
              useBoardStore.getState().updateCanvasWidth(file?.canvasWidth || 1)
              this.canvas.setHeight(
                window.innerHeight * (file?.canvasHeight || 1)
              )
              useBoardStore.getState().initBackground()

              useBoardStore
                .getState()
                .updateCanvasHeight(file?.canvasHeight || 1)

              handleCanvasJSONLoaded(this.canvas)

              fabric.Object.prototype.set({
                objectCaching: useBoardStore.getState().isObjectCaching
              })
              this.canvas.renderAll()
              this.triggerHook()
              this.history = new History()
            }
            resolve(true)
          })
        } else {
          resolve(true)
        }
      }, 300)
    })
  }

  /**
   * handle mode of operation
   * @param mode current mode
   */
  handleMode(mode: string = useBoardStore.getState().mode) {
    if (!this.canvas) {
      return
    }
    let isDrawingMode = false
    let selection = false
    const objectSet: Partial<fabric.IObjectOptions> = {
      selectable: false,
      hoverCursor: 'default'
    }

    switch (mode) {
      case ActionMode.DRAW:
        if (
          useBoardStore.getState().drawType === DrawType.FreeStyle &&
          [DrawStyle.Basic, DrawStyle.Material, DrawStyle.MultiColor].includes(
            useDrawStore.getState().drawStyle
          )
        ) {
          isDrawingMode = true
          this.handleDrawStyle()
        }
        this.canvas.discardActiveObject()
        break
      case ActionMode.ERASE:
        isDrawingMode = true
        this.canvas.freeDrawingBrush = new (fabric as any).EraserBrush(
          this.canvas
        )
        this.canvas.freeDrawingBrush.width = getEraserWidth()
        this.canvas.freeDrawingBrush.color = '#FFF'
        this.canvas.discardActiveObject()
        break
      case ActionMode.Board:
      case ActionMode.SELECT:
        objectSet.selectable = true
        objectSet.hoverCursor = undefined
        selection = true
        break
      default:
        break
    }
    this.canvas.isDrawingMode = isDrawingMode
    this.canvas.selection = selection
    fabric.Object.prototype.set(objectSet)

    this.canvas.forEachObject((obj) => {
      if (obj._customType === ELEMENT_CUSTOM_TYPE.I_TEXT) {
        obj.selectable = objectSet.selectable
        obj.hoverCursor = objectSet.hoverCursor
      }
    })

    this.canvas.requestRenderAll()
  }

  /**
   * handle draw style
   */
  handleDrawStyle() {
    if (!this.canvas) {
      return
    }
    const drawStyle = useDrawStore.getState().drawStyle
    switch (drawStyle) {
      case DrawStyle.Basic:
        renderPencilBrush()
        break
      case DrawStyle.Material:
        this.canvas.isDrawingMode = true
        material.render({})
        break
      case DrawStyle.MultiColor:
        renderMultiColor({})
        break
      default:
        this.canvas.isDrawingMode = false
        break
    }
  }

  /**
   * delete active objects
   */
  deleteObject() {
    // Disable deletion in text input state
    if (this.textElement.isTextEditing) {
      return
    }
    if (this.canvas) {
      const activeObjects = this.canvas.getActiveObjects()
      if (activeObjects?.length) {
        this.canvas.discardActiveObject()
        activeObjects?.forEach((obj) => {
          this.canvas?.remove(obj)
        })
        this.render()
      }
    }
  }

  /**
   * render and save history state
   */
  render() {
    if (this.canvas) {
      this.canvas?.requestRenderAll()
      this.history?.saveState()
    }
  }

  /**
   * copy active objects
   */
  copyObject() {
    const canvas = this.canvas
    if (!canvas) {
      return
    }
    const targets = canvas.getActiveObjects()
    if (targets.length <= 0) {
      return
    }
    canvas.discardActiveObject()
    const copys = targets.map((target) => {
      return new Promise<fabric.Object>((resolve) => {
        target?.clone((cloned: fabric.Object) => {
          const id = uuidv4()
          cloned.set({
            left: (cloned?.left || 0) + 10,
            top: (cloned?.top || 0) + 10,
            evented: true,
            id,
            perPixelTargetFind: true
          })
          resolve(cloned)
          canvas.add(cloned)
        })
      })
    })
    Promise.all(copys).then((objs) => {
      const activeSelection = new fabric.ActiveSelection(objs, {
        canvas: canvas
      })
      canvas.setActiveObject(activeSelection)
      this.render()
    })
  }

  /**
   * Moving active objects via fabric's bringForward method
   */
  bringForWard() {
    const canvas = this.canvas
    if (canvas) {
      const object = canvas.getActiveObject()
      if (object) {
        canvas.bringForward(object, true)
        this.render()
      }
    }
  }

  /**
   * Moving active objects via fabric's sendBackwards method
   */
  seendBackWard() {
    const canvas = this.canvas
    if (canvas) {
      const object = canvas.getActiveObject()
      if (object) {
        canvas.sendBackwards(object, true)
        this.render()
      }
    }
  }

  /**
   * Moving active objects via fabric's bringToFront method
   */
  bringToFront() {
    const canvas = this.canvas
    if (canvas) {
      const object = canvas.getActiveObject()
      if (object) {
        canvas.bringToFront(object)
        this.render()
      }
    }
  }

  /**
   * Moving active objects via fabric's sendToBack method
   */
  sendToBack() {
    const canvas = this.canvas
    if (canvas) {
      const object = canvas.getActiveObject()
      if (object) {
        canvas.sendToBack(object)
        this.render()
      }
    }
  }

  /**
   * Add hook fn to trigger on update
   * @param fn hook fn
   */
  addHookFn(fn: () => void) {
    this.hookFn.push(fn)
  }

  /**
   * remove trigger hook fn
   * @param fn hook fn
   */
  removeHookFn(fn: () => void) {
    const hookIndex = this.hookFn.findIndex((v) => v === fn)
    if (hookIndex > -1) {
      this.hookFn.splice(hookIndex, 1)
    }
  }

  /**
   * trigger hook fn
   */
  triggerHook() {
    this.hookFn.map((fn) => {
      fn?.()
    })
  }

  updateCanvasWidth = debounce((width) => {
    if (this.canvas) {
      this.canvas.setWidth(window.innerWidth * width)
      handleBackgroundImageWhenCanvasSizeChange()
      useFileStore.getState().updateCanvasWidth(width)
    }
  }, 500)

  updateCanvasHeight = debounce((height) => {
    if (this.canvas) {
      this.canvas.setHeight(window.innerHeight * height)
      handleBackgroundImageWhenCanvasSizeChange()
      useFileStore.getState().updateCanvasHeight(height)
    }
  }, 500)

  initEvent() {
    if (!this.canvas) return

    this.canvas.on('mouse:wheel', (opt) => {
      const delta = opt.e.deltaY
      if (!this.canvas) return

      const zoom = this.canvas.getZoom()
      let newZoom = zoom

      // 根据滚轮方向调整缩放比例
      if (delta < 0) {
        // 向上滚动，放大视图
        newZoom = Math.min(5, zoom * 1.05)
      } else {
        // 向下滚动，缩小视图
        newZoom = Math.max(0.1, zoom * 0.95)
      }

      // 获取画板中心点
      const center = {
        x: (this.canvas.width || 0) / 2,
        y: (this.canvas.height || 0) / 2
      }

      // 保存当前背景颜色
      const backgroundColor = this.canvas.backgroundColor

      // 创建或更新背景矩形
      let bgRect = this.canvas.getObjects().find(
        obj => obj.data?.isBackground === true
      ) as fabric.Rect

      if (!bgRect && backgroundColor) {
        // 如果不存在背景矩形且有背景色，创建一个新的
        bgRect = new fabric.Rect({
          left: 0,
          top: 0,
          width: this.canvas.width,
          height: this.canvas.height,
          fill: backgroundColor,
          selectable: false,
          evented: false,
          excludeFromExport: true,
          data: { isBackground: true }
        })
        this.canvas.add(bgRect)
        this.canvas.sendToBack(bgRect)
      } else if (bgRect) {
        // 如果存在背景矩形，更新其属性
        bgRect.set({
          width: this.canvas.width,
          height: this.canvas.height,
          fill: backgroundColor
        })
      }

      // 设置视图变换矩阵
      const vpt = [
        newZoom,
        0,
        0,
        newZoom,
        center.x - center.x * newZoom,
        center.y - center.y * newZoom
      ]

      this.canvas.setViewportTransform(vpt)
      this.canvas.requestRenderAll()

      opt.e.preventDefault()
      opt.e.stopPropagation()
    })
  }

  // 水平居中
  centerObjectHorizontally(object?: fabric.Object) {
    if (!this.canvas) return

    const obj = object || this.canvas.getActiveObject()
    if (!obj) return

    const canvasCenter = {
      x: (this.canvas.width || 0) / 2
    }

    const objectCenter = obj.getCenterPoint()
    const dx = canvasCenter.x - objectCenter.x

    // 只移动水平位置
    obj.set({
      left: (obj.left || 0) + dx
    })

    obj.setCoords()
    this.canvas.requestRenderAll()

    // 确保对象保持选中状态
    if (!object) {
      this.canvas.setActiveObject(obj)
    }

    this.render()
  }

  // 垂直居中
  centerObjectVertically(object?: fabric.Object) {
    if (!this.canvas) return

    const obj = object || this.canvas.getActiveObject()
    if (!obj) return

    const canvasCenter = {
      y: (this.canvas.height || 0) / 2
    }

    const objectCenter = obj.getCenterPoint()
    const dy = canvasCenter.y - objectCenter.y

    // 只移动垂直位置
    obj.set({
      top: (obj.top || 0) + dy
    })

    obj.setCoords()
    this.canvas.requestRenderAll()

    // 确保对象保持选中状态
    if (!object) {
      this.canvas.setActiveObject(obj)
    }

    this.render()
  }

  // 修改原有的居中方法，添加对齐类型参数
  centerCanvas(
    object?: fabric.Object,
    align?: 'both' | 'horizontal' | 'vertical'
  ) {
    if (!this.canvas) return

    if (object) {
      switch (align) {
        case 'horizontal':
          this.centerObjectHorizontally(object)
          break
        case 'vertical':
          this.centerObjectVertically(object)
          break
        default: {
          // 默认同时水平和垂直居中
          const canvasCenter = {
            x: (this.canvas.width || 0) / 2,
            y: (this.canvas.height || 0) / 2
          }
          const objectCenter = object.getCenterPoint()
          const dx = canvasCenter.x - objectCenter.x
          const dy = canvasCenter.y - objectCenter.y

          object.set({
            left: (object.left || 0) + dx,
            top: (object.top || 0) + dy
          })

          object.setCoords()
          this.canvas.requestRenderAll()

          // 确保对象保持选中状态
          this.canvas.setActiveObject(object)

          this.render()
          break
        }
      }
    } else {
      // 画布居中逻辑保持不变
      const zoom = this.canvas.getZoom()
      const center = this.canvas.getCenter()

      this.canvas.absolutePan(
        new fabric.Point(
          center.left - window.innerWidth / 2 / zoom,
          center.top - window.innerHeight / 2 / zoom
        )
      )

      this.canvas.requestRenderAll()
    }
  }

  // 添加对应的快捷方法
  centerActiveObjectHorizontally() {
    if (!this.canvas) return

    const activeObject = this.canvas.getActiveObject()
    if (activeObject) {
      this.centerCanvas(activeObject, 'horizontal')
    }
  }

  centerActiveObjectVertically() {
    if (!this.canvas) return

    const activeObject = this.canvas.getActiveObject()
    if (activeObject) {
      this.centerCanvas(activeObject, 'vertical')
    }
  }

  // 修改背景图片设置函数
  setupBackgroundImage() {
    if (!this.canvas || !this.canvas.backgroundImage) return

    if (this.canvas.backgroundImage instanceof fabric.Image) {
      const canvasWidth = this.canvas.getWidth()
      const canvasHeight = this.canvas.getHeight()
      const imgWidth = this.canvas.backgroundImage.width || 1
      const imgHeight = this.canvas.backgroundImage.height || 1

      // 计算初始缩放比例
      const scaleX = canvasWidth / imgWidth
      const scaleY = canvasHeight / imgHeight
      const scale = Math.min(scaleX, scaleY)

      // 保存初始缩放比例
      if (!this.canvas.backgroundImage.data) {
        this.canvas.backgroundImage.data = { originalScale: scale }
      }

      // 使用初始缩放比例
      const originalScale = this.canvas.backgroundImage.data.originalScale

      this.canvas.backgroundImage.set({
        scaleX: originalScale,
        scaleY: originalScale,
        left: canvasWidth / 2,
        top: canvasHeight / 2,
        originX: 'center',
        originY: 'center'
      })

      this.canvas.requestRenderAll()
    }
  }
}

export const paintBoard = new PaintBoard()
