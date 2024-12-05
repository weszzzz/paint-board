import { useTranslation } from 'react-i18next'
import useBoardStore, { SizeMode, SizePreset } from '@/store/board'

const CanvasSizeConfig = () => {
  const { t } = useTranslation()
  const {
    sizeMode,
    sizePreset,
    canvasWidth,
    canvasHeight,
    pixelWidth,
    pixelHeight,
    updateSizeMode,
    updateCanvasWidth,
    updateCanvasHeight,
    updatePixelSize,
    updateSizePreset
  } = useBoardStore()

  return (
    <div className="mt-3">
      <div className="font-bold text-sm font-fredokaOne flex justify-between items-center">
        <span>{t('title.canvasSize')}</span>
        <div className="btn-group">
          <button
            className={`btn btn-xs ${
              sizeMode === SizeMode.RATIO ? 'btn-active' : ''
            }`}
            onClick={() => updateSizeMode(SizeMode.RATIO)}
          >
            {t('ratio')}
          </button>
          <button
            className={`btn btn-xs ${
              sizeMode === SizeMode.PIXEL ? 'btn-active' : ''
            }`}
            onClick={() => updateSizeMode(SizeMode.PIXEL)}
          >
            {t('pixel')}
          </button>
        </div>
      </div>

      <div className="flex gap-2 mt-2 mb-2">
        <button
          className={`btn btn-xs flex-1 ${
            sizePreset === SizePreset.PRESET_1 ? 'btn-active' : ''
          }`}
          onClick={() => updateSizePreset(SizePreset.PRESET_1)}
        >
          1242 x 1660
        </button>
        <button
          className={`btn btn-xs flex-1 ${
            sizePreset === SizePreset.PRESET_2 ? 'btn-active' : ''
          }`}
          onClick={() => updateSizePreset(SizePreset.PRESET_2)}
        >
          1080 x 1440
        </button>
      </div>

      {sizeMode === SizeMode.RATIO ? (
        <div className="mt-1">
          <div className="flex gap-2 items-center">
            <input
              type="range"
              className="range range-xs flex-1"
              min={0.1}
              max={1}
              step={0.1}
              value={canvasWidth}
              onChange={(e) => updateCanvasWidth(parseFloat(e.target.value))}
            />
            <span className="text-xs w-12 text-right">
              {(canvasWidth * 100).toFixed(0)}%
            </span>
          </div>
          <div className="flex gap-2 items-center mt-1">
            <input
              type="range"
              className="range range-xs flex-1"
              min={0.1}
              max={1}
              step={0.1}
              value={canvasHeight}
              onChange={(e) => updateCanvasHeight(parseFloat(e.target.value))}
            />
            <span className="text-xs w-12 text-right">
              {(canvasHeight * 100).toFixed(0)}%
            </span>
          </div>
          <div className="text-xs text-gray-500 mt-1">
            {Math.round(window.innerWidth * canvasWidth)} {' x '}{' '}
            {Math.round(window.innerHeight * canvasHeight)} px
          </div>
        </div>
      ) : (
        <div className="flex gap-2 mt-1 items-center">
          <input
            type="number"
            className="input input-xs w-24"
            min={100}
            value={pixelWidth}
            onChange={(e) => {
              const width = parseInt(e.target.value)
              updatePixelSize(width, pixelHeight)
              updateSizePreset(SizePreset.CUSTOM)
            }}
          />
          <span>x</span>
          <input
            type="number"
            className="input input-xs w-24"
            min={100}
            value={pixelHeight}
            onChange={(e) => {
              const height = parseInt(e.target.value)
              updatePixelSize(pixelWidth, height)
              updateSizePreset(SizePreset.CUSTOM)
            }}
          />
        </div>
      )}
    </div>
  )
}

export default CanvasSizeConfig
