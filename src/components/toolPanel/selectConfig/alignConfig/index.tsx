import { FC } from 'react'
import { useTranslation } from 'react-i18next'
import { paintBoard } from '@/utils/paintBoard'

const AlignConfig: FC = () => {
  const { t } = useTranslation()

  const handleCenterObject = () => {
    const activeObject = paintBoard.canvas?.getActiveObject()
    if (activeObject) {
      paintBoard.centerCanvas(activeObject)
    }
  }

  return (
    <div className="mt-3">
      <div className="font-bold text-sm font-fredokaOne">
        {t('title.align')}
      </div>
      <div className="flex gap-2 mt-2">
        <button
          className="btn btn-sm flex-1"
          onClick={() => paintBoard.centerActiveObjectHorizontally()}
        >
          {t('operate.centerObjectHorizontal')}
        </button>
        <button
          className="btn btn-sm flex-1"
          onClick={() => paintBoard.centerActiveObjectVertically()}
        >
          {t('operate.centerObjectVertical')}
        </button>
      </div>
      <div className="mt-2">
        <button className="btn btn-sm w-full" onClick={handleCenterObject}>
          {t('operate.centerObject')}
        </button>
      </div>
    </div>
  )
}

export default AlignConfig
