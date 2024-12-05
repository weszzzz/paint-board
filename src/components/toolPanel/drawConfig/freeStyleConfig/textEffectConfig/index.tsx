import { FC, useState } from 'react'
import { useTranslation } from 'react-i18next'
import useDrawStore from '@/store/draw'
import {
  updateSelectedTextStroke,
  updateSelectedTextShadow,
  updateSelectedTextColor,
  TextAlign,
  updateSelectedTextAlign,
  GRADIENT_PRESETS,
  GradientPreset,
  addGradientPreset,
  removeGradientPreset
} from '@/utils/element/draw/text'

const TextEffectConfig: FC = () => {
  const { t } = useTranslation()
  const {
    textStroke,
    textStrokeWidth,
    textShadow,
    textColor,
    updateTextStroke,
    updateTextStrokeWidth,
    updateTextShadow,
    updateTextColor,
    textAlign,
    updateTextAlign
  } = useDrawStore()

  const [showGradientEditor, setShowGradientEditor] = useState(false)
  const [editingPreset, setEditingPreset] = useState<GradientPreset | null>(
    null
  )
  const [presetName, setPresetName] = useState('')

  const handleStrokeChange = (color: string) => {
    updateTextStroke(color)
    updateSelectedTextStroke()
  }

  const handleStrokeWidthChange = (width: number) => {
    updateTextStrokeWidth(width)
    updateSelectedTextStroke()
  }

  const handleShadowChange = (changes: Partial<typeof textShadow>) => {
    updateTextShadow(changes)
    updateSelectedTextShadow()
  }

  const handleColorChange = (color: string) => {
    updateTextColor(color)
    updateSelectedTextColor()
  }

  const handleStrokeOpacityChange = (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const opacity = parseFloat(e.target.value)
    const strokeMatch = textStroke.match(
      /rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*[\d.]+)?\)/
    )
    if (strokeMatch) {
      const [, r, g, b] = strokeMatch
      updateTextStroke(`rgba(${r}, ${g}, ${b}, ${opacity})`)
      updateSelectedTextStroke()
    } else {
      const hex = textStroke.replace('#', '')
      const r = parseInt(hex.slice(0, 2), 16)
      const g = parseInt(hex.slice(2, 4), 16)
      const b = parseInt(hex.slice(4, 6), 16)
      updateTextStroke(`rgba(${r}, ${g}, ${b}, ${opacity})`)
      updateSelectedTextStroke()
    }
  }

  const handleShadowOpacityChange = (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const opacity = parseFloat(e.target.value)
    updateTextShadow({ ...textShadow, opacity })
    updateSelectedTextShadow()
  }

  const getCurrentOpacity = (color: string) => {
    const match = color.match(
      /rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/
    )
    return match ? parseFloat(match[4] || '1') : 1
  }

  const handleAlignChange = (align: TextAlign) => {
    updateTextAlign(align)
    updateSelectedTextAlign()
  }

  const handleAddColorStop = () => {
    if (!editingPreset) return

    const newColorStops = [...editingPreset.colorStops]
    const lastOffset = newColorStops[newColorStops.length - 1]?.offset || 0
    const newOffset = Math.min(lastOffset + 0.1, 1)

    newColorStops.push({
      offset: newOffset,
      color: '#000000'
    })

    setEditingPreset({
      ...editingPreset,
      colorStops: newColorStops
    })
  }

  const handleRemoveColorStop = (index: number) => {
    if (!editingPreset || editingPreset.colorStops.length <= 2) return

    const newColorStops = editingPreset.colorStops.filter((_, i) => i !== index)
    setEditingPreset({
      ...editingPreset,
      colorStops: newColorStops
    })
  }

  const handleColorStopChange = (
    index: number,
    changes: Partial<{ offset: number; color: string }>
  ) => {
    if (!editingPreset) return

    const newColorStops = editingPreset.colorStops.map((stop, i) =>
      i === index ? { ...stop, ...changes } : stop
    )

    setEditingPreset({
      ...editingPreset,
      colorStops: newColorStops
    })
  }

  const handleSavePreset = () => {
    if (!editingPreset || !presetName.trim()) return

    const key = addGradientPreset(editingPreset, presetName)
    handleStrokeChange(`gradient:${key}`)
    setShowGradientEditor(false)
    setEditingPreset(null)
    setPresetName('')
  }

  const handleDeletePreset = (key: string) => {
    if (window.confirm(String(t('textEffect.confirmDeletePreset')))) {
      if (removeGradientPreset(key)) {
        if (textStroke === `gradient:${key}`) {
          handleStrokeChange('#000000')
        }
      }
    }
  }

  const handlePresetDoubleClick = (key: string, preset: GradientPreset) => {
    setEditingPreset({
      ...preset,
      colorStops: [...preset.colorStops]
    })
    setPresetName(preset.name || key)
    setShowGradientEditor(true)
  }

  return (
    <div className="mt-2">
      {/* 文字颜色 */}
      <div className="text-sm">{t('textEffect.color')}</div>
      <div className="flex gap-2 items-center mt-1">
        <input
          type="color"
          value={textColor}
          onChange={(e) => handleColorChange(e.target.value)}
          className="colorInput"
        />
      </div>

      {/* 描边效果 */}
      <div className="mt-2">
        <div className="text-sm">{t('textEffect.stroke')}</div>
        <div className="flex gap-2 items-center mt-1">
          <input
            type="color"
            value={textStroke.startsWith('gradient:') ? '#000000' : textStroke}
            onChange={(e) => handleStrokeChange(e.target.value)}
            className="colorInput"
          />
          <div className="flex gap-1">
            {Object.entries(GRADIENT_PRESETS).map(([key, preset]) => (
              <div key={key} className="relative">
                <button
                  className="w-6 h-6 rounded"
                  style={{
                    background: `linear-gradient(to right, ${preset.colorStops
                      .map((stop) => `${stop.color} ${stop.offset * 100}%`)
                      .join(', ')})`
                  }}
                  onClick={() => handleStrokeChange(`gradient:${key}`)}
                  onDoubleClick={() => handlePresetDoubleClick(key, preset)}
                  title={preset.name || key}
                />
                {preset.isCustom && (
                  <button
                    className="absolute -top-1 -right-1 w-3 h-3 text-xs leading-none bg-error text-white rounded-full"
                    onClick={(e) => {
                      e.stopPropagation()
                      handleDeletePreset(key)
                    }}
                  >
                    ×
                  </button>
                )}
              </div>
            ))}
            <button
              className="w-6 h-6 rounded border-2 border-dashed border-base-content/20 hover:border-base-content/40"
              onClick={() => {
                setEditingPreset({
                  type: 'linear',
                  coords: { x1: 0, y1: 0, x2: 1, y2: 0 },
                  colorStops: [
                    { offset: 0, color: '#000000' },
                    { offset: 1, color: '#ffffff' }
                  ]
                })
                setPresetName('')
                setShowGradientEditor(true)
              }}
              title={String(t('textEffect.addPreset'))}
            >
              +
            </button>
          </div>
          <input
            type="range"
            min="0"
            max="10"
            step="0.1"
            value={textStrokeWidth}
            onChange={(e) =>
              handleStrokeWidthChange(parseFloat(e.target.value))
            }
            className="range range-xs flex-1"
          />
          <span className="text-xs w-8 text-right">{textStrokeWidth}</span>
        </div>
        {/* 描边不透明度 */}
        <div className="form-control mt-1">
          <label className="label py-0">
            <span className="label-text-alt">{t('title.opacity')}</span>
            <span className="label-text-alt">
              {Math.round(getCurrentOpacity(textStroke) * 100)}%
            </span>
          </label>
          <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={getCurrentOpacity(textStroke)}
            onChange={handleStrokeOpacityChange}
            className="range range-xs range-success"
          />
        </div>
      </div>

      {/* 阴影效果 */}
      <div className="mt-2">
        <div className="text-sm">{t('textEffect.shadow')}</div>
        <div className="flex gap-2 items-center mt-1">
          <input
            type="color"
            value={textShadow.color}
            onChange={(e) => handleShadowChange({ color: e.target.value })}
            className="colorInput"
          />
          <input
            type="range"
            min="0"
            max="50"
            value={textShadow.blur}
            onChange={(e) =>
              handleShadowChange({ blur: parseInt(e.target.value) })
            }
            className="range range-xs flex-1"
          />
          <span className="text-xs w-8 text-right">{textShadow.blur}</span>
        </div>
        <div className="flex gap-2 mt-1">
          <div className="flex-1">
            <div className="text-xs">{t('textEffect.offsetX')}</div>
            <input
              type="range"
              min="-50"
              max="50"
              value={textShadow.offsetX}
              onChange={(e) =>
                handleShadowChange({ offsetX: parseInt(e.target.value) })
              }
              className="range range-xs"
            />
          </div>
          <div className="flex-1">
            <div className="text-xs">{t('textEffect.offsetY')}</div>
            <input
              type="range"
              min="-50"
              max="50"
              value={textShadow.offsetY}
              onChange={(e) =>
                handleShadowChange({ offsetY: parseInt(e.target.value) })
              }
              className="range range-xs"
            />
          </div>
        </div>
        {/* 阴影不透明度 */}
        <div className="form-control mt-1">
          <label className="label py-0">
            <span className="label-text-alt">{t('title.opacity')}</span>
            <span className="label-text-alt">
              {Math.round(textShadow.opacity * 100)}%
            </span>
          </label>
          <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={textShadow.opacity}
            onChange={handleShadowOpacityChange}
            className="range range-xs range-success"
          />
        </div>
      </div>

      {/* 文本对齐 */}
      <div className="mt-2">
        <div className="text-sm">{t('textEffect.align')}</div>
        <div className="flex gap-2 mt-1">
          <button
            className={`btn btn-sm flex-1 ${
              textAlign === 'left' ? 'btn-active' : ''
            }`}
            onClick={() => handleAlignChange('left')}
          >
            {t('textEffect.alignLeft')}
          </button>
          <button
            className={`btn btn-sm flex-1 ${
              textAlign === 'center' ? 'btn-active' : ''
            }`}
            onClick={() => handleAlignChange('center')}
          >
            {t('textEffect.alignCenter')}
          </button>
          <button
            className={`btn btn-sm flex-1 ${
              textAlign === 'right' ? 'btn-active' : ''
            }`}
            onClick={() => handleAlignChange('right')}
          >
            {t('textEffect.alignRight')}
          </button>
        </div>
      </div>

      {/* 渐变编辑器对话框 */}
      {showGradientEditor && editingPreset && (
        <dialog className="modal modal-open">
          <div className="modal-box">
            <h3 className="font-bold text-lg">
              {String(t('textEffect.editGradient'))}
            </h3>

            {/* 预览 */}
            <div
              className="w-full h-8 rounded mt-4"
              style={{
                background: `linear-gradient(to right, ${editingPreset.colorStops
                  .map((stop) => `${stop.color} ${stop.offset * 100}%`)
                  .join(', ')})`
              }}
            />

            {/* 渐变点编辑 */}
            <div className="mt-4">
              {editingPreset.colorStops.map((stop, index) => (
                <div key={index} className="flex gap-2 items-center mt-2">
                  <input
                    type="color"
                    value={stop.color}
                    onChange={(e) =>
                      handleColorStopChange(index, { color: e.target.value })
                    }
                    className="colorInput"
                  />
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={stop.offset * 100}
                    onChange={(e) =>
                      handleColorStopChange(index, {
                        offset: parseInt(e.target.value) / 100
                      })
                    }
                    className="range range-xs flex-1"
                  />
                  <span className="text-xs w-8">
                    {Math.round(stop.offset * 100)}%
                  </span>
                  {editingPreset.colorStops.length > 2 && (
                    <button
                      className="btn btn-ghost btn-xs"
                      onClick={() => handleRemoveColorStop(index)}
                    >
                      ×
                    </button>
                  )}
                </div>
              ))}
              <button
                className="btn btn-ghost btn-sm mt-2"
                onClick={handleAddColorStop}
              >
                {t('textEffect.addColorStop')}
              </button>
            </div>

            {/* 预设名称 */}
            <div className="form-control mt-4">
              <label className="label">
                <span className="label-text">{t('textEffect.presetName')}</span>
              </label>
              <input
                type="text"
                value={presetName}
                onChange={(e) => setPresetName(e.target.value)}
                className="input input-bordered w-full"
                placeholder={String(t('textEffect.presetNamePlaceholder'))}
              />
            </div>

            {/* 操作按钮 */}
            <div className="modal-action">
              <button
                className="btn"
                onClick={() => {
                  setShowGradientEditor(false)
                  setEditingPreset(null)
                  setPresetName('')
                }}
              >
                {t('cancel')}
              </button>
              <button
                className="btn btn-primary"
                onClick={handleSavePreset}
                disabled={!presetName.trim()}
              >
                {t('confirm')}
              </button>
            </div>
          </div>
        </dialog>
      )}
    </div>
  )
}

export default TextEffectConfig
