import { History } from './history'
import { DrawStyle, ActionMode } from '@/constants'
import { fabric } from 'fabric'
import { CanvasEvent } from './event'
import { TextElement } from './element/text'
import { material } from './element/draw/material'
import { renderPencilBrush } from './element/draw/basic'
import { v4 as uuidv4 } from 'uuid'
import { getEraserWidth } from './common/draw'
import { renderMultiColor } from './element/draw/multiColor'

import useFileStore from '@/store/files'
import useDrawStore from '@/store/draw'
import useBoardStore from '@/store/board'

import '@/lib/eraser_brush.mixin.ts'

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
    return new Promise<boolean>((resolve) => {
      this.canvas = new fabric.Canvas(canvasEl, {
        selectionColor: 'rgba(101, 204, 138, 0.3)',
        preserveObjectStacking: true,
        width: window.innerWidth,
        height: window.innerHeight,
        enableRetinaScaling: true
        // enablePointerEvents: true
      })
      fabric.Object.prototype.set({
        borderColor: '#65CC8A',
        cornerColor: '#65CC8A',
        cornerStyle: 'rect',
        borderDashArray: [3, 3]
        // objectCaching: false
        // noScaleCache: false
      })
      // fabric.Object.prototype.objectCaching = false;
      fabric.Line.prototype.strokeLineJoin = 'round'
      fabric.Line.prototype.strokeLineCap = 'round'
      this.initCanvasStorage()
      this.handleMode()
      this.evnet = new CanvasEvent()
      resolve(true)
    })
  }

  removeCanvas() {
    if (this.canvas) {
      this?.canvas?.dispose()
      this.evnet?.removeEvent()
    }
  }

  /**
   * 初始化缓存
   */
  initCanvasStorage() {
    setTimeout(() => {
      const { files, currentId } = useFileStore.getState()
      const file = files?.find((item) => item?.id === currentId)
      console.log('initCanvasStorage', file)
      if (file && this.canvas) {
        this.history = new History(file.boardData)
        this.canvas.loadFromJSON(file.boardData, () => {
          if (this.canvas) {
            if (file.viewportTransform) {
              this.canvas.setViewportTransform(file.viewportTransform)
            }
            if (file?.zoom && this.canvas.width && this.canvas.height) {
              this.canvas.zoomToPoint(
                new fabric.Point(this.canvas.width / 2, this.canvas.height / 2),
                file.zoom
              )
            }
            this.canvas.requestRenderAll()
            this.triggerHook()
          }
        })
      }
    }, 1000)
  }

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
      if (obj._customType === 'itext') {
        obj.selectable = objectSet.selectable
        obj.hoverCursor = objectSet.hoverCursor
      }
    })

    this.canvas.requestRenderAll()
  }

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

  multipleTouchDisableAction(isDisable = true) {
    if (this.canvas) {
      switch (useBoardStore.getState().mode) {
        case ActionMode.DRAW:
          if (
            [
              DrawStyle.Basic,
              DrawStyle.Material,
              DrawStyle.MultiColor
            ].includes(useDrawStore.getState().drawStyle)
          ) {
            this.canvas.isDrawingMode = !isDisable
          }
          break
        case ActionMode.ERASE:
          this.canvas.isDrawingMode = !isDisable
          break
        case ActionMode.Board:
        case ActionMode.SELECT:
          this.canvas.selection = !isDisable
          fabric.Object.prototype.set({
            selectable: !isDisable,
            hoverCursor: isDisable ? 'default' : undefined
          })
          break
        default:
          break
      }
      this.canvas.discardActiveObject()
    }
  }

  deleteObject() {
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

  render() {
    if (this.canvas) {
      this.canvas?.requestRenderAll()
      this.history?.saveState()
    }
  }

  /**
   * 保存为图片
   */
  saveImage() {
    if (this.canvas) {
      const link = document.createElement('a')
      link.href = this.canvas.toDataURL()
      link.download = 'paint-board.png'
      link.click()
    }
  }

  /**
   * 复制对象
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

  addHookFn(fn: () => void) {
    this.hookFn.push(fn)
  }

  removeHookFn(fn: () => void) {
    const hookIndex = this.hookFn.findIndex((v) => v === fn)
    if (hookIndex > -1) {
      this.hookFn.splice(hookIndex, 1)
    }
  }

  triggerHook() {
    this.hookFn.map((fn) => {
      fn?.()
    })
  }
}

export const paintBoard = new PaintBoard()
